import * as XLSX from "xlsx";
import type { OfferRow, DashboardData, FileSnapshot } from "@/types/kpi";
import { toMonthKey } from "./date-detect";

/** Column header mappings — maps French headers to our typed keys */
const HEADER_MAP: Record<string, keyof OfferRow> = {
  // ID
  "N°": "id",
  N: "id",
  // People
  Gestionnaire: "gestionnaire",
  "Co-gestionnaire": "coGestionnaire",
  // Status
  Actif: "actif",
  "Offre directe": "offreDirecte",
  // Dates (with & without accents)
  "Date de création/réactivation": "dateCreation",
  "Date de creation/reactivation": "dateCreation",
  "Date de modification": "dateModification",
  "Date de mise à jour": "dateMiseAJour",
  "Date de mise a jour": "dateMiseAJour",
  // Offer details
  "Nom Offre": "nomOffre",
  "N Adresse": "nAdresse",
  // Address
  "Adresse (Zone)": "adresseZone",
  "Adresse (Nom Immeuble)": "nomImmeuble",
  "Adresse (N° voie)": "numeroVoie",
  "Adresse (N voie)": "numeroVoie",
  "Adresse (Voie)": "voie",
  "Secteur de marché": "secteurMarche",
  "Secteur de marche": "secteurMarche",
  "Adresse (Code postal)": "codePostal",
  "Adresse (Ville)": "ville",
  // Type
  Nature: "nature",
  "Type de contrat": "typeContrat",
  // Surface (with non-breaking space variants)
  "Surface\u00a0mini": "surfaceMini",
  "Surface mini": "surfaceMini",
  "Surface totale": "surfaceTotale",
  "Surface\u00a0mini (Bureaux)": "surfaceMiniBureaux",
  "Surface mini (Bureaux)": "surfaceMiniBureaux",
  "Surface totale (Bureaux)": "surfaceTotaleBureaux",
  // Financials
  "Loyer global": "loyerGlobal",
  "Loyer min.": "loyerMin",
  "Loyer max.": "loyerMax",
  "Prix global": "prixGlobal",
  "Prix min.": "prixMin",
  "Prix max.": "prixMax",
  // Building state (with & without accents)
  "Etat de l'immeuble": "etatImmeuble",
  "État de l'immeuble": "etatImmeuble",
  "État des locaux": "etatLocaux",
  "Etat des locaux": "etatLocaux",
  // Availability
  Disponibilité: "disponibilite",
  Disponibilite: "disponibilite",
  "Disponibilité Date": "disponibiliteDate",
  "Disponibilite Date": "disponibiliteDate",
  "Avis disponibilité": "avisDisponibilite",
  "Avis disponibilite": "avisDisponibilite",
  "Stade de commercialisation": "stadeCommercialisation",
  // Export-only fields
  Qualité: "qualite",
  Qualite: "qualite",
  "Réf. Compte": "refCompte",
  "Ref. Compte": "refCompte",
  Compte: "compte",
  "Réf. Contact": "refContact",
  "Ref. Contact": "refContact",
  Contact: "contact",
  "Assistant(e)": "assistante",
  "Téléphone (Assistant(e))": "telephoneAssistante",
  "Telephone (Assistant(e))": "telephoneAssistante",
  "Mobile (Assistant(e))": "mobileAssistante",
  "Email (Assistant(e))": "emailAssistante",
  "Réf. confrère": "refConfrere",
  "Ref. confrere": "refConfrere",
};

const DATE_FIELDS = new Set<keyof OfferRow>([
  "dateCreation",
  "dateModification",
  "dateMiseAJour",
  "disponibiliteDate",
]);

const NUMBER_FIELDS = new Set<keyof OfferRow>([
  "id",
  "surfaceMini",
  "surfaceTotale",
  "surfaceMiniBureaux",
  "surfaceTotaleBureaux",
  "loyerGlobal",
  "loyerMin",
  "loyerMax",
  "prixGlobal",
  "prixMin",
  "prixMax",
]);

function parseDate(val: unknown): Date | null {
  if (val instanceof Date) return val;
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  if (typeof val === "string" && val.trim()) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function parseNumber(val: unknown): number | null {
  if (typeof val === "number" && isFinite(val)) return val;
  if (typeof val === "string") {
    const n = parseFloat(val.replace(/\s/g, "").replace(",", "."));
    if (isFinite(n)) return n;
  }
  return null;
}

/** Parse a single sheet into typed OfferRow[] */
function parseSheet(ws: XLSX.WorkSheet): OfferRow[] {
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
  });
  return raw.map((row) => {
    const mapped: Partial<OfferRow> = {};
    for (const [header, value] of Object.entries(row)) {
      const key = HEADER_MAP[header.trim()];
      if (!key) continue;

      if (DATE_FIELDS.has(key)) {
        (mapped as Record<string, unknown>)[key] = parseDate(value);
      } else if (NUMBER_FIELDS.has(key)) {
        (mapped as Record<string, unknown>)[key] =
          key === "id" ? (parseNumber(value) ?? 0) : parseNumber(value);
      } else {
        (mapped as Record<string, unknown>)[key] =
          value == null ? "" : String(value).trim();
      }
    }
    return mapped as OfferRow;
  });
}

/** Parse a single XLSX buffer → active + archived offer arrays */
export function parseSingleFile(buffer: ArrayBuffer): {
  activeOffers: OfferRow[];
  archivedOffers: OfferRow[];
} {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });

  const findSheet = (pattern: string): XLSX.WorkSheet | null => {
    const name = wb.SheetNames.find((n) =>
      n.toLowerCase().includes(pattern.toLowerCase()),
    );
    return name ? wb.Sheets[name] : null;
  };

  const isExportFormat = wb.SheetNames.some((n) =>
    n.toLowerCase().includes("offres actives"),
  );

  let activeOffers: OfferRow[] = [];
  let archivedOffers: OfferRow[] = [];

  if (isExportFormat) {
    const activeSheet = findSheet("offres actives");
    const archivedSheet = findSheet("archiv");
    if (activeSheet) activeOffers = parseSheet(activeSheet);
    if (archivedSheet) archivedOffers = parseSheet(archivedSheet);
  } else {
    // KPI or legacy format
    const allSheet = findSheet("all offres") ?? findSheet("hors coworking");
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    activeOffers = allSheet
      ? parseSheet(allSheet)
      : parseSheet(firstSheet);
  }

  return { activeOffers, archivedOffers };
}

/** Parse multiple files into a DashboardData with snapshots */
export function parseMultipleFiles(
  files: { buffer: ArrayBuffer; fileName: string; date: Date }[],
): DashboardData {
  // Parse each file into a snapshot
  const allSnapshots: FileSnapshot[] = files.map(({ buffer, fileName, date }) => {
    const { activeOffers, archivedOffers } = parseSingleFile(buffer);
    return {
      fileName,
      date,
      monthKey: toMonthKey(date),
      activeOffers,
      archivedOffers,
    };
  });

  // Deduplicate by monthKey — keep latest file per month
  const byMonth = new Map<string, FileSnapshot>();
  for (const s of allSnapshots) {
    const existing = byMonth.get(s.monthKey);
    if (!existing || s.date > existing.date) {
      byMonth.set(s.monthKey, s);
    }
  }
  const snapshots = Array.from(byMonth.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  // Most recent snapshot provides the "current state"
  const latest = snapshots[snapshots.length - 1];

  return {
    activeOffers: latest?.activeOffers ?? [],
    archivedOffers: latest?.archivedOffers ?? [],
    snapshots,
    parsedAt: new Date(),
  };
}
