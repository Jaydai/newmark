"use client";

import { useState, useEffect } from "react";
import SidePanel from "@/components/side-panel";
import type { OffreRetail } from "@/lib/types";
import { geocode } from "@/lib/geocode";
import { MapPin } from "lucide-react";

interface OffreRetailFormProps {
  open: boolean;
  onClose: () => void;
  current: OffreRetail | null;
  onSave: (item: Omit<OffreRetail, "id" | "visible">) => void;
  onUpdate: (id: string, patch: Partial<OffreRetail>) => void;
}

export default function OffreRetailForm({ open, onClose, current, onSave, onUpdate }: OffreRetailFormProps) {
  const [ref, setRef] = useState("");
  const [enseigne, setEnseigne] = useState("");
  const [activite, setActivite] = useState("");
  const [typeDeBien, setTypeDeBien] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [adresse, setAdresse] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [city, setCity] = useState("");
  const [quartier, setQuartier] = useState("");
  const [surface, setSurface] = useState<number | null>(null);
  const [loyer, setLoyer] = useState<number | null>(null);
  const [loyerM2, setLoyerM2] = useState<number | null>(null);
  const [prix, setPrix] = useState<number | null>(null);
  const [droitEntree, setDroitEntree] = useState<number | null>(null);
  const [charges, setCharges] = useState("");
  const [depotGarantie, setDepotGarantie] = useState<number | null>(null);
  const [honoraires, setHonoraires] = useState<number | null>(null);
  const [typeDeBail, setTypeDeBail] = useState("");
  const [libreDate, setLibreDate] = useState("");
  const [taxeFonciere, setTaxeFonciere] = useState("");
  const [paiementTaxeFonciere, setPaiementTaxeFonciere] = useState("");
  const [nego, setNego] = useState("");
  const [origine, setOrigine] = useState("");
  const [mentionsSurLoyer, setMentionsSurLoyer] = useState("");
  const [loyerHorsCharges, setLoyerHorsCharges] = useState("");
  const [commentairesBail, setCommentairesBail] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  useEffect(() => {
    if (!open) return;
    if (current) {
      setRef(current.ref || ""); setEnseigne(current.enseigne || "");
      setActivite(current.activite || ""); setTypeDeBien(current.typeDeBien || "");
      setTransactionType(current.transactionType || "");
      setAdresse(current.adresse || ""); setZipCode(current.zipCode || "");
      setCity(current.city || ""); setQuartier(current.quartier || "");
      setSurface(current.surface); setLoyer(current.loyer);
      setLoyerM2(current.loyerM2); setPrix(current.prix);
      setDroitEntree(current.droitEntree); setCharges(current.charges || "");
      setDepotGarantie(current.depotGarantie); setHonoraires(current.honoraires);
      setTypeDeBail(current.typeDeBail || ""); setLibreDate(current.libreDate || "");
      setTaxeFonciere(current.taxeFonciere || ""); setPaiementTaxeFonciere(current.paiementTaxeFonciere || "");
      setNego(current.nego || ""); setOrigine(current.origine || "");
      setMentionsSurLoyer(current.mentionsSurLoyer || ""); setLoyerHorsCharges(current.loyerHorsCharges || "");
      setCommentairesBail(current.commentairesBail || "");
      setLat(current.lat); setLng(current.lng);
      setGeoStatus(current.lat != null ? "ok" : "idle");
    } else {
      setRef(""); setEnseigne(""); setActivite(""); setTypeDeBien(""); setTransactionType("");
      setAdresse(""); setZipCode(""); setCity(""); setQuartier("");
      setSurface(null); setLoyer(null); setLoyerM2(null); setPrix(null);
      setDroitEntree(null); setCharges(""); setDepotGarantie(null); setHonoraires(null);
      setTypeDeBail(""); setLibreDate(""); setTaxeFonciere(""); setPaiementTaxeFonciere("");
      setNego(""); setOrigine(""); setMentionsSurLoyer(""); setLoyerHorsCharges("");
      setCommentairesBail("");
      setLat(null); setLng(null); setGeoStatus("idle");
    }
  }, [open, current]);

  const doGeocode = async () => {
    const parts = [adresse, zipCode, city].filter(Boolean);
    if (parts.length < 2) return;
    setGeoStatus("loading");
    try {
      const r = await geocode(parts.join(" "));
      setLat(r.lat); setLng(r.lng); setGeoStatus("ok");
    } catch { setGeoStatus("error"); }
  };

  const handleSave = () => {
    const item = {
      ref, enseigne, activite, typeDeBien, transactionType,
      adresse, zipCode, city, quartier,
      surface, loyer, loyerM2, prix, prixM2: null, droitEntree,
      charges, depotGarantie, honoraires,
      typeDeBail, libreDate, taxeFonciere, paiementTaxeFonciere,
      nego, origine, mentionsSurLoyer, loyerHorsCharges, commentairesBail,
      occupation: "", locataire: "",
      lat, lng,
    };
    if (current) onUpdate(current.id, item);
    else onSave(item as Omit<OffreRetail, "id" | "visible">);
    onClose();
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
      title={current ? "Modifier l'offre" : "Ajouter une offre"}
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
        {textField("Référence", ref, setRef)}
        {textField("Enseigne", enseigne, setEnseigne)}
      </div>
      <div className="grid grid-cols-2 gap-x-3">
        {textField("Activité", activite, setActivite)}
        {textField("Type de Bien", typeDeBien, setTypeDeBien)}
      </div>
      {textField("Type de Transaction", transactionType, setTransactionType)}

      {/* Adresse */}
      <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-2 mt-4">Adresse</div>
      {textField("Adresse", adresse, setAdresse)}
      <div className="grid grid-cols-2 gap-x-3">
        {textField("Code Postal", zipCode, setZipCode)}
        {textField("Ville", city, setCity)}
      </div>
      {textField("Quartier", quartier, setQuartier)}
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

      {/* Financier */}
      <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-2 mt-4">Financier</div>
      <div className="grid grid-cols-2 gap-x-3">
        {numField("Surface (m²)", surface, setSurface)}
        {numField("Loyer (€)", loyer, setLoyer)}
        {numField("Loyer/m² (€)", loyerM2, setLoyerM2)}
        {numField("Prix (€)", prix, setPrix)}
        {numField("Droit d'Entrée (€)", droitEntree, setDroitEntree)}
        {numField("Dépôt de Garantie (€)", depotGarantie, setDepotGarantie)}
      </div>
      {textField("Charges", charges, setCharges)}
      {numField("Honoraires (€)", honoraires, setHonoraires)}

      {/* Bail */}
      <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-2 mt-4">Bail</div>
      <div className="grid grid-cols-2 gap-x-3">
        {textField("Type de Bail", typeDeBail, setTypeDeBail)}
        {textField("Date Libre", libreDate, setLibreDate)}
        {textField("Taxe Foncière", taxeFonciere, setTaxeFonciere)}
        {textField("Paiement Taxe Foncière", paiementTaxeFonciere, setPaiementTaxeFonciere)}
      </div>

      {/* Divers */}
      <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-2 mt-4">Divers</div>
      <div className="grid grid-cols-2 gap-x-3">
        {textField("Négo", nego, setNego)}
        {textField("Origine", origine, setOrigine)}
      </div>
      {textField("Mentions sur Loyer", mentionsSurLoyer, setMentionsSurLoyer)}
      {textField("Loyer Hors Charges", loyerHorsCharges, setLoyerHorsCharges)}
      {textField("Commentaires Bail", commentairesBail, setCommentairesBail)}
    </SidePanel>
  );
}
