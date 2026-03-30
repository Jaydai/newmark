"use client";

import dynamic from "next/dynamic";
import type { OffreRetail } from "@/lib/types";
import type { Map as LeafletMap } from "leaflet";

const OrMapInner = dynamic(() => import("./or-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-surface" style={{ top: "var(--bar-h)" }}>
      <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  ),
});

interface OrMapContainerProps {
  data: OffreRetail[];
  fitTrigger: number;
  onSelect: (item: OffreRetail) => void;
  mapRef: React.MutableRefObject<LeafletMap | null>;
  sidebarWidth: number;
  analyticsWidth: number;
}

export default function OrMapContainer(props: OrMapContainerProps) {
  return <OrMapInner {...props} />;
}
