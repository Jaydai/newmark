"use client";

import type { Reference, Comparable } from "@/lib/types";
import { hasCoords } from "@/lib/geocode";

interface MapStateCardProps {
  actif: Reference | null;
  comps: Comparable[];
  onOpenReference: () => void;
  onOpenImport: () => void;
  onOpenComp: () => void;
}

export default function MapStateCard({
  actif,
  comps,
  onOpenReference,
  onOpenImport,
  onOpenComp,
}: MapStateCardProps) {
  const hasRef = actif && hasCoords(actif.lat, actif.lng);
  const hasComps = comps.some((c) => hasCoords(c.lat, c.lng));

  if (hasRef && hasComps) return null;

  let title = "";
  let text = "";
  let actions: React.ReactNode = null;

  if (!hasRef && !hasComps) {
    title = "Commencez par définir une référence";
    text = "Ajoutez l'adresse de référence, puis importez ou saisissez vos comparables pour construire la carte.";
    actions = (
      <>
        <button onClick={onOpenReference} className="msc-btn primary">
          Définir la référence
        </button>
        <button onClick={onOpenImport} className="msc-btn">
          Importer Excel
        </button>
      </>
    );
  } else if (hasRef && !hasComps) {
    title = "Ajoutez vos comparables";
    text = "La référence est prête. Importez maintenant un fichier Excel ou ajoutez les comparables un par un.";
    actions = (
      <>
        <button onClick={onOpenImport} className="msc-btn primary">
          Importer Excel
        </button>
        <button onClick={onOpenComp} className="msc-btn">
          Ajouter manuellement
        </button>
      </>
    );
  } else if (!hasRef && hasComps) {
    const count = comps.filter((c) => hasCoords(c.lat, c.lng)).length;
    title = "Définissez la référence";
    text = `${count} comparable${count > 1 ? "s sont" : " est"} déjà chargé${count > 1 ? "s" : ""}. Ajoutez l'adresse de référence pour cadrer la lecture.`;
    actions = (
      <>
        <button onClick={onOpenReference} className="msc-btn primary">
          Définir la référence
        </button>
        <button onClick={onOpenImport} className="msc-btn">
          Importer un autre fichier
        </button>
      </>
    );
  }

  return (
    <div className="fixed z-[905] max-w-[360px] bg-white border border-border rounded-[var(--radius)] p-4 shadow-[0_10px_30px_rgba(0,0,0,.1)]" style={{ top: "calc(var(--bar-h) + 16px)", left: "24px" }}>
      <div className="text-[8px] font-bold tracking-[1.3px] uppercase text-black/45 mb-2">
        Configuration
      </div>
      <div className="text-lg font-bold text-primary leading-tight">{title}</div>
      <div className="mt-2 text-[11px] leading-relaxed text-text-secondary">
        {text}
      </div>
      <div className="flex gap-2 flex-wrap mt-3.5">
        <style jsx>{`
          .msc-btn {
            padding: 9px 14px;
            border-radius: 9px;
            border: 1px solid var(--border-input);
            background: #fff;
            color: var(--text-secondary);
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
            font-family: inherit;
            transition: all 0.15s;
          }
          .msc-btn:hover {
            border-color: #aaa;
            color: #000;
          }
          .msc-btn.primary {
            background: var(--primary);
            border-color: var(--primary);
            color: #fff;
          }
          .msc-btn.primary:hover {
            background: var(--primary-hover);
            border-color: var(--primary-hover);
          }
        `}</style>
        {actions}
      </div>
    </div>
  );
}
