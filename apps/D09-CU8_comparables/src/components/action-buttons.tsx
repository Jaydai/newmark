"use client";

import type { ViewMode } from "@/lib/types";

interface ActionButtonsProps {
  view: ViewMode;
  onOpenReference: () => void;
  onOpenImport: () => void;
  onOpenComp: () => void;
}

export default function ActionButtons({
  view,
  onOpenReference,
  onOpenImport,
  onOpenComp,
}: ActionButtonsProps) {
  if (view !== "map") return null;

  return (
    <div className="fixed bottom-6 right-5 flex flex-col gap-2 z-[900] items-stretch">
      <div className="text-[8px] font-bold tracking-[1.3px] uppercase text-black/45 text-right pr-1.5">
        Actions
      </div>
      <button
        onClick={onOpenReference}
        className="px-5 py-2.5 border-none rounded-[10px] text-[11px] font-bold cursor-pointer transition-all duration-200 bg-primary text-white shadow-[0_4px_20px_rgba(0,0,0,.15)] hover:-translate-y-0.5"
      >
        ★ Définir la référence
      </button>
      <button
        onClick={onOpenImport}
        className="px-5 py-2.5 border-none rounded-[10px] text-[11px] font-bold cursor-pointer transition-all duration-200 bg-map-blue text-white shadow-[0_4px_20px_rgba(0,98,174,.25)] hover:-translate-y-0.5"
      >
        📂 Importer Excel
      </button>
      <button
        onClick={onOpenComp}
        className="px-5 py-2.5 border-none rounded-[10px] text-[11px] font-bold cursor-pointer transition-all duration-200 bg-success text-white shadow-[0_4px_20px_var(--map-green-25)] hover:-translate-y-0.5"
      >
        + Ajouter manuellement
      </button>
    </div>
  );
}
