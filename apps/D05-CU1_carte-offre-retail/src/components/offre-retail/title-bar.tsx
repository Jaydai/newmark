"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ViewMode } from "@/lib/types";
import { resolveMapsBackHref } from "@/lib/navigation";
import { ArrowLeft, BarChart3 } from "lucide-react";

interface TitleBarProps {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  analyticsOpen: boolean;
  onToggleAnalytics: () => void;
  themePickerSlot?: React.ReactNode;
}

export default function ORTitleBar({
  view, onViewChange, analyticsOpen, onToggleAnalytics, themePickerSlot,
}: TitleBarProps) {
  const searchParams = useSearchParams();
  const backHref = resolveMapsBackHref(searchParams.get("from") === "hub");

  return (
    <div className="fixed top-0 left-0 right-0 h-[var(--bar-h)] bg-white border-b border-border text-primary px-4 z-[1000] flex items-center gap-4">
      <div className="shrink-0 flex items-center gap-3">
        <Link href={backHref} className="text-text-tertiary hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <Image src="/newmark-logo.svg" alt="Newmark" width={100} height={24} priority className="h-5 w-auto" />
          <div className="text-[9px] text-black/50 tracking-[1.2px] uppercase mt-0.5 font-medium">
            Offre Retail
          </div>
        </div>
      </div>

      {/* View switch */}
      <div className="flex-1 flex justify-center">
        <div className="flex gap-0.5 bg-black/[.06] p-0.5 rounded-[10px] border border-black/[.06]">
          {(["map", "bubbles"] as const).map((v) => (
            <button key={v}
              className={`px-4 py-1.5 border-none rounded-lg text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-all ${
                view === v ? "bg-primary text-white shadow-md" : "bg-transparent text-black/65 hover:text-primary hover:bg-black/[.06]"
              }`}
              onClick={() => onViewChange(v)} aria-pressed={view === v}>
              {v === "map" ? "🗺️ Carte" : "◎ Bulles"}
            </button>
          ))}
        </div>
      </div>

      {/* Right controls */}
      <div className="shrink-0 flex items-center gap-3">
        {themePickerSlot}
        <button
          onClick={onToggleAnalytics}
          className={`flex items-center gap-1.5 px-3 py-1.5 border-[1.5px] rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
            analyticsOpen
              ? "bg-accent text-white border-accent"
              : "bg-transparent border-border-input text-text-secondary hover:border-black/40 hover:text-foreground"
          }`}>
          <BarChart3 className="w-3.5 h-3.5" />
          Analyse
        </button>
      </div>
    </div>
  );
}
