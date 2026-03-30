"use client";

import { useState, useEffect } from "react";
import SidePanel from "@/components/side-panel";
import GeocodeField from "@/components/geocode-field";
import type { Comparable } from "@/lib/types";

interface ComparableFormProps {
  open: boolean;
  onClose: () => void;
  current: Comparable | null;
  editIdx: number;
  onSave: (c: Comparable, idx: number) => void;
}

const empty: Comparable = { nom: "", adresse: "", lat: null, lng: null, surface: "", prix: "", prixM2: "", date: "", acquereur: "", taux: "" };

export default function ComparableForm({ open, onClose, current, editIdx, onSave }: ComparableFormProps) {
  const [f, setF] = useState<Comparable>(empty);

  useEffect(() => {
    if (open) setF(current ? { ...current } : { ...empty });
  }, [open, current]);

  const set = (k: keyof Comparable, v: string) => setF((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    onSave(f, editIdx);
    onClose();
  };

  return (
    <SidePanel
      open={open}
      title={editIdx >= 0 ? "Modifier le comparable" : "Ajouter un comparable"}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 border-[1.5px] border-border-input rounded-lg bg-transparent text-xs font-semibold cursor-pointer hover:bg-surface-hover transition-colors">
            Annuler
          </button>
          <button onClick={handleSave} className="flex-1 py-2.5 border-none rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer hover:bg-accent/90 transition-colors">
            {editIdx >= 0 ? "Enregistrer" : "Ajouter"}
          </button>
        </>
      }
    >
      <Field label="Nom" value={f.nom} onChange={(v) => set("nom", v)} placeholder="Immeuble Haussmann" />

      <GeocodeField
        address={f.adresse}
        onAddressChange={(v) => set("adresse", v)}
        lat={f.lat}
        lng={f.lng}
        onCoordsChange={(lat, lng) => setF((p) => ({ ...p, lat, lng }))}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Surface" value={f.surface} onChange={(v) => set("surface", v)} placeholder="8 000 m²" />
        <Field label="Date" value={f.date} onChange={(v) => set("date", v)} placeholder="Mars 2024" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Prix" value={f.prix} onChange={(v) => set("prix", v)} placeholder="30 000 000 €" />
        <Field label="Prix/m²" value={f.prixM2} onChange={(v) => set("prixM2", v)} placeholder="3 750 €/m²" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Taux" value={f.taux} onChange={(v) => set("taux", v)} placeholder="4.5%" />
        <Field label="Acquéreur" value={f.acquereur} onChange={(v) => set("acquereur", v)} placeholder="AXA Investment" />
      </div>
    </SidePanel>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="mb-3.5">
      <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border-[1.5px] border-border-input rounded-lg text-xs font-sans transition-colors focus:outline-none focus:border-map-green focus:ring-2 focus:ring-map-green/10"
      />
    </div>
  );
}
