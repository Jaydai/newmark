/** Raw offer row from the XLSX file */
export interface OfferRow {
  id: number;
  gestionnaire: string;
  coGestionnaire: string;
  actif: string;
  offreDirecte: string;
  dateCreation: Date | null;
  dateModification: Date | null;
  dateMiseAJour: Date | null;
  nomOffre: string;
  nAdresse: string;
  adresseZone: string;
  nomImmeuble: string;
  numeroVoie: string;
  voie: string;
  secteurMarche: string;
  codePostal: string;
  ville: string;
  nature: string;
  typeContrat: string;
  surfaceMini: number | null;
  surfaceTotale: number | null;
  surfaceMiniBureaux: number | null;
  surfaceTotaleBureaux: number | null;
  loyerGlobal: number | null;
  loyerMin: number | null;
  loyerMax: number | null;
  prixGlobal: number | null;
  prixMin: number | null;
  prixMax: number | null;
  etatImmeuble: string;
  etatLocaux: string;
  disponibilite: string;
  disponibiliteDate: Date | null;
  avisDisponibilite: string;
  stadeCommercialisation: string;
  // Additional fields from Export format
  qualite: string;
  refCompte: string;
  compte: string;
  refContact: string;
  contact: string;
  assistante: string;
  telephoneAssistante: string;
  mobileAssistante: string;
  emailAssistante: string;
  refConfrere: string;
}

/** Named distribution for charts */
export interface Distribution {
  name: string;
  value: number;
}

/** Monthly data point for evolution charts */
export interface MonthlyDataPoint {
  month: string; // "2025-01"
  label: string; // "Jan 25"
  value: number;
}

/** A parsed file snapshot at a given point in time */
export interface FileSnapshot {
  fileName: string;
  date: Date;
  monthKey: string; // "2025-12"
  activeOffers: OfferRow[];
  archivedOffers: OfferRow[];
}

/** Dashboard data — parsed from one or more XLSX files */
export interface DashboardData {
  /** Most recent snapshot's active offers (for current state views) */
  activeOffers: OfferRow[];
  /** Most recent snapshot's archived offers */
  archivedOffers: OfferRow[];
  /** All snapshots sorted chronologically (for evolution charts) */
  snapshots: FileSnapshot[];
  /** Metadata */
  parsedAt: Date;
}
