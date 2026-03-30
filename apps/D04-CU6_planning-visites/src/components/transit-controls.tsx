"use client";

import { useState, useRef, useCallback } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import type { ViewMode } from "@/lib/types";

const METRO_COLORS: Record<string, string> = {
  "1": "#FFCD00", "2": "#003CA6", "3": "#837902", "3bis": "#6EC4E8",
  "4": "#CF009E", "5": "#FF7E2E", "6": "#6ECA97", "7": "#FA9ABA", "7bis": "#6ECA97",
  "8": "#E19BDF", "9": "#B6BD00", "10": "#C9910D", "11": "#704B1C", "12": "#007852",
  "13": "#6EC4E8", "14": "#62259D",
};
const RER_COLORS: Record<string, string> = {
  A: "#E2231A", B: "#7BA3DC", C: "#C9910D", D: "#00814F", E: "#CF76C8",
};

type LayerType = "lines" | "stations" | "labels" | "numbers";

function esc(s: string) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function badgeHtml(line: { ref: string; color: string; isRER: boolean }) {
  return `<span class="tt-badge ${line.isRER ? "tt-rer" : "tt-metro"}" style="background:${line.color}${line.color === "#FFCD00" ? ";color:#000" : ""}">${esc((line.isRER ? "RER " : "") + line.ref)}</span>`;
}

interface TransitControlsProps {
  mapRef: React.MutableRefObject<LeafletMap | null>;
  view: ViewMode;
}

export default function TransitControls({ mapRef, view }: TransitControlsProps) {
  const [visible, setVisible] = useState<Record<LayerType, boolean>>({
    lines: false, stations: false, labels: false, numbers: false,
  });
  const [loading, setLoading] = useState(false);
  const layersRef = useRef<Record<LayerType, LayerGroup | null>>({
    lines: null, stations: null, labels: null, numbers: null,
  });
  const dataRef = useRef<unknown>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);

  const getLeaflet = useCallback(async () => {
    if (!leafletRef.current) {
      leafletRef.current = await import("leaflet");
    }
    return leafletRef.current;
  }, []);

  const toggle = useCallback(
    async (type: LayerType) => {
      const map = mapRef.current;
      if (!map) return;
      const L = await getLeaflet();

      if (visible[type]) {
        if (layersRef.current[type]) map.removeLayer(layersRef.current[type]!);
        setVisible((v) => ({ ...v, [type]: false }));
        return;
      }

      if (!dataRef.current) {
        if (loading) return;
        setLoading(true);
        try {
          const b = map.getBounds().pad(0.5);
          const bbox = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].join(",");
          const q = `[out:json][timeout:30];(node["railway"="station"]["station"="subway"](${bbox});node["railway"="station"]["network"~"RER"](${bbox});)->.stations;(relation["route"="subway"](${bbox});relation["route"="train"]["network"~"RER"](${bbox});)->.routes;node(r.routes)(${bbox})->.stops;(.stations;.stops;);out body;.routes out body geom;`;

          const endpoints = [
            "https://overpass-api.de/api/interpreter",
            "https://overpass.kumi.systems/api/interpreter",
          ];
          let raw: { elements: Array<{ type: string; id: number; lat?: number; lon?: number; tags?: Record<string, string>; members?: Array<{ type: string; ref?: number; geometry?: Array<{ lat: number; lon: number }> }> }> } | null = null;
          for (const ep of endpoints) {
            try {
              const r = await fetch(ep, { method: "POST", body: "data=" + encodeURIComponent(q) });
              if (r.ok) { raw = await r.json(); break; }
            } catch { /* try next */ }
          }
          if (!raw) throw new Error("Overpass unavailable");
          dataRef.current = raw;

          const lines = L.layerGroup();
          const stations = L.layerGroup();
          const labels = L.layerGroup();
          const numbers = L.layerGroup();

          const nodeMap: Record<number, { lat: number; lon: number; tags?: Record<string, string> }> = {};
          const nameLines: Record<string, Array<{ ref: string; color: string; isRER: boolean }>> = {};
          const stationList: Array<{ lat: number; lng: number; name: string; isRER: boolean }> = [];

          raw.elements.forEach((el) => {
            if (el.type === "node") {
              nodeMap[el.id] = el as typeof nodeMap[number];
              if (el.tags?.railway === "station") {
                const isRER = !!(el.tags.network && /RER/.test(el.tags.network));
                stationList.push({ lat: el.lat!, lng: el.lon!, name: el.tags.name || "", isRER });
              }
            }
          });

          raw.elements.forEach((el) => {
            if (el.type !== "relation" || !el.members || !el.tags) return;
            const ref = el.tags.ref || "";
            const isRER = !!(el.tags.network && /RER/.test(el.tags.network));
            const color = isRER ? (RER_COLORS[ref] || "#E2231A") : (METRO_COLORS[ref] || "#003CA6");
            el.members.forEach((m) => {
              if (m.type === "way" && m.geometry && m.geometry.length > 1) {
                L.polyline(m.geometry.map((p) => [p.lat, p.lon] as [number, number]), {
                  color, weight: isRER ? 4 : 3, opacity: 0.55, interactive: false,
                }).addTo(lines);
              }
              if (m.type !== "node") return;
              const nd = nodeMap[m.ref!];
              if (!nd?.tags?.name) return;
              const nm = nd.tags.name;
              if (!nameLines[nm]) nameLines[nm] = [];
              if (!nameLines[nm].some((l) => l.ref === ref && l.isRER === isRER)) {
                nameLines[nm].push({ ref, color, isRER });
              }
            });
          });

          const seen = new Set<string>();
          stationList.forEach((st) => {
            if (!st.name || seen.has(st.name)) return;
            seen.add(st.name);
            L.circleMarker([st.lat, st.lng], {
              radius: st.isRER ? 5 : 4,
              fillColor: st.isRER ? "#E2231A" : "#1a1a6c",
              color: "#fff", weight: 1.5, fillOpacity: 0.9, interactive: false,
            }).addTo(stations);

            const stLines = (nameLines[st.name] || []).sort((a, b) => {
              if (a.isRER !== b.isRER) return a.isRER ? 1 : -1;
              return (parseInt(a.ref) || 99) - (parseInt(b.ref) || 99);
            });

            const labelHtml = esc(st.name) + " " + stLines.map(badgeHtml).join("");
            L.marker([st.lat, st.lng], {
              interactive: false, opacity: 0,
              icon: L.divIcon({ className: "transit-label-anchor", iconSize: [0, 0] }),
            }).bindTooltip(labelHtml, { permanent: true, direction: "right", offset: [8, 0], className: "transit-tooltip" }).addTo(labels);

            if (stLines.length) {
              const numHtml = stLines.map(badgeHtml).join("");
              L.marker([st.lat, st.lng], {
                interactive: false, opacity: 0,
                icon: L.divIcon({ className: "transit-label-anchor", iconSize: [0, 0] }),
              }).bindTooltip(numHtml, { permanent: true, direction: "right", offset: [8, 0], className: "transit-tooltip" }).addTo(numbers);
            }
          });

          layersRef.current = { lines, stations, labels, numbers };
        } catch {
          setLoading(false);
          return;
        }
        setLoading(false);
      }

      if (layersRef.current[type]) map.addLayer(layersRef.current[type]!);
      setVisible((v) => ({ ...v, [type]: true }));
    },
    [getLeaflet, mapRef, visible, loading]
  );

  if (view !== "map") return null;

  const btns: { type: LayerType; label: string }[] = [
    { type: "lines", label: "🛤️ Lignes" },
    { type: "stations", label: "⬤ Stations" },
    { type: "labels", label: "🏷️ Noms" },
    { type: "numbers", label: "#️⃣ Numéros" },
  ];

  return (
    <div className="fixed bottom-[60px] right-[50px] z-[900] flex rounded-[var(--radius)] overflow-hidden shadow-sm">
      {btns.map((b) => (
        <button
          key={b.type}
          onClick={() => toggle(b.type)}
          disabled={loading}
          aria-pressed={visible[b.type]}
          className={`px-3.5 py-2 border border-border border-r-0 last:border-r bg-white text-[11px] font-semibold cursor-pointer transition-colors ${
            visible[b.type]
              ? "!bg-[var(--map-transit)] !text-white !border-[var(--map-transit)]"
              : "text-black/65 hover:bg-surface-hover"
          } disabled:opacity-60 disabled:cursor-wait`}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
