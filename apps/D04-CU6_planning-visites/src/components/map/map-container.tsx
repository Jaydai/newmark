"use client";

import dynamic from "next/dynamic";
import type { Visit, RouteSegment } from "@/lib/types";
import L from "leaflet";

const MapInner = dynamic(() => import("./map-inner"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-surface" style={{ top: "var(--bar-h)" }}>
      <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  ),
});

interface MapContainerWrapperProps {
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

export default function MapContainerWrapper(props: MapContainerWrapperProps) {
  return <MapInner {...props} />;
}
