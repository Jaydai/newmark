"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Asset, Comparable, ViewMode } from "@/lib/types";
import { hasCoords } from "@/lib/geocode";
import { resolveMapsBackHref } from "@/lib/navigation";
import { ArrowLeft } from "lucide-react";

interface TitleBarProps {
  actif: Asset | null;
  comps: Comparable[];
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  themePickerSlot?: React.ReactNode;
}

export default function TitleBar({ actif, comps, view, onViewChange, themePickerSlot }: TitleBarProps) {
  const searchParams = useSearchParams();
  const backHref = resolveMapsBackHref(searchParams.get("from") === "hub");
  const compCount = comps.filter((c) => hasCoords(c.lat, c.lng)).length;
  const summaryTitle =
    actif?.nom || (compCount ? `${compCount} comparable${compCount > 1 ? "s" : ""}` : "");
  const summarySubtitle = actif
    ? `${compCount ? `${compCount} comparable${compCount > 1 ? "s" : ""} · ` : ""}${actif.adresse || ""}`
    : compCount
      ? "Définissez l'actif"
      : "";

  return (
    <div className="title-bar fixed top-0 left-0 right-0 h-[var(--bar-h)] bg-white border-b border-border text-primary px-3 sm:px-6 z-[1000] flex items-center gap-2 sm:gap-5">
      <div className="shrink-0 flex items-center gap-2 sm:gap-3 min-w-0">
        <Link href={backHref} className="text-text-tertiary hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="min-w-0">
          <Image src="/newmark-logo.svg" alt="Newmark" width={120} height={28} priority className="h-6 w-auto" />
          <div className="hidden sm:block text-[10px] text-black/50 tracking-[1.5px] uppercase mt-0.5 font-medium">
            Carte de Commercialisation
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex justify-center">
        <div className="flex gap-0.5 bg-black/[.06] p-0.5 rounded-[10px] border border-black/[.06]">
          {(["map", "bubbles"] as const).map((v) => (
            <button
              key={v}
              className={`px-2.5 sm:px-4 py-1.5 border-none rounded-lg text-[10px] sm:text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-all ${
                view === v
                  ? "bg-primary text-white shadow-md"
                  : "bg-transparent text-black/65 hover:text-primary hover:bg-black/[.06]"
              }`}
              onClick={() => onViewChange(v)}
              aria-pressed={view === v}
            >
              <span className="sm:hidden">{v === "map" ? "Carte" : "Bulles"}</span>
              <span className="hidden sm:inline">{v === "map" ? "🗺️ Carte" : "◎ Bulles"}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 text-right flex items-center gap-2 sm:gap-3.5">
        {themePickerSlot}
        {view === "map" && (summaryTitle || summarySubtitle) && (
          <div>
            <div className="hidden lg:block text-xs font-semibold tracking-wide max-w-60 overflow-hidden text-ellipsis whitespace-nowrap">
              {summaryTitle}
            </div>
            <div className="hidden lg:block text-[10.5px] text-black/55 max-w-70 overflow-hidden text-ellipsis whitespace-nowrap">
              {summarySubtitle}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
