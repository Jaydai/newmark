"use client";

import type { ViewMode } from "@/lib/types";
import { Plus, Pencil } from "lucide-react";

interface ActionButtonsProps {
  view: ViewMode;
  hasAsset: boolean;
  onOpenAsset: () => void;
  onOpenComp: () => void;
}

export default function ActionButtons({
  view,
  hasAsset,
  onOpenAsset,
  onOpenComp,
}: ActionButtonsProps) {
  if (view !== "map") return null;

  const MainIcon = hasAsset ? Pencil : Plus;
  const mainTitle = hasAsset ? "Modifier l'actif" : "Définir l'actif";

  return (
    <div className="fixed bottom-5 right-5 z-[900] flex flex-col gap-2.5">
      <button
        onClick={onOpenAsset}
        className="w-12 h-12 rounded-full bg-map-green text-white border-none shadow-lg flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
        title={mainTitle}
      >
        <MainIcon className="w-5 h-5" />
      </button>
      <button
        onClick={onOpenComp}
        className="w-12 h-12 rounded-full bg-map-blue text-white border-none shadow-lg flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
        title="Ajouter un comparable"
      >
        <Plus className="w-5 h-5" />
      </button>
    </div>
  );
}
