import type { Transaction } from "./types";
import { computeFields } from "./transaction-fields";
import {
  buildStableClientTransactionId,
  buildTransactionSignature,
  hasMeaningfulTransactionData,
} from "./transaction-identity";

/**
 * Client-side Excel parser — mirrors lib/parse-xlsx.js column mapping
 * but runs in the browser using the xlsx library.
 */

const COL_MAP: { field: string; patterns: string[] }[] = [
  { field: "year", patterns: ["year", "annee", "année", "date", "ann"] },
  { field: "type", patterns: ["type", "nature", "operation"] },
  { field: "landlord", patterns: ["landlord", "bailleur", "proprietaire", "propriétaire", "owner"] },
  { field: "previousTenant", patterns: ["previous tenant", "preneur sortant", "ancien locataire", "locataire sortant", "sortant"] },
  { field: "newTenant", patterns: ["new tenant", "preneur entrant", "nouveau locataire", "locataire entrant", "entrant", "preneur"] },
  { field: "enseigne", patterns: ["enseigne", "ngel", "marque", "brand", "sign"] },
  { field: "streetNumber", patterns: ["street number", "numero", "numéro", "n°", "no", "num"] },
  { field: "street", patterns: ["street", "rue", "voie", "adresse", "address"] },
  { field: "zipCode", patterns: ["zip code", "zip", "code postal", "cp", "code"] },
  { field: "city", patterns: ["city", "ville", "commune"] },
  { field: "area", patterns: ["area", "quartier", "zone", "secteur", "arrondissement", "arr"] },
  { field: "surfaces.r2", patterns: ["surface (r-2)", "r-2", "r2", "sous-sol"] },
  { field: "surfaces.r1Storage", patterns: ["surface (r-1 - storage)", "r-1 - storage", "r-1 stock", "stockage", "reserve"] },
  { field: "surfaces.r1SalesArea", patterns: ["surface (r-1 -  sales area)", "surface (r-1 - sales area)", "r-1 - sales", "r-1 vente", "sales area"] },
  { field: "surfaces.rdc", patterns: ["surface (rdc)", "rdc", "rez-de-chaussée", "ground"] },
  { field: "surfaces.r1Plus", patterns: ["surface (r+1)", "r+1", "r1+", "1er"] },
  { field: "surfaces.r2Plus", patterns: ["surface (r+2)", "r+2", "r2+", "2eme"] },
  { field: "surfaces.otherSpaces", patterns: ["other spaces", "other spaces / offices", "autres", "other", "divers", "annexe"] },
  { field: "totalSurfaceSqm", patterns: ["total surface sqm", "surface totale", "total surface", "total m2"] },
  { field: "weightedSurfaceSqm", patterns: ["weighted surface sqm", "surface ponderée", "weighted surface", "ponderee"] },
  { field: "annualHeadlineRent", patterns: ["annual headline rent", "loyer facial", "loyer annuel", "headline rent"] },
  { field: "keyMoney", patterns: ["key money", "pas de porte", "droit au bail"] },
  { field: "rentSqmWeighted", patterns: ["rent / sqm weighted", "rent/sqm weighted", "loyer/m2 pondere", "rent sqm weighted"] },
  { field: "rentSqmTotal", patterns: ["rent / sqm total", "rent/sqm total", "loyer/m2 total", "rent sqm total"] },
  { field: "annualRentReviewed", patterns: ["annual rent reviewed", "loyer révisé", "loyer revise", "revised rent"] },
  { field: "latestRentKnown", patterns: ["latest rent known", "dernier loyer", "latest rent", "loyer connu"] },
  { field: "leaseDuration", patterns: ["lease duration", "duree bail", "durée bail", "lease", "duree"] },
  { field: "breakOptions", patterns: ["break options", "break option", "option sortie", "break"] },
  { field: "source", patterns: ["source", "origine", "reference"] },
];

const NUMERIC_FIELDS = new Set([
  "surfaces.r2", "surfaces.r1Storage", "surfaces.r1SalesArea", "surfaces.rdc",
  "surfaces.r1Plus", "surfaces.r2Plus", "surfaces.otherSpaces",
  "totalSurfaceSqm", "weightedSurfaceSqm", "annualHeadlineRent", "keyMoney",
  "rentSqmWeighted", "rentSqmTotal", "annualRentReviewed", "latestRentKnown",
]);

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s+\-/]/g, "").replace(/\s+/g, " ");
}

function matchColumn(header: string): string | null {
  const norm = normalizeHeader(header);
  let bestMatch: string | null = null;
  let bestScore = 0;
  for (const col of COL_MAP) {
    for (const pat of col.patterns) {
      const normPat = normalizeHeader(pat);
      if (norm === normPat) return col.field;
      if (norm.includes(normPat) || normPat.includes(norm)) {
        if (normPat.length > bestScore) { bestScore = normPat.length; bestMatch = col.field; }
      }
    }
  }
  return bestMatch;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setNestedField(obj: any, path: string, value: unknown) {
  const parts = path.split(".");
  if (parts.length === 1) { obj[parts[0]] = value; return; }
  if (!obj[parts[0]]) obj[parts[0]] = {};
  obj[parts[0]][parts[1]] = value;
}

function parseNumberLike(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let cleaned = value.trim();
  if (!cleaned || !/\d/.test(cleaned)) return null;
  cleaned = cleaned.replace(/[\s\u00a0\u202f]/g, "").replace(/[^0-9,.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === ",") return null;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimalPos = Math.max(lastComma, lastDot);
  if (decimalPos >= 0) {
    const intPart = cleaned.slice(0, decimalPos).replace(/[.,]/g, "");
    const fracPart = cleaned.slice(decimalPos + 1).replace(/[.,]/g, "");
    cleaned = fracPart ? `${intPart}.${fracPart}` : intPart;
  } else {
    cleaned = cleaned.replace(/[.,]/g, "");
  }
  if (!cleaned || cleaned === "-") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCellValue(field: string, value: unknown): unknown {
  if (value === "" || value == null) return null;
  if (NUMERIC_FIELDS.has(field)) return parseNumberLike(value);
  if ((field === "streetNumber" || field === "zipCode" || field === "year") && typeof value === "number") {
    return String(Math.round(value));
  }
  if (typeof value === "string") { const t = value.trim(); return t || null; }
  return value;
}

/**
 * Parse an ArrayBuffer from an Excel file into Transaction[].
 * Uses dynamic import so xlsx is only loaded when needed.
 */
export async function parseExcelBuffer(buffer: ArrayBuffer): Promise<Transaction[]> {
  const XLSX = await import("xlsx");
  const data = new Uint8Array(buffer);
  const wb = XLSX.read(data, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

  if (!rows.length) return [];

  const headers = Object.keys(rows[0]);
  const colMapping: Record<string, string> = {};
  headers.forEach((h) => { const f = matchColumn(h); if (f) colMapping[h] = f; });

  // Heuristic: column before "street" without a match → streetNumber
  if (!Object.values(colMapping).includes("streetNumber")) {
    const streetHeader = headers.find((h) => colMapping[h] === "street");
    if (streetHeader) {
      const idx = headers.indexOf(streetHeader);
      if (idx > 0 && !colMapping[headers[idx - 1]]) colMapping[headers[idx - 1]] = "streetNumber";
    }
  }

  const seenSignatures = new Map<string, number>();

  return rows.flatMap((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx: any = { surfaces: {}, lat: null, lng: null, visible: true };
    for (const [header, field] of Object.entries(colMapping)) {
      const value = normalizeCellValue(field, row[header]);
      if (value == null) continue;
      setNestedField(tx, field, value);
    }

    if (!hasMeaningfulTransactionData(tx)) return [];

    computeFields(tx);

    const signature = buildTransactionSignature(tx);
    const occurrence = seenSignatures.get(signature) || 0;
    seenSignatures.set(signature, occurrence + 1);
    tx.id = buildStableClientTransactionId(signature, occurrence);
    return [tx as Transaction];
  });
}
