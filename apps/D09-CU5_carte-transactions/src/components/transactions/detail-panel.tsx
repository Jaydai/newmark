"use client";

import SidePanel from "@/components/side-panel";
import type { Transaction } from "@/lib/types";
import { fmtSurface, fmtLoyer, fmtEuro, fmtNumber } from "@/lib/format";

interface DetailPanelProps {
  open: boolean;
  onClose: () => void;
  tx: Transaction | null;
  onEdit: () => void;
  onDelete: () => void;
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-border/30 text-[10px]">
      <span className="text-text-secondary">{label}</span>
      <span className="font-semibold text-primary max-w-[60%] text-right">{value}</span>
    </div>
  );
}

export default function DetailPanel({ open, onClose, tx, onEdit, onDelete }: DetailPanelProps) {
  if (!tx) return null;

  const addr = [tx.streetNumber, tx.street].filter(Boolean).join(" ");
  const ville = [tx.zipCode, tx.city].filter(Boolean).join(" ");

  return (
    <SidePanel
      open={open}
      title={tx.newTenant || tx.enseigne || "Transaction"}
      onClose={onClose}
      footer={
        <>
          <button onClick={onDelete} className="py-2.5 px-4 border-[1.5px] border-danger/30 rounded-lg bg-transparent text-xs font-semibold text-danger cursor-pointer hover:bg-danger-bg transition-colors">Supprimer</button>
          <button onClick={onClose} className="flex-1 py-2.5 border-[1.5px] border-border-input rounded-lg bg-transparent text-xs font-semibold cursor-pointer hover:bg-surface-hover transition-colors">Fermer</button>
          <button onClick={onEdit} className="flex-1 py-2.5 border-none rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer hover:bg-accent/90 transition-colors">Modifier</button>
        </>
      }
    >
      {/* Identité */}
      <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5">Identité</div>
      <Row label="Année" value={tx.year} />
      <Row label="Type" value={tx.type} />
      <Row label="Nouveau Locataire" value={tx.newTenant} />
      <Row label="Enseigne" value={tx.enseigne} />
      <Row label="Ancien Locataire" value={tx.previousTenant} />
      <Row label="Bailleur" value={tx.landlord} />

      {/* Adresse */}
      <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5 mt-4">Adresse</div>
      <Row label="Adresse" value={addr} />
      <Row label="Ville" value={ville} />
      <Row label="Quartier" value={tx.area} />

      {/* Surfaces */}
      <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5 mt-4">Surfaces</div>
      <Row label="R-2" value={tx.surfaces?.r2 != null ? fmtSurface(tx.surfaces.r2) : undefined} />
      <Row label="R-1 Stockage" value={tx.surfaces?.r1Storage != null ? fmtSurface(tx.surfaces.r1Storage) : undefined} />
      <Row label="R-1 Vente" value={tx.surfaces?.r1SalesArea != null ? fmtSurface(tx.surfaces.r1SalesArea) : undefined} />
      <Row label="RDC" value={tx.surfaces?.rdc != null ? fmtSurface(tx.surfaces.rdc) : undefined} />
      <Row label="R+1" value={tx.surfaces?.r1Plus != null ? fmtSurface(tx.surfaces.r1Plus) : undefined} />
      <Row label="R+2" value={tx.surfaces?.r2Plus != null ? fmtSurface(tx.surfaces.r2Plus) : undefined} />
      <Row label="Autres" value={tx.surfaces?.otherSpaces != null ? fmtSurface(tx.surfaces.otherSpaces) : undefined} />
      <Row label="Surface Totale" value={fmtSurface(tx.totalSurfaceSqm)} />
      <Row label="Surface Pondérée" value={fmtSurface(tx.weightedSurfaceSqm)} />

      {/* Loyers */}
      <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5 mt-4">Loyers</div>
      <Row label="Loyer Facial Annuel" value={fmtEuro(tx.annualHeadlineRent)} />
      <Row label="Pas de Porte / DaB" value={fmtEuro(tx.keyMoney)} />
      <Row label="Loyer/m² Pondéré" value={fmtLoyer(tx.rentSqmWeighted)} />
      <Row label="Loyer/m² Total" value={fmtLoyer(tx.rentSqmTotal)} />
      <Row label="Loyer Révisé" value={fmtEuro(tx.annualRentReviewed)} />
      <Row label="Dernier Loyer Connu" value={fmtEuro(tx.latestRentKnown)} />

      {/* Bail */}
      <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5 mt-4">Bail</div>
      <Row label="Durée" value={tx.leaseDuration} />
      <Row label="Options de Sortie" value={tx.breakOptions} />

      {tx.source && (
        <>
          <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5 mt-4">Source</div>
          <Row label="Source" value={tx.source} />
        </>
      )}
    </SidePanel>
  );
}
