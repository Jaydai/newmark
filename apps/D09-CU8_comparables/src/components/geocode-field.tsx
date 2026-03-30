"use client";

import { useState, useRef } from "react";
import { geocode } from "@/lib/geocode";
import { MapPin } from "lucide-react";

interface GeocodeFieldProps {
  label?: string;
  address: string;
  onAddressChange: (addr: string) => void;
  lat: number | null;
  lng: number | null;
  onCoordsChange: (lat: number, lng: number) => void;
}

export default function GeocodeField({
  label = "Adresse",
  address,
  onAddressChange,
  lat,
  lng,
  onCoordsChange,
}: GeocodeFieldProps) {
  const [status, setStatus] = useState<{
    type: "idle" | "loading" | "ok" | "error";
    text: string;
  }>({
    type: lat != null ? "ok" : "idle",
    text: lat != null ? "✓ Coordonnées existantes" : "",
  });
  const lockRef = useRef(false);

  const doGeocode = async () => {
    if (lockRef.current) return;
    const addr = address.trim();
    if (!addr) {
      setStatus({ type: "error", text: "Saisissez une adresse." });
      return;
    }
    lockRef.current = true;
    setStatus({ type: "loading", text: "Recherche…" });
    try {
      const r = await geocode(addr);
      onCoordsChange(r.lat, r.lng);
      setStatus({ type: "ok", text: "✓ Adresse localisée" });
    } catch (e) {
      setStatus({
        type: "error",
        text: `✕ ${e instanceof Error ? e.message : "Erreur"}`,
      });
    } finally {
      setTimeout(() => {
        lockRef.current = false;
      }, 1100);
    }
  };

  return (
    <div className="mb-3.5">
      <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="42 Av. des Champs-Élysées, 75008 Paris"
          className="flex-1 px-3 py-2 border-[1.5px] border-border-input rounded-lg text-xs font-sans transition-colors focus:outline-none focus:border-map-green focus:ring-2 focus:ring-map-green/10"
        />
        <button
          onClick={doGeocode}
          disabled={status.type === "loading"}
          className="shrink-0 px-3.5 py-2 bg-primary text-white border-none rounded-lg text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-colors hover:bg-primary-hover disabled:bg-text-tertiary disabled:cursor-wait"
        >
          <MapPin className="w-3.5 h-3.5 inline mr-1" />
          Localiser
        </button>
      </div>
      {status.text && (
        <div
          className={`text-[10px] mt-1 font-medium ${
            status.type === "ok"
              ? "text-success"
              : status.type === "error"
              ? "text-danger"
              : "text-text-tertiary"
          }`}
        >
          {status.text}
        </div>
      )}
      {lat != null && lng != null && (
        <div className="flex gap-2.5 text-[10px] text-text-tertiary mt-0.5">
          <span className="bg-surface-alt px-2 py-0.5 rounded-md font-medium">
            Lat: {lat.toFixed(5)}
          </span>
          <span className="bg-surface-alt px-2 py-0.5 rounded-md font-medium">
            Lng: {lng.toFixed(5)}
          </span>
        </div>
      )}
    </div>
  );
}
