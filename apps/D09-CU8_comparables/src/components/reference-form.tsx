"use client";

import { useState, useEffect } from "react";
import type { Reference } from "@/lib/types";
import SidePanel from "./side-panel";
import GeocodeField from "./geocode-field";

interface ReferenceFormProps {
  open: boolean;
  onClose: () => void;
  current: Reference | null;
  onSave: (ref: Reference) => void;
}

export default function ReferenceForm({
  open,
  onClose,
  current,
  onSave,
}: ReferenceFormProps) {
  const [nom, setNom] = useState("");
  const [adresse, setAdresse] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setNom(current?.nom || "");
      setAdresse(current?.adresse || "");
      setLat(current?.lat ?? null);
      setLng(current?.lng ?? null);
    }
  }, [open, current]);

  const handleSave = () => {
    if (lat == null || lng == null) return;
    onSave({ nom, adresse, lat, lng });
    onClose();
  };

  return (
    <SidePanel
      open={open}
      title={current ? "Modifier la référence" : "Définir l'adresse de référence"}
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            className="px-5 py-2.5 border-none rounded-lg text-xs font-semibold cursor-pointer bg-surface-alt text-text-secondary hover:bg-surface-hover"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={lat == null || lng == null}
            className="flex-1 px-5 py-2.5 border-none rounded-lg text-xs font-bold cursor-pointer bg-success text-white hover:bg-success-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✓ Enregistrer
          </button>
        </>
      }
    >
      <div className="mb-3.5">
        <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">
          Nom / Libellé
        </label>
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Ex: 6 Impasse des 2 Cousins"
          className="w-full px-3 py-2 border-[1.5px] border-border-input rounded-lg text-xs font-sans transition-colors focus:outline-none focus:border-map-green focus:ring-2 focus:ring-map-green/10"
        />
      </div>
      <GeocodeField
        address={adresse}
        onAddressChange={setAdresse}
        lat={lat}
        lng={lng}
        onCoordsChange={(la, ln) => {
          setLat(la);
          setLng(ln);
        }}
      />
    </SidePanel>
  );
}
