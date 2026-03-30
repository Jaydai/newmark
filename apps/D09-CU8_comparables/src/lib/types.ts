export interface Reference {
  nom: string;
  adresse: string;
  lat: number | null;
  lng: number | null;
}

export interface Comparable {
  preneur: string;
  adresse: string;
  lat: number | null;
  lng: number | null;
  date: string;
  surface: string | number;
  etat: string;
  loyer: string | number;
}

export interface ParsedExcelData {
  refAddr: string;
  comps: Comparable[];
  columns: string[];
  error?: string;
}

export type ViewMode = "map" | "bubbles";
