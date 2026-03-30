"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Asset, Comparable } from "@/lib/types";

const STORAGE_KEY = "newmark_map_data";

const DEFAULT_ACTIF: Asset = {
  nom: "Tour Newmark Plaza — Grand Complexe Immobilier de Bureaux Premium Certifié HQE Bâtiment Durable & BREEAM Outstanding Situé au Cœur du Quartier Central des Affaires de Paris La Défense",
  adresse: "42 Avenue des Champs-\u00c9lys\u00e9es, 75008 Paris",
  lat: 48.8698,
  lng: 2.3075,
  surface: "12 500 m\u00b2",
  prix: "45 000 000 \u20ac",
  prixM2: "3 600 \u20ac/m\u00b2",
  rendement: "4.8%",
  type: "Bureaux",
  description:
    "Immeuble de bureaux Prime, r\u00e9nov\u00e9 en 2022. Certifi\u00e9 HQE & BREEAM Excellent. Multi-locataires, WALB 5,2 ans.",
};

const DEFAULT_COMPS: Comparable[] = [
  {
    nom: "Haussmann Business Center",
    adresse: "88 Boulevard Haussmann, 75008 Paris",
    lat: 48.8738,
    lng: 2.3228,
    surface: "8 200 m\u00b2",
    prix: "31 500 000 \u20ac",
    prixM2: "3 841 \u20ac/m\u00b2",
    date: "Mars 2024",
    acquereur: "AXA IM",
    taux: "4.5%",
  },
  {
    nom: "Green Office Madeleine",
    adresse: "12 Rue Tronchet, 75009 Paris",
    lat: 48.8722,
    lng: 2.325,
    surface: "5 600 m\u00b2",
    prix: "19 800 000 \u20ac",
    prixM2: "3 536 \u20ac/m\u00b2",
    date: "Janvier 2024",
    acquereur: "Primonial REIM",
    taux: "4.9%",
  },
  {
    nom: "\u00c9toile Saint-Honor\u00e9",
    adresse: "3 Rue du Fg Saint-Honor\u00e9, 75008 Paris",
    lat: 48.8685,
    lng: 2.317,
    surface: "15 000 m\u00b2",
    prix: "58 500 000 \u20ac",
    prixM2: "3 900 \u20ac/m\u00b2",
    date: "Nov. 2023",
    acquereur: "BNP Paribas REIM",
    taux: "4.2%",
  },
  {
    nom: "Op\u00e9ra Corner",
    adresse: "25 Rue de la Chauss\u00e9e-d'Antin, 75009 Paris",
    lat: 48.8735,
    lng: 2.334,
    surface: "3 800 m\u00b2",
    prix: "13 300 000 \u20ac",
    prixM2: "3 500 \u20ac/m\u00b2",
    date: "Sept. 2023",
    acquereur: "La Fran\u00e7aise REM",
    taux: "5.1%",
  },
  {
    nom: "Concorde Premium",
    adresse: "6 Rue Royale, 75008 Paris",
    lat: 48.8673,
    lng: 2.3225,
    surface: "6 900 m\u00b2",
    prix: "28 000 000 \u20ac",
    prixM2: "4 058 \u20ac/m\u00b2",
    date: "Juin 2023",
    acquereur: "Amundi Immobilier",
    taux: "4.3%",
  },
];

interface StoreState {
  actif: Asset | null;
  comps: Comparable[];
}

function withDefaults(state: StoreState): StoreState {
  if (!state.actif && !state.comps.length) {
    return {
      actif: DEFAULT_ACTIF,
      comps: DEFAULT_COMPS,
    };
  }
  return state;
}

function loadFromStorage(): StoreState {
  if (typeof window === "undefined") return { actif: null, comps: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return withDefaults({ actif: null, comps: [] });
    const d = JSON.parse(raw);
    return withDefaults({
      actif: d.actif || null,
      comps: Array.isArray(d.comps) ? d.comps : [],
    });
  } catch {
    return withDefaults({ actif: null, comps: [] });
  }
}

function saveToStorage(state: StoreState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function useCommercialisationStore() {
  const [actif, setActifState] = useState<Asset | null>(null);
  const [comps, setCompsState] = useState<Comparable[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    const stored = loadFromStorage();
    setActifState(stored.actif);
    setCompsState(stored.comps);
    initialized.current = true;
  }, []);

  useEffect(() => {
    if (!initialized.current) return;
    saveToStorage({ actif, comps });
  }, [actif, comps]);

  const setActif = useCallback((ref: Asset | null) => { setActifState(ref); }, []);
  const setComps = useCallback((c: Comparable[]) => { setCompsState(c); }, []);
  const addComp = useCallback((c: Comparable) => { setCompsState((prev) => [...prev, c]); }, []);
  const updateComp = useCallback((idx: number, c: Comparable) => {
    setCompsState((prev) => prev.map((old, i) => (i === idx ? c : old)));
  }, []);
  const deleteComp = useCallback((idx: number) => {
    setCompsState((prev) => prev.filter((_, i) => i !== idx));
  }, []);
  const insertComp = useCallback((idx: number, c: Comparable) => {
    setCompsState((prev) => {
      const next = [...prev];
      next.splice(idx, 0, c);
      return next;
    });
  }, []);

  return { actif, comps, setActif, setComps, addComp, updateComp, deleteComp, insertComp };
}
