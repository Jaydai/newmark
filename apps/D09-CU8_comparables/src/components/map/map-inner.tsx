"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  LayersControl,
  Marker,
  Popup,
  ZoomControl,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Reference, Comparable } from "@/lib/types";
import { hasCoords } from "@/lib/geocode";
import { fmtSurface, fmtLoyer } from "@/lib/format";

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

// Custom icons using the map color vars
function makeIcon(
  cssColor: string,
  size: number,
  className?: string
): L.DivIcon {
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

interface FitBoundsProps {
  actif: Reference | null;
  comps: Comparable[];
  trigger: number;
}

function FitBounds({ actif, comps, trigger }: FitBoundsProps) {
  const map = useMap();
  const lastTrigger = useRef(0);

  useEffect(() => {
    if (trigger === lastTrigger.current) return;
    lastTrigger.current = trigger;

    const pts: [number, number][] = [];
    if (actif && hasCoords(actif.lat, actif.lng))
      pts.push([actif.lat!, actif.lng!]);
    comps.forEach((c) => {
      if (hasCoords(c.lat, c.lng)) pts.push([c.lat!, c.lng!]);
    });

    if (pts.length > 1) {
      map.fitBounds(L.latLngBounds(pts).pad(0.15));
    } else if (pts.length === 1) {
      map.setView(pts[0], 15);
    }
  }, [trigger, actif, comps, map]);

  return null;
}

interface MapInnerProps {
  actif: Reference | null;
  comps: Comparable[];
  fitTrigger: number;
  onEditReference: () => void;
  onEditComp: (idx: number) => void;
  onDeleteComp: (idx: number) => void;
  mapRef: React.MutableRefObject<L.Map | null>;
}

function MapRefSetter({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
}

export default function MapInner({
  actif,
  comps,
  fitTrigger,
  onEditReference,
  onEditComp,
  onDeleteComp,
  mapRef,
}: MapInnerProps) {
  const mainPopupContent = useMemo(() => {
    if (!actif) return "";
    return `<div style="background:#fff"><div style="background:var(--map-green);color:#fff;padding:13px 16px;font-size:10px;letter-spacing:1.6px;text-transform:uppercase;display:flex;align-items:center;gap:10px;font-weight:500"><span style="background:var(--map-green);color:#fff;font-size:9px;padding:3px 10px;border-radius:20px;font-weight:700;letter-spacing:.5px">RÉFÉRENCE</span></div><div style="padding:13px 16px 4px;font-size:16px;font-weight:700;color:var(--primary)">${esc(actif.nom)}</div><div style="padding:0 16px 10px;font-size:11px;color:var(--text-secondary)">${esc(actif.adresse)}</div></div>`;
  }, [actif]);

  const compPopupContent = useCallback(
    (c: Comparable, idx: number) => {
      return `<div style="background:#fff"><div style="background:var(--map-blue);color:#fff;padding:11px 14px;font-size:9px;letter-spacing:1.4px;text-transform:uppercase;font-weight:500">✓ Comparable</div><div style="padding:11px 14px 4px;font-size:14px;font-weight:700;color:var(--primary)">${esc(c.preneur)}</div><div style="padding:0 14px 8px;font-size:10px;color:var(--text-secondary)">${esc(c.adresse)}</div><div style="display:flex;justify-content:space-between;padding:6px 14px;border-top:1px solid #f0f1f4;font-size:10px"><span style="color:var(--text-secondary)">Date</span><span style="font-weight:600">${esc(c.date || "-")}</span></div><div style="display:flex;justify-content:space-between;padding:6px 14px;border-top:1px solid #f0f1f4;font-size:10px"><span style="color:var(--text-secondary)">Surface</span><span style="font-weight:600">${esc(fmtSurface(c.surface))}</span></div><div style="display:flex;justify-content:space-between;padding:6px 14px;border-top:1px solid #f0f1f4;font-size:10px"><span style="color:var(--text-secondary)">État</span><span style="font-weight:600">${esc(c.etat || "-")}</span></div><div style="display:flex;justify-content:space-between;padding:6px 14px;border-top:1px solid #f0f1f4;font-size:10px"><span style="color:var(--text-secondary)">Loyer/m²</span><span style="font-weight:600">${esc(fmtLoyer(c.loyer))}</span></div><div style="padding:8px 14px 12px;display:flex;gap:8px"><button onclick="window.__editComp(${idx})" style="font-size:9px;padding:5px 12px;border:none;border-radius:6px;cursor:pointer;font-weight:600;background:var(--primary);color:#fff">✎ Modifier</button><button onclick="window.__deleteComp(${idx})" style="font-size:9px;padding:5px 12px;border:none;border-radius:6px;cursor:pointer;font-weight:600;background:var(--danger-bg);color:var(--danger)">✕</button></div></div>`;
    },
    []
  );

  // Expose callbacks to popup buttons via window globals
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    w.__editComp = (idx: number) => onEditComp(idx);
    w.__deleteComp = (idx: number) => onDeleteComp(idx);
    w.__editRef = () => onEditReference();
    return () => {
      delete w.__editComp;
      delete w.__deleteComp;
      delete w.__editRef;
    };
  }, [onEditComp, onDeleteComp, onEditReference]);

  return (
    <MapContainer
      center={[48.8566, 2.3522]}
      zoom={13}
      zoomControl={false}
      preferCanvas
      className="absolute inset-0"
      style={{ top: "var(--bar-h)" }}
    >
      <MapRefSetter mapRef={mapRef} />
      <FitBounds actif={actif} comps={comps} trigger={fitTrigger} />

      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Plan">
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; OSM &copy; CARTO"
            maxZoom={19}
            crossOrigin={true}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Plan Sombre">
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; OSM &copy; CARTO"
            maxZoom={19}
            crossOrigin={true}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satellite">
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="&copy; Esri"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Terrain">
          <TileLayer
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenTopoMap"
            maxZoom={17}
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      <ZoomControl position="bottomright" />

      {/* Reference marker */}
      {actif && hasCoords(actif.lat, actif.lng) && (
        <Marker position={[actif.lat!, actif.lng!]} icon={mainIcon} zIndexOffset={1000}>
          <Popup maxWidth={300}>
            <div dangerouslySetInnerHTML={{ __html: mainPopupContent }} />
          </Popup>
        </Marker>
      )}

      {/* Comparable markers */}
      {comps.map((c, i) =>
        hasCoords(c.lat, c.lng) ? (
          <Marker key={`comp-${i}`} position={[c.lat!, c.lng!]} icon={compIcon}>
            <Popup maxWidth={260}>
              <div
                dangerouslySetInnerHTML={{ __html: compPopupContent(c, i) }}
              />
            </Popup>
          </Marker>
        ) : null
      )}
    </MapContainer>
  );
}
