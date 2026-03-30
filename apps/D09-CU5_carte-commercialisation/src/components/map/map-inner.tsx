"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, LayersControl, Marker, Popup, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import type { Asset, Comparable } from "@/lib/types";
import { hasCoords } from "@/lib/geocode";

const HTML_ESCAPE_LOOKUP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPE_LOOKUP[char]);
}

function makeIcon(cssColor: string, size: number, className?: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="${className || ""}" style="width:${size}px;height:${size}px;border-radius:50%;background:${cssColor};border:3px solid ${cssColor};box-shadow:0 3px 16px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;transition:transform .15s"><div style="width:${Math.round(size * 0.3)}px;height:${Math.round(size * 0.3)}px;border-radius:50%;background:rgba(255,255,255,.9)"></div></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 4],
  });
}

const mainIcon = makeIcon("var(--map-green)", 38, "marker-main");
const compIcon = makeIcon("var(--map-blue)", 26);

function FitBounds({ actif, comps, trigger }: { actif: Asset | null; comps: Comparable[]; trigger: number }) {
  const map = useMap();
  const lastTrigger = useRef(0);
  useEffect(() => {
    if (trigger === lastTrigger.current) return;
    lastTrigger.current = trigger;
    const pts: [number, number][] = [];
    if (actif && hasCoords(actif.lat, actif.lng)) pts.push([actif.lat!, actif.lng!]);
    comps.forEach((c) => { if (hasCoords(c.lat, c.lng)) pts.push([c.lat!, c.lng!]); });
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts).pad(0.15));
    else if (pts.length === 1) map.setView(pts[0], 15);
  }, [trigger, actif, comps, map]);
  return null;
}

function MapRefSetter({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

interface MapInnerProps {
  actif: Asset | null;
  comps: Comparable[];
  fitTrigger: number;
  onEditAsset: () => void;
  onEditComp: (idx: number) => void;
  onDeleteComp: (idx: number) => void;
  mapRef: React.MutableRefObject<L.Map | null>;
}

export default function MapInner({ actif, comps, fitTrigger, onEditAsset, onEditComp, onDeleteComp, mapRef }: MapInnerProps) {
  const mainPopup = useMemo(() => {
    if (!actif) return "";
    const rows = [
      actif.surface && ["Surface", actif.surface],
      actif.prix && ["Prix", actif.prix],
      actif.prixM2 && ["Prix/m²", actif.prixM2],
      actif.rendement && ["Rendement", actif.rendement],
    ].filter(Boolean) as [string, string][];
    const grid = rows.map(([l, v]) => `<div style="text-align:center"><div style="font-size:12px;font-weight:700;color:var(--primary)">${esc(v)}</div><div style="font-size:8px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;margin-top:1px">${l}</div></div>`).join("");
    return `<div style="background:#fff"><div style="background:var(--map-green);color:#fff;padding:13px 16px;font-size:10px;letter-spacing:1.6px;text-transform:uppercase;font-weight:500"><span style="font-size:9px;padding:3px 10px;border-radius:20px;font-weight:700;letter-spacing:.5px;border:1px solid rgba(255,255,255,.3)">À COMMERCIALISER</span>${actif.type ? ` · ${esc(actif.type)}` : ""}</div><div style="padding:13px 16px 4px;font-size:16px;font-weight:700;color:var(--primary);overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(actif.nom)}</div><div style="padding:0 16px 8px;font-size:11px;color:var(--text-secondary)">${esc(actif.adresse)}</div>${rows.length ? `<div style="display:grid;grid-template-columns:repeat(${Math.min(rows.length, 4)},1fr);gap:8px;padding:8px 16px;border-top:1px solid #f0f1f4">${grid}</div>` : ""}${actif.description ? `<div style="padding:8px 16px;font-size:10px;color:var(--text-secondary);border-top:1px solid #f0f1f4">${esc(actif.description)}</div>` : ""}<div style="padding:8px 16px 12px"><button onclick="window.__editRef()" style="font-size:9px;padding:5px 12px;border:none;border-radius:6px;cursor:pointer;font-weight:600;background:var(--primary);color:#fff">✎ Modifier</button></div></div>`;
  }, [actif]);

  const compPopup = useCallback((c: Comparable, idx: number) => {
    const rows = [
      ["Surface", c.surface],
      ["Prix", c.prix],
      ["Prix/m²", c.prixM2],
      ["Taux", c.taux],
      ["Acquéreur", c.acquereur],
      ["Date", c.date],
    ].filter(([, v]) => v);
    const rowsHtml = rows.map(([l, v]) => `<div style="display:flex;justify-content:space-between;padding:6px 14px;border-top:1px solid #f0f1f4;font-size:10px"><span style="color:var(--text-secondary)">${l}</span><span style="font-weight:600">${esc(v)}</span></div>`).join("");
    return `<div style="background:#fff"><div style="background:var(--map-blue);color:#fff;padding:11px 14px;font-size:9px;letter-spacing:1.4px;text-transform:uppercase;font-weight:500">✓ Comparable</div><div style="padding:11px 14px 4px;font-size:14px;font-weight:700;color:var(--primary);overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(c.nom)}</div><div style="padding:0 14px 8px;font-size:10px;color:var(--text-secondary)">${esc(c.adresse)}</div>${rowsHtml}<div style="padding:8px 14px 12px;display:flex;gap:8px"><button onclick="window.__editComp(${idx})" style="font-size:9px;padding:5px 12px;border:none;border-radius:6px;cursor:pointer;font-weight:600;background:var(--primary);color:#fff">✎ Modifier</button><button onclick="window.__deleteComp(${idx})" style="font-size:9px;padding:5px 12px;border:none;border-radius:6px;cursor:pointer;font-weight:600;background:var(--danger-bg);color:var(--danger)">✕</button></div></div>`;
  }, []);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    w.__editComp = (idx: number) => onEditComp(idx);
    w.__deleteComp = (idx: number) => onDeleteComp(idx);
    w.__editRef = () => onEditAsset();
    return () => { delete w.__editComp; delete w.__deleteComp; delete w.__editRef; };
  }, [onEditComp, onDeleteComp, onEditAsset]);

  return (
    <MapContainer id="map" data-map-root center={[48.8566, 2.3522]} zoom={13} zoomControl={false} preferCanvas className="absolute inset-0" style={{ top: "var(--bar-h)" }}>
      <MapRefSetter mapRef={mapRef} />
      <FitBounds actif={actif} comps={comps} trigger={fitTrigger} />
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Plan">
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution="&copy; OSM &copy; CARTO" maxZoom={19} />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Plan contraste">
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution="&copy; OSM &copy; CARTO" maxZoom={19} />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Plan Sombre">
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; OSM &copy; CARTO" maxZoom={19} />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satellite">
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="&copy; Esri" maxZoom={19} />
        </LayersControl.BaseLayer>
      </LayersControl>
      <ZoomControl position="bottomright" />
      {actif && hasCoords(actif.lat, actif.lng) && (
        <Marker position={[actif.lat!, actif.lng!]} icon={mainIcon} zIndexOffset={1000}>
          <Popup maxWidth={300}><div dangerouslySetInnerHTML={{ __html: mainPopup }} /></Popup>
        </Marker>
      )}
      {comps.map((c, i) =>
        hasCoords(c.lat, c.lng) ? (
          <Marker key={`comp-${i}`} position={[c.lat!, c.lng!]} icon={compIcon}>
            <Popup maxWidth={260}><div dangerouslySetInnerHTML={{ __html: compPopup(c, i) }} /></Popup>
          </Marker>
        ) : null
      )}
    </MapContainer>
  );
}
