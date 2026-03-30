"use client";

import { useState } from "react";
import type { Visit } from "@/lib/types";
import SidePanel from "./side-panel";
import GeocodeField from "./geocode-field";

interface VisitFormProps {
  open: boolean;
  visit?: Visit;
  onClose: () => void;
  onSave: (visit: Visit) => void;
}

export default function VisitForm({
  open,
  visit,
  onClose,
  onSave,
}: VisitFormProps) {
  const [name, setName] = useState(visit?.name || "");
  const [address, setAddress] = useState(visit?.address || "");
  const [lat, setLat] = useState<number | null>(visit?.lat ?? null);
  const [lng, setLng] = useState<number | null>(visit?.lng ?? null);
  const [duration, setDuration] = useState(visit?.duration ?? 30);
  const [geoError, setGeoError] = useState("");

  // Reset when visit changes
  const resetForm = (v?: Visit) => {
    setName(v?.name || "");
    setAddress(v?.address || "");
    setLat(v?.lat ?? null);
    setLng(v?.lng ?? null);
    setDuration(v?.duration ?? 30);
    setGeoError("");
  };

  const handleSave = () => {
    if (lat == null || lng == null) {
      setGeoError("Localisez d'abord l'adresse avec 📍 Localiser.");
      return;
    }
    onSave({
      name: name || "Visite",
      address,
      lat,
      lng,
      duration: Math.max(5, Math.min(480, duration)),
    });
    resetForm();
    onClose();
  };

  const handleClose = () => {
    resetForm(visit);
    onClose();
  };

  const isEdit = !!visit;

  return (
    <SidePanel
      open={open}
      title={isEdit ? "Modifier la visite" : "Ajouter une visite"}
      onClose={handleClose}
      footer={
        <>
          <button
            onClick={handleClose}
            className="px-5 py-2.5 border-none rounded-lg text-xs font-semibold cursor-pointer bg-surface-alt text-text-secondary hover:bg-surface-hover"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-5 py-2.5 border-none rounded-lg text-xs font-bold cursor-pointer bg-success text-white hover:bg-success-hover"
          >
            ✓ {isEdit ? "Enregistrer" : "Ajouter"}
          </button>
        </>
      }
    >
      <div className="mb-3.5">
        <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">
          Nom
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bureau Haussmann"
          className="w-full px-3 py-2 border-[1.5px] border-border-input rounded-lg text-xs font-sans transition-colors focus:outline-none focus:border-map-green focus:ring-2 focus:ring-map-green/10"
        />
      </div>

      <GeocodeField
        address={address}
        onAddressChange={setAddress}
        lat={lat}
        lng={lng}
        onCoordsChange={(la, ln) => {
          setLat(la);
          setLng(ln);
          setGeoError("");
        }}
      />

      {geoError && (
        <div className="text-[10px] text-danger font-medium -mt-2 mb-3">
          ✕ {geoError}
        </div>
      )}

      <div className="mb-3.5">
        <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">
          Durée de visite (minutes)
        </label>
        <input
          type="number"
          min={5}
          max={480}
          value={duration}
          onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
          className="w-full px-3 py-2 border-[1.5px] border-border-input rounded-lg text-xs font-sans transition-colors focus:outline-none focus:border-map-green focus:ring-2 focus:ring-map-green/10"
        />
      </div>
    </SidePanel>
  );
}
