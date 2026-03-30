"use client";

import type { Asset, Comparable } from "@/lib/types";
import { hasCoords } from "@/lib/geocode";
import { MapPin, Plus, Upload } from "lucide-react";

interface MapStateCardProps {
  actif: Asset | null;
  comps: Comparable[];
  onOpenAsset: () => void;
  onOpenComp: () => void;
}

export default function MapStateCard({ actif, comps, onOpenAsset, onOpenComp }: MapStateCardProps) {
  const compCount = comps.filter((c) => hasCoords(c.lat, c.lng)).length;

  if (actif && compCount > 0) return null;

  return (
    <div className="fixed top-[calc(var(--bar-h)+16px)] left-1/2 z-[900] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 rounded-xl border border-border bg-white p-4 text-center shadow-lg sm:top-[calc(var(--bar-h)+20px)] sm:p-5">
      {!actif ? (
        <>
          <MapPin className="w-8 h-8 text-map-green mx-auto mb-3 opacity-50" />
          <div className="text-sm font-semibold mb-1">Aucun actif défini</div>
          <div className="text-[11px] text-text-secondary mb-4">
            Commencez par définir l&apos;actif à commercialiser.
          </div>
          <button
            onClick={onOpenAsset}
            className="px-5 py-2 bg-primary text-white border-none rounded-lg text-[11px] font-semibold cursor-pointer hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-3.5 h-3.5 inline mr-1.5" />
            Définir l&apos;actif
          </button>
        </>
      ) : (
        <>
          <Upload className="w-8 h-8 text-map-blue mx-auto mb-3 opacity-50" />
          <div className="text-sm font-semibold mb-1">Ajoutez des comparables</div>
          <div className="text-[11px] text-text-secondary mb-4">
            Ajoutez des transactions comparables pour enrichir la carte.
          </div>
          <button
            onClick={onOpenComp}
            className="px-5 py-2 bg-accent text-white border-none rounded-lg text-[11px] font-semibold cursor-pointer hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 inline mr-1.5" />
            Ajouter un comparable
          </button>
        </>
      )}
    </div>
  );
}
