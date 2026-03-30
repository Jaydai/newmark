"use client";

import { useState, useEffect } from "react";
import SidePanel from "@/components/side-panel";
import GeocodeField from "@/components/geocode-field";
import type { Asset } from "@/lib/types";

interface AssetFormProps {
  open: boolean;
  onClose: () => void;
  current: Asset | null;
  onSave: (a: Asset) => void;
}

const empty: Asset = { nom: "", adresse: "", lat: null, lng: null, surface: "", type: "", prix: "", prixM2: "", rendement: "", description: "" };

export default function AssetForm({ open, onClose, current, onSave }: AssetFormProps) {
  const [f, setF] = useState<Asset>(empty);

  useEffect(() => {
    if (open) setF(current ? { ...current } : { ...empty });
  }, [open, current]);

  const set = (k: keyof Asset, v: string) => setF((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    onSave(f);
    onClose();
  };

  return (
    <SidePanel
      open={open}
      title={current ? "Modifier l'actif" : "Définir l'actif"}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 border-[1.5px] border-border-input rounded-lg bg-transparent text-xs font-semibold cursor-pointer hover:bg-surface-hover transition-colors">
            Annuler
          </button>
          <button onClick={handleSave} className="flex-1 py-2.5 border-none rounded-lg bg-primary text-white text-xs font-semibold cursor-pointer hover:bg-primary-hover transition-colors">
            Enregistrer
          </button>
        </>
      }
    >
      <Field label="Nom" value={f.nom} onChange={(v) => set("nom", v)} placeholder="Tour Newmark Plaza" />

      <GeocodeField
        address={f.adresse}
        onAddressChange={(v) => set("adresse", v)}
        lat={f.lat}
        lng={f.lng}
        onCoordsChange={(lat, lng) => setF((p) => ({ ...p, lat, lng }))}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Surface" value={f.surface} onChange={(v) => set("surface", v)} placeholder="12 500 m²" />
        <Field label="Type" value={f.type} onChange={(v) => set("type", v)} placeholder="Bureaux" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Prix" value={f.prix} onChange={(v) => set("prix", v)} placeholder="45 000 000 €" />
        <Field label="Prix/m²" value={f.prixM2} onChange={(v) => set("prixM2", v)} placeholder="3 600 €/m²" />
      </div>

      <Field label="Rendement" value={f.rendement} onChange={(v) => set("rendement", v)} placeholder="4.8%" />

      <div className="mb-3.5">
        <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">
          Description
        </label>
        <textarea
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Notes complémentaires…"
          rows={3}
          className="w-full px-3 py-2 border-[1.5px] border-border-input rounded-lg text-xs font-sans resize-y min-h-[56px] transition-colors focus:outline-none focus:border-map-green focus:ring-2 focus:ring-map-green/10"
        />
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
