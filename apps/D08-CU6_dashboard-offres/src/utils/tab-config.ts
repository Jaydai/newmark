import type { OfferRow } from "@/types/kpi";

export interface SectorTab {
  id: string;
  label: string;
  filter: (row: OfferRow) => boolean;
}

function getParisArr(cp: string): number | null {
  const trimmed = cp?.trim();
  if (!trimmed) return null;
  // 75001-75020 or 75116 for 16th arrondissement
  const m = trimmed.match(/^75[01](\d{2})$/);
  if (m) return parseInt(m[1], 10);
  return null;
}

function cityIncludes(ville: string, ...keywords: string[]): boolean {
  const normalized = (ville || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return keywords.some((k) => normalized.includes(k.toUpperCase()));
}

export const SECTOR_TABS: SectorTab[] = [
  {
    id: "global",
    label: "Global",
    filter: () => true,
  },
  {
    id: "paris-1-2-8-9-16-17",
    label: "Paris 1 / 2 / 8 / 9 / 16 / 17",
    filter: (r) => {
      const a = getParisArr(r.codePostal);
      return a !== null && [1, 2, 8, 9, 16, 17].includes(a);
    },
  },
  {
    id: "paris-10-11",
    label: "Paris 10 / 11",
    filter: (r) => {
      const a = getParisArr(r.codePostal);
      return a !== null && [10, 11].includes(a);
    },
  },
  {
    id: "paris-14-15",
    label: "Paris 14 / 15",
    filter: (r) => {
      const a = getParisArr(r.codePostal);
      return a !== null && [14, 15].includes(a);
    },
  },
  {
    id: "paris-12-13",
    label: "Paris 12 / 13",
    filter: (r) => {
      const a = getParisArr(r.codePostal);
      return a !== null && [12, 13].includes(a);
    },
  },
  {
    id: "paris-5-6-7",
    label: "Paris 5 / 6 / 7",
    filter: (r) => {
      const a = getParisArr(r.codePostal);
      return a !== null && [5, 6, 7].includes(a);
    },
  },
  {
    id: "paris-3-4",
    label: "Paris 3 / 4",
    filter: (r) => {
      const a = getParisArr(r.codePostal);
      return a !== null && [3, 4].includes(a);
    },
  },
  {
    id: "paris-18-19-20",
    label: "Paris 18 / 19 / 20",
    filter: (r) => {
      const a = getParisArr(r.codePostal);
      return a !== null && [18, 19, 20].includes(a);
    },
  },
  {
    id: "la-defense",
    label: "La Défense",
    filter: (r) => {
      const s = (r.secteurMarche || "").toLowerCase();
      return s.includes("defense") || s.includes("défense");
    },
  },
  {
    id: "boulogne-issy",
    label: "Boulogne / Issy-les-Moulineaux",
    filter: (r) => cityIncludes(r.ville, "BOULOGNE", "ISSY"),
  },
  {
    id: "neuilly-levallois",
    label: "Neuilly / Levallois",
    filter: (r) => cityIncludes(r.ville, "NEUILLY", "LEVALLOIS"),
  },
];
