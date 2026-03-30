/* ─── Commercialisation ─── */

export interface Asset {
  nom: string;
  adresse: string;
  lat: number | null;
  lng: number | null;
  surface: string;
  type: string;
  prix: string;
  prixM2: string;
  rendement: string;
  description: string;
}

export interface Comparable {
  nom: string;
  adresse: string;
  lat: number | null;
  lng: number | null;
  surface: string;
  prix: string;
  prixM2: string;
  date: string;
  acquereur: string;
  taux: string;
}

/* ─── Shared ─── */

export type ViewMode = "map" | "bubbles";
