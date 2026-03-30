export interface Visit {
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  duration: number; // minutes
  arrival?: string; // "HH:MM"
  departure?: string; // "HH:MM"
}

export interface RouteSegment {
  duration: number; // minutes
  distance: string; // km
  geometry: GeoJSON.LineString;
}

export type ViewMode = "map" | "bubbles";
