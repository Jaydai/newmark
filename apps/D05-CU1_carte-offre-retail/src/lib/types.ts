export interface OffreRetail {
  id: string;
  visible: boolean;
  ref: string;
  nego: string;
  origine: string;
  typeDeBien: string;
  transactionType: string;
  enseigne: string;
  activite: string;
  adresse: string;
  zipCode: string;
  city: string;
  quartier: string;
  surface: number | null;
  prix: number | null;
  prixM2: number | null;
  droitEntree: number | null;
  loyer: number | null;
  mentionsSurLoyer: string;
  loyerM2: number | null;
  loyerHorsCharges: string;
  charges: string;
  typeDeBail: string;
  commentairesBail: string;
  depotGarantie: number | null;
  taxeFonciere: string;
  paiementTaxeFonciere: string;
  honoraires: number | null;
  occupation: string;
  locataire: string;
  libreDate: string;
  lat: number | null;
  lng: number | null;
}

export type ViewMode = "map" | "bubbles";
