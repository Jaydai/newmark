export interface Surfaces {
  r2: number | null;
  r1Storage: number | null;
  r1SalesArea: number | null;
  rdc: number | null;
  r1Plus: number | null;
  r2Plus: number | null;
  otherSpaces: number | null;
}

export interface Transaction {
  id: string;
  visible: boolean;
  year: string;
  type: string;
  newTenant: string;
  enseigne: string;
  previousTenant: string;
  landlord: string;
  streetNumber: string;
  street: string;
  zipCode: string;
  city: string;
  area: string;
  surfaces: Surfaces;
  totalSurfaceSqm: number | null;
  weightedSurfaceSqm: number | null;
  annualHeadlineRent: number | null;
  keyMoney: number | null;
  annualRentReviewed: number | null;
  latestRentKnown: number | null;
  rentSqmWeighted: number | null;
  rentSqmTotal: number | null;
  leaseDuration: string;
  breakOptions: string;
  source: string;
  lat: number | null;
  lng: number | null;
}

export type ViewMode = "map" | "bubbles";
