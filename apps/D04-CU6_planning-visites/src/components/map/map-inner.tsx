"use client";

import { useEffect, useMemo, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  LayersControl,
  Marker,
  Popup,
  ZoomControl,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Visit, RouteSegment } from "@/lib/types";
import { hasCoords } from "@/lib/geocode";

function makeNumIcon(n: number | string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="num-marker">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -18],
  });
}

interface FitBoundsProps {
  visits: Visit[];
  trigger: number;
}

function FitBounds({ visits, trigger }: FitBoundsProps) {
  const map = useMap();
  useEffect(() => {
    if (trigger === 0) return;
    const pts: [number, number][] = [];
    visits.forEach((v) => {
      if (hasCoords(v.lat, v.lng)) pts.push([v.lat!, v.lng!]);
    });
    if (pts.length > 1) {
      map.fitBounds(L.latLngBounds(pts).pad(0.15));
    } else if (pts.length === 1) {
      map.setView(pts[0], 15);
    }
  }, [trigger, visits, map]);
  return null;
}

interface MapRefSetterProps {
  mapRef: React.MutableRefObject<L.Map | null>;
}

function MapRefSetter({ mapRef }: MapRefSetterProps) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
}

interface MapClickHandlerProps {
  onMapClick: (lat: number, lng: number) => void;
  panelOpen: boolean;
}

function MapClickHandler({ onMapClick, panelOpen }: MapClickHandlerProps) {
  const map = useMap();
  useEffect(() => {
    const handler = (e: L.LeafletMouseEvent) => {
      if (panelOpen) return;
      onMapClick(
        parseFloat(e.latlng.lat.toFixed(6)),
        parseFloat(e.latlng.lng.toFixed(6))
      );
    };
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [map, onMapClick, panelOpen]);
  return null;
}

function esc(s: string) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

interface MapInnerProps {
  visits: Visit[];
  routes: (RouteSegment | null)[];
  fitTrigger: number;
  themeVersion: number;
  onEditVisit: (idx: number) => void;
  onMapClick: (lat: number, lng: number) => void;
  panelOpen: boolean;
  mapRef: React.MutableRefObject<L.Map | null>;
  sidebarVisible: boolean;
}

export default function MapInner({
  visits,
  routes,
  fitTrigger,
  themeVersion,
  onEditVisit,
  onMapClick,
  panelOpen,
  mapRef,
  sidebarVisible,
}: MapInnerProps) {
  const popupContent = useCallback(
    (v: Visit, i: number) => {
      return `<div style="padding:12px;font-family:'DM Sans',system-ui,sans-serif"><div style="font-size:14px;font-weight:700;color:#000;margin-bottom:3px">${esc(v.name)}</div><div style="font-size:10px;color:var(--text-tertiary);margin-bottom:8px">${esc(v.address)}</div>${v.arrival ? `<div style="font-size:11px;margin-bottom:2px"><b>Arrivée:</b> ${v.arrival}</div>` : ""}${v.departure ? `<div style="font-size:11px;margin-bottom:2px"><b>Départ:</b> ${v.departure}</div>` : ""}<div style="font-size:11px"><b>Durée:</b> ${v.duration} min</div><div style="margin-top:8px"><button onclick="window.__editVisit(${i})" style="font-size:9px;padding:5px 12px;border:none;border-radius:6px;cursor:pointer;font-weight:600;background:var(--primary);color:#fff">✎ Modifier</button></div></div>`;
    },
    []
  );

  // Expose edit callback to popup buttons
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    w.__editVisit = (idx: number) => onEditVisit(idx);
    return () => {
      delete w.__editVisit;
    };
  }, [onEditVisit]);

  const routeCoords = useMemo(() => {
    return routes.map((r) => {
      if (!r?.geometry?.coordinates) return null;
      return r.geometry.coordinates.map(
        (c: number[]) => [c[1], c[0]] as [number, number]
      );
    });
  }, [routes]);

  const routeTheme = useMemo(() => {
    if (typeof window === "undefined") {
      return { color: "#0062ae" };
    }
    const styles = getComputedStyle(document.documentElement);
    return {
      color: styles.getPropertyValue("--map-blue").trim() || "#0062ae",
    };
  }, [themeVersion]);

  return (
    <MapContainer
      id="map"
      center={[48.8566, 2.3522]}
      zoom={13}
      zoomControl={false}
      className="absolute inset-0"
      data-map-root
      style={{
        top: "var(--bar-h)",
        left: sidebarVisible ? "var(--sidebar-w)" : "0",
        width: sidebarVisible ? "calc(100% - var(--sidebar-w))" : "100%",
        transition: "left .4s cubic-bezier(.4,0,.2,1), width .4s cubic-bezier(.4,0,.2,1)",
      }}
    >
      <MapRefSetter mapRef={mapRef} />
      <FitBounds visits={visits} trigger={fitTrigger} />
      <MapClickHandler onMapClick={onMapClick} panelOpen={panelOpen} />

      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Plan">
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; OSM &copy; CARTO"
            maxZoom={19}
            crossOrigin="anonymous"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Plan Sombre">
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; OSM &copy; CARTO"
            maxZoom={19}
            crossOrigin="anonymous"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satellite">
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="&copy; Esri"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      <ZoomControl position="bottomright" />

      {/* Route polylines */}
      {routeCoords.map((coords, i) =>
        coords ? (
          <Polyline
            key={`route-${i}`}
            positions={coords}
            pathOptions={{
              color: routeTheme.color,
              weight: 3,
              dashArray: "8 6",
              opacity: 0.7,
            }}
          />
        ) : null
      )}

      {/* Visit markers */}
      {visits.map((v, i) =>
        hasCoords(v.lat, v.lng) ? (
          <Marker
            key={`visit-${i}`}
            position={[v.lat!, v.lng!]}
            icon={makeNumIcon(i + 1)}
          >
            <Popup maxWidth={260}>
              <div
                dangerouslySetInnerHTML={{ __html: popupContent(v, i) }}
              />
            </Popup>
          </Marker>
        ) : null
      )}
    </MapContainer>
  );
}
