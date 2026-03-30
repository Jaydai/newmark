"use client";

import { useState, useEffect } from "react";
import SidePanel from "@/components/side-panel";
import type { Transaction, Surfaces } from "@/lib/types";
import { geocode } from "@/lib/geocode";
import { MapPin } from "lucide-react";

interface TxFormProps {
  open: boolean;
  onClose: () => void;
  current: Transaction | null;
  onSave: (tx: Omit<Transaction, "id" | "visible">) => void;
  onUpdate: (id: string, tx: Partial<Transaction>) => void;
}

const emptySurfaces: Surfaces = { r2: null, r1Storage: null, r1SalesArea: null, rdc: null, r1Plus: null, r2Plus: null, otherSpaces: null };

export default function TransactionForm({ open, onClose, current, onSave, onUpdate }: TxFormProps) {
  const [year, setYear] = useState("");
  const [type, setType] = useState("");
  const [newTenant, setNewTenant] = useState("");
  const [enseigne, setEnseigne] = useState("");
  const [previousTenant, setPreviousTenant] = useState("");
  const [landlord, setLandlord] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [street, setStreet] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [surfaces, setSurfaces] = useState<Surfaces>(emptySurfaces);
  const [weightedSurfaceSqm, setWeighted] = useState<number | null>(null);
  const [annualHeadlineRent, setRent] = useState<number | null>(null);
  const [keyMoney, setKeyMoney] = useState<number | null>(null);
  const [annualRentReviewed, setRentReviewed] = useState<number | null>(null);
  const [latestRentKnown, setLatestRent] = useState<number | null>(null);
  const [leaseDuration, setLease] = useState("");
  const [breakOptions, setBreak] = useState("");
  const [source, setSource] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  useEffect(() => {
    if (!open) return;
    if (current) {
      setYear(current.year || ""); setType(current.type || "");
      setNewTenant(current.newTenant || ""); setEnseigne(current.enseigne || "");
      setPreviousTenant(current.previousTenant || ""); setLandlord(current.landlord || "");
      setStreetNumber(current.streetNumber || ""); setStreet(current.street || "");
      setZipCode(current.zipCode || ""); setCity(current.city || ""); setArea(current.area || "");
      setSurfaces(current.surfaces || { ...emptySurfaces });
      setWeighted(current.weightedSurfaceSqm); setRent(current.annualHeadlineRent);
      setKeyMoney(current.keyMoney); setRentReviewed(current.annualRentReviewed);
      setLatestRent(current.latestRentKnown); setLease(current.leaseDuration || "");
      setBreak(current.breakOptions || ""); setSource(current.source || "");
      setLat(current.lat); setLng(current.lng);
      setGeoStatus(current.lat != null ? "ok" : "idle");
    } else {
      setYear(""); setType(""); setNewTenant(""); setEnseigne(""); setPreviousTenant("");
      setLandlord(""); setStreetNumber(""); setStreet(""); setZipCode(""); setCity(""); setArea("");
      setSurfaces({ ...emptySurfaces }); setWeighted(null); setRent(null); setKeyMoney(null);
      setRentReviewed(null); setLatestRent(null); setLease(""); setBreak(""); setSource("");
      setLat(null); setLng(null); setGeoStatus("idle");
    }
  }, [open, current]);

  const doGeocode = async () => {
    const parts = [streetNumber, street, zipCode, city].filter(Boolean);
    if (parts.length < 2) return;
    setGeoStatus("loading");
    try {
      const r = await geocode(parts.join(" "));
      setLat(r.lat); setLng(r.lng); setGeoStatus("ok");
    } catch { setGeoStatus("error"); }
  };

  const handleSave = () => {
    const tx = {
      year, type, newTenant, enseigne, previousTenant, landlord,
      streetNumber, street, zipCode, city, area, surfaces,
      totalSurfaceSqm: null, weightedSurfaceSqm: weightedSurfaceSqm,
      annualHeadlineRent: annualHeadlineRent, keyMoney: keyMoney,
      annualRentReviewed: annualRentReviewed, latestRentKnown: latestRentKnown,
      rentSqmWeighted: null, rentSqmTotal: null,
      leaseDuration: leaseDuration, breakOptions: breakOptions,
      source, lat, lng,
    };
    if (current) onUpdate(current.id, tx);
    else onSave(tx as Omit<Transaction, "id" | "visible">);
    onClose();
  };

  const setSurf = (k: keyof Surfaces, v: string) => {
    setSurfaces((p) => ({ ...p, [k]: v ? Number(v) || null : null }));
  };

  const numField = (label: string, value: number | null, onChange: (v: number | null) => void) => (
    <div className="mb-2.5">
      <label className="block text-[9px] font-semibold text-text-secondary uppercase tracking-wider mb-0.5">{label}</label>
      <input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="w-full px-2.5 py-1.5 border-[1.5px] border-border-input rounded-md text-[11px] font-sans focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/10" />
    </div>
  );

  const textField = (label: string, value: string, onChange: (v: string) => void, placeholder?: string) => (
    <div className="mb-2.5">
      <label className="block text-[9px] font-semibold text-text-secondary uppercase tracking-wider mb-0.5">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-2.5 py-1.5 border-[1.5px] border-border-input rounded-md text-[11px] font-sans focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/10" />
    </div>
  );

  return (
    <SidePanel
      open={open}
      title={current ? "Modifier la transaction" : "Ajouter une transaction"}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 border-[1.5px] border-border-input rounded-lg bg-transparent text-xs font-semibold cursor-pointer hover:bg-surface-hover transition-colors">Annuler</button>
          <button onClick={handleSave} className="flex-1 py-2.5 border-none rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer hover:bg-accent/90 transition-colors">{current ? "Enregistrer" : "Ajouter"}</button>
        </>
      }
    >
      {/* Identité */}
      <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-2">Identité</div>
      <div className="grid grid-cols-2 gap-x-3">
        {textField("Année", year, setYear)}
        {textField("Type", type, setType)}
      </div>
      {textField("Nouveau Locataire", newTenant, setNewTenant)}
      {textField("Enseigne", enseigne, setEnseigne)}
      <div className="grid grid-cols-2 gap-x-3">
        {textField("Ancien Locataire", previousTenant, setPreviousTenant)}
        {textField("Bailleur", landlord, setLandlord)}
      </div>

      {/* Adresse */}
      <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-2 mt-4">Adresse</div>
      <div className="grid grid-cols-[80px_1fr] gap-x-3">
        {textField("N°", streetNumber, setStreetNumber)}
        {textField("Rue", street, setStreet)}
      </div>
      <div className="grid grid-cols-2 gap-x-3">
        {textField("Code Postal", zipCode, setZipCode)}
        {textField("Ville", city, setCity)}
      </div>
      {textField("Quartier", area, setArea)}
      <div className="flex items-center gap-2 mb-3">
        <button onClick={doGeocode} disabled={geoStatus === "loading"}
          className="px-3 py-1.5 bg-accent text-white border-none rounded-md text-[10px] font-semibold cursor-pointer hover:bg-accent/90 disabled:opacity-60">
          <MapPin className="w-3 h-3 inline mr-1" />Localiser
        </button>
        {geoStatus === "ok" && <span className="text-[10px] text-success font-medium">✓ Localisé</span>}
        {geoStatus === "error" && <span className="text-[10px] text-danger font-medium">✕ Introuvable</span>}
        {geoStatus === "loading" && <span className="text-[10px] text-text-tertiary">Recherche…</span>}
        {lat != null && <span className="text-[9px] text-text-tertiary ml-auto">{lat.toFixed(4)}, {lng?.toFixed(4)}</span>}
      </div>

      {/* Surfaces */}
      <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-2 mt-4">Surfaces (m²)</div>
      <div className="grid grid-cols-3 gap-x-3">
        {numField("R-2", surfaces.r2, (v) => setSurf("r2", String(v ?? "")))}
        {numField("R-1 Stockage", surfaces.r1Storage, (v) => setSurf("r1Storage", String(v ?? "")))}
        {numField("R-1 Vente", surfaces.r1SalesArea, (v) => setSurf("r1SalesArea", String(v ?? "")))}
        {numField("RDC", surfaces.rdc, (v) => setSurf("rdc", String(v ?? "")))}
        {numField("R+1", surfaces.r1Plus, (v) => setSurf("r1Plus", String(v ?? "")))}
        {numField("R+2", surfaces.r2Plus, (v) => setSurf("r2Plus", String(v ?? "")))}
        {numField("Autres", surfaces.otherSpaces, (v) => setSurf("otherSpaces", String(v ?? "")))}
      </div>
      {numField("Surface Pondérée", weightedSurfaceSqm, setWeighted)}

      {/* Loyers */}
      <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-2 mt-4">Loyers (€)</div>
      <div className="grid grid-cols-2 gap-x-3">
        {numField("Loyer Facial Annuel", annualHeadlineRent, setRent)}
        {numField("Pas de Porte / DaB", keyMoney, setKeyMoney)}
        {numField("Loyer Révisé", annualRentReviewed, setRentReviewed)}
        {numField("Dernier Loyer Connu", latestRentKnown, setLatestRent)}
      </div>

      {/* Bail */}
      <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-2 mt-4">Bail</div>
      <div className="grid grid-cols-2 gap-x-3">
        {textField("Durée du Bail", leaseDuration, setLease)}
        {textField("Options de Sortie", breakOptions, setBreak)}
      </div>
      {textField("Source", source, setSource)}
    </SidePanel>
  );
}
