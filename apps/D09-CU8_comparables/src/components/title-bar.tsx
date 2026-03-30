"use client";

import Image from "next/image";
import type { Reference, Comparable, ViewMode } from "@/lib/types";
import { hasCoords } from "@/lib/geocode";

interface TitleBarProps {
  actif: Reference | null;
  comps: Comparable[];
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  themePickerSlot?: React.ReactNode;
}

export default function TitleBar({
  actif,
  comps,
  view,
  onViewChange,
  themePickerSlot,
}: TitleBarProps) {
  const compCount = comps.filter((c) => hasCoords(c.lat, c.lng)).length;

  return (
    <div className="fixed top-0 left-0 right-0 h-[var(--bar-h)] bg-white border-b border-border text-primary px-6 z-[1000] flex items-center gap-5">
      {/* Left */}
      <div className="shrink-0">
        <Image
          src="/newmark-logo.svg"
          alt="Newmark"
          width={120}
          height={28}
          priority
          className="h-6 w-auto"
        />
        <div className="text-[10px] text-black/50 tracking-[1.5px] uppercase mt-0.5 font-medium">
          Carte de Comparables
        </div>
      </div>

      {/* Center — view switch */}
      <div className="flex-1 flex justify-center">
        <div className="flex gap-0.5 bg-black/[.06] p-0.5 rounded-[10px] border border-black/[.06]">
          <button
            className={`px-4 py-1.5 border-none rounded-lg text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-all ${
              view === "map"
                ? "bg-primary text-white shadow-md"
                : "bg-transparent text-black/65 hover:text-primary hover:bg-black/[.06]"
            }`}
            onClick={() => onViewChange("map")}
            aria-pressed={view === "map"}
          >
            🗺️ Carte
          </button>
          <button
            className={`px-4 py-1.5 border-none rounded-lg text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-all ${
              view === "bubbles"
                ? "bg-primary text-white shadow-md"
                : "bg-transparent text-black/65 hover:text-primary hover:bg-black/[.06]"
            }`}
            onClick={() => onViewChange("bubbles")}
            aria-pressed={view === "bubbles"}
          >
            ◎ Bulles
          </button>
        </div>
      </div>

      {/* Right */}
      <div className="shrink-0 text-right flex items-center gap-3.5">
        {themePickerSlot}
        {view === "map" && (
          <div>
            <div className="text-xs font-semibold tracking-wide max-w-60 overflow-hidden text-ellipsis whitespace-nowrap">
              {actif?.nom || (compCount ? `${compCount} comparable${compCount > 1 ? "s" : ""}` : "")}
            </div>
            <div className="text-[10.5px] text-black/55 max-w-70 overflow-hidden text-ellipsis whitespace-nowrap">
              {actif
                ? `${compCount ? `${compCount} comparable${compCount > 1 ? "s" : ""} · ` : ""}${actif.adresse || ""}`
                : compCount
                ? "Définissez la référence"
                : ""}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
