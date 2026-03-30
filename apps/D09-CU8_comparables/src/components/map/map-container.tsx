"use client";

import dynamic from "next/dynamic";
import type { Reference, Comparable } from "@/lib/types";
import type { Map as LeafletMap } from "leaflet";

const MapInner = dynamic(() => import("./map-inner"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-surface" style={{ top: "var(--bar-h)" }}>
      <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  ),
});

interface MapContainerWrapperProps {
  actif: Reference | null;
  comps: Comparable[];
  fitTrigger: number;
  onEditReference: () => void;
  onEditComp: (idx: number) => void;
  onDeleteComp: (idx: number) => void;
  mapRef: React.MutableRefObject<LeafletMap | null>;
}

export default function MapContainerWrapper(props: MapContainerWrapperProps) {
  return <MapInner {...props} />;
}
