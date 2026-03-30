"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, LayersControl, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import type { Transaction } from "@/lib/types";
import { hasCoords } from "@/lib/geocode";

function makeCircleIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="width:22px;height:22px;border-radius:50%;background:var(--map-blue);border:2.5px solid #fff;box-shadow:0 3px 16px rgba(0,50,90,.6)"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14],
  });
}

const txIcon = makeCircleIcon();

function MapRefSetter({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

function FitBounds({ data, trigger }: { data: Transaction[]; trigger: number }) {
  const map = useMap();
  const lastTrigger = useRef(0);
  useEffect(() => {
    if (!trigger || trigger === lastTrigger.current) return;
    lastTrigger.current = trigger;
    const pts: [number, number][] = data.filter((t) => hasCoords(t.lat, t.lng)).map((t) => [t.lat!, t.lng!]);
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts).pad(0.15));
    else if (pts.length === 1) map.setView(pts[0], 15);
  }, [trigger, data, map]);
  return null;
}

function LayoutInvalidator({ sidebarWidth, analyticsWidth }: { sidebarWidth: number; analyticsWidth: number }) {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 180);
    return () => window.clearTimeout(timer);
  }, [analyticsWidth, map, sidebarWidth]);

  return null;
}

interface TxMapInnerProps {
  data: Transaction[];
  fitTrigger: number;
  onSelect: (tx: Transaction) => void;
  mapRef: React.MutableRefObject<L.Map | null>;
  sidebarWidth: number;
  analyticsWidth: number;
}

export default function TxMapInner({ data, fitTrigger, onSelect, mapRef, sidebarWidth, analyticsWidth }: TxMapInnerProps) {
  const markers = useMemo(() => {
    return data.filter((tx) => hasCoords(tx.lat, tx.lng));
  }, [data]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    map.eachLayer((l) => { if (l instanceof L.Marker) map.removeLayer(l); });

    markers.forEach((tx) => {
      const m = L.marker([tx.lat!, tx.lng!], { icon: txIcon }).addTo(map);
      m.on("click", () => onSelect(tx));
    });
  }, [markers, mapRef, onSelect]);

  return (
    <div
      className="absolute inset-0"
      style={{
        top: "var(--bar-h)",
        left: `${sidebarWidth}px`,
        right: `${analyticsWidth}px`,
      }}
    >
      <MapContainer
        center={[48.8566, 2.3522]}
        zoom={13}
        zoomControl={false}
        preferCanvas
        className="absolute inset-0"
      >
        <MapRefSetter mapRef={mapRef} />
        <LayoutInvalidator sidebarWidth={sidebarWidth} analyticsWidth={analyticsWidth} />
        <FitBounds data={data} trigger={fitTrigger} />
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
              crossOrigin={true}
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        <ZoomControl position="bottomright" />
      </MapContainer>
    </div>
  );
}
