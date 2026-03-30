"use client";

import SidePanel from "@/components/side-panel";
import type { OffreRetail } from "@/lib/types";
import { fmtSurface, fmtLoyer, fmtEuro } from "@/lib/format";

interface DetailPanelProps {
  open: boolean;
  onClose: () => void;
  item: OffreRetail | null;
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

export default function DetailPanel({ open, onClose, item, onEdit, onDelete }: DetailPanelProps) {
  if (!item) return null;

  const ville = [item.zipCode, item.city].filter(Boolean).join(" ");

  return (
    <SidePanel
      open={open}
      title={item.enseigne || item.ref || "Offre Retail"}
      onClose={onClose}
      footer={
        <>
          <button onClick={onDelete} className="py-2.5 px-4 border-[1.5px] border-danger/30 rounded-lg bg-transparent text-xs font-semibold text-danger cursor-pointer hover:bg-danger-bg transition-colors">Supprimer</button>
          <button onClick={onClose} className="flex-1 py-2.5 border-[1.5px] border-border-input rounded-lg bg-transparent text-xs font-semibold cursor-pointer hover:bg-surface-hover transition-colors">Fermer</button>
          <button onClick={onEdit} className="flex-1 py-2.5 border-none rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer hover:bg-accent/90 transition-colors">Modifier</button>
        </>
      }
    >
      {/* Identite */}
      <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5">Identite</div>
      <Row label="Ref" value={item.ref} />
      <Row label="Nego" value={item.nego} />
      <Row label="Enseigne" value={item.enseigne} />
      <Row label="Activite" value={item.activite} />
      <Row label="Type de bien" value={item.typeDeBien} />
      <Row label="Transaction" value={item.transactionType} />

      {/* Adresse */}
      <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5 mt-4">Adresse</div>
      <Row label="Adresse" value={item.adresse} />
      <Row label="Ville" value={ville} />
      <Row label="Quartier" value={item.quartier} />

      {/* Surface */}
      <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5 mt-4">Surface</div>
      <Row label="Surface" value={fmtSurface(item.surface)} />

      {/* Financier */}
      <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5 mt-4">Financier</div>
      <Row label="Loyer" value={fmtEuro(item.loyer)} />
      <Row label="Loyer/m²" value={fmtLoyer(item.loyerM2)} />
      <Row label="Prix" value={fmtEuro(item.prix)} />
      <Row label="Prix/m²" value={fmtLoyer(item.prixM2)} />
      <Row label="Droit d'entree" value={fmtEuro(item.droitEntree)} />
      <Row label="Charges" value={item.charges} />
      <Row label="Loyer hors charges" value={item.loyerHorsCharges} />
      <Row label="Depot de garantie" value={fmtEuro(item.depotGarantie)} />
      <Row label="Honoraires" value={fmtEuro(item.honoraires)} />

      {/* Bail */}
      <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5 mt-4">Bail</div>
      <Row label="Type de bail" value={item.typeDeBail} />
      <Row label="Commentaires" value={item.commentairesBail} />
      <Row label="Taxe fonciere" value={item.taxeFonciere} />
      <Row label="Paiement taxe fonciere" value={item.paiementTaxeFonciere} />

      {/* Disponibilite */}
      <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5 mt-4">Disponibilite</div>
      <Row label="Occupation" value={item.occupation} />
      <Row label="Locataire" value={item.locataire} />
      <Row label="Libre le" value={item.libreDate} />

      {/* Source */}
      {item.origine && (
        <>
          <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5 mt-4">Source</div>
          <Row label="Origine" value={item.origine} />
          <Row label="Mentions sur loyer" value={item.mentionsSurLoyer} />
        </>
      )}
    </SidePanel>
  );
}
