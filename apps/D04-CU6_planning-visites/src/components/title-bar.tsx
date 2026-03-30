"use client";

import Image from "next/image";
import type { Visit, RouteSegment, ViewMode } from "@/lib/types";
import { formatDuration } from "@/lib/time-utils";

interface TitleBarProps {
  visits: Visit[];
  routes: (RouteSegment | null)[];
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  themePickerSlot?: React.ReactNode;
}

export default function TitleBar({
  visits,
  routes,
  view,
  onViewChange,
  themePickerSlot,
}: TitleBarProps) {
  const n = visits.length;
  const totalVisitMin = visits.reduce((s, v) => s + v.duration, 0);
  const totalTravelMin = routes.reduce((s, r) => s + (r ? r.duration : 0), 0);
  const totalDist = routes.reduce((s, r) => s + (r ? parseFloat(r.distance) : 0), 0);
  const totalMin = totalVisitMin + totalTravelMin;

  return (
    <div
      data-titlebar
      className="fixed top-0 left-0 right-0 h-[var(--bar-h)] bg-white border-b border-border text-primary px-6 z-[1000] flex items-center gap-5"
    >
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
          Planning de Visites
        </div>
      </div>

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

      <div className="shrink-0 text-right flex items-center gap-3.5">
        {themePickerSlot}
        {n > 0 && (
          <div>
            <div className="text-xs font-semibold tracking-wide">
              {n} visite{n > 1 ? "s" : ""} · {formatDuration(totalMin)}
            </div>
            <div className="text-[10.5px] text-black/55">
              {formatDuration(totalTravelMin)} de trajet · {totalDist.toFixed(1)} km
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
