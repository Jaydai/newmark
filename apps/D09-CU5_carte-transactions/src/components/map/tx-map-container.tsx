"use client";

import dynamic from "next/dynamic";
import type { Transaction } from "@/lib/types";
import type { Map as LeafletMap } from "leaflet";

const TxMapInner = dynamic(() => import("./tx-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-surface" style={{ top: "var(--bar-h)" }}>
      <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  ),
});

interface TxMapContainerProps {
  data: Transaction[];
  fitTrigger: number;
  onSelect: (tx: Transaction) => void;
  mapRef: React.MutableRefObject<LeafletMap | null>;
  sidebarWidth: number;
  analyticsWidth: number;
}

export default function TxMapContainer(props: TxMapContainerProps) {
  return <TxMapInner {...props} />;
}
