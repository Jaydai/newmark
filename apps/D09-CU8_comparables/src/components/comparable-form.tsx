"use client";

import { useState, useEffect } from "react";
import type { Comparable } from "@/lib/types";
import SidePanel from "./side-panel";
import GeocodeField from "./geocode-field";

interface ComparableFormProps {
  open: boolean;
  onClose: () => void;
  current: Comparable | null;
  editIdx: number;
  onSave: (comp: Comparable, idx: number) => void;
}

export default function ComparableForm({
  open,
  onClose,
  current,
  editIdx,
  onSave,
}: ComparableFormProps) {
  const [preneur, setPreneur] = useState("");
  const [adresse, setAdresse] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [surface, setSurface] = useState("");
  const [etat, setEtat] = useState("");
  const [loyer, setLoyer] = useState("");

  const isNew = editIdx < 0;

  useEffect(() => {
    if (open) {
      setPreneur(current?.preneur || "");
      setAdresse(current?.adresse || "");
      setLat(current?.lat ?? null);
      setLng(current?.lng ?? null);
      setDate(current?.date || "");
      setSurface(String(current?.surface || ""));
      setEtat(current?.etat || "");
      setLoyer(String(current?.loyer || ""));
    }
  }, [open, current]);

  const handleSave = () => {
    if (lat == null || lng == null) return;
    onSave(
      { preneur, adresse, lat, lng, date, surface, etat, loyer },
      editIdx
    );
    onClose();
  };

  return (
    <SidePanel
      open={open}
      title={isNew ? "Ajouter un comparable" : "Modifier le comparable"}
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
            className="flex-1 px-5 py-2.5 border-none rounded-lg text-xs font-bold cursor-pointer bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✓ {isNew ? "Ajouter" : "Enregistrer"}
          </button>
        </>
      }
    >
      <div className="mb-3.5">
        <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">
          Preneur
        </label>
        <input
          value={preneur}
          onChange={(e) => setPreneur(e.target.value)}
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
      <div className="grid grid-cols-2 gap-3">
        <div className="mb-3.5">
          <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">
            Date
          </label>
          <input
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border-[1.5px] border-border-input rounded-lg text-xs font-sans transition-colors focus:outline-none focus:border-map-green focus:ring-2 focus:ring-map-green/10"
          />
        </div>
        <div className="mb-3.5">
          <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">
            Surface (m²)
          </label>
          <input
            value={surface}
            onChange={(e) => setSurface(e.target.value)}
            className="w-full px-3 py-2 border-[1.5px] border-border-input rounded-lg text-xs font-sans transition-colors focus:outline-none focus:border-map-green focus:ring-2 focus:ring-map-green/10"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="mb-3.5">
          <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">
            État des locaux
          </label>
          <input
            value={etat}
            onChange={(e) => setEtat(e.target.value)}
            className="w-full px-3 py-2 border-[1.5px] border-border-input rounded-lg text-xs font-sans transition-colors focus:outline-none focus:border-map-green focus:ring-2 focus:ring-map-green/10"
          />
        </div>
        <div className="mb-3.5">
          <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">
            Loyer/m²
          </label>
          <input
            value={loyer}
            onChange={(e) => setLoyer(e.target.value)}
            className="w-full px-3 py-2 border-[1.5px] border-border-input rounded-lg text-xs font-sans transition-colors focus:outline-none focus:border-map-green focus:ring-2 focus:ring-map-green/10"
          />
        </div>
      </div>
    </SidePanel>
  );
}
