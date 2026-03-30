import type { OffreRetail } from "./types";
import {
  buildStableOffreRetailId,
  buildOffreRetailSignature,
  hasMeaningfulOffreRetailData,
} from "./offre-retail-identity";

const COL_MAP: { field: string; patterns: string[] }[] = [
  { field: "ref", patterns: ["ref.", "ref", "reference", "réf", "réf."] },
  { field: "nego", patterns: ["nego", "négo", "negociateur", "négociateur"] },
  { field: "origine", patterns: ["origine", "origin"] },
  { field: "typeDeBien", patterns: ["type de bien", "type bien"] },
  { field: "transactionType", patterns: ["transac.", "transac", "transaction"] },
  { field: "enseigne", patterns: ["enseigne", "marque", "brand"] },
  { field: "activite", patterns: ["activite", "activité", "activity"] },
  { field: "adresse", patterns: ["adresse", "address", "rue"] },
  { field: "zipCode", patterns: ["cp", "code postal", "zip"] },
  { field: "city", patterns: ["ville", "city"] },
  { field: "quartier", patterns: ["quartier", "zone", "secteur"] },
  { field: "surface", patterns: ["surf", "surface"] },
  { field: "prix", patterns: ["prix", "price"] },
  { field: "mentionsSurPrix", patterns: ["mentions sur prix"] },
  { field: "prixM2", patterns: ["prix/m2", "prix m2", "prix/m²"] },
  { field: "droitEntree", patterns: ["droit d'entree", "droit d'entrée", "droit entree", "droit dentree"] },
  { field: "loyer", patterns: ["loyer", "rent", "loyer annuel"] },
  { field: "mentionsSurLoyer", patterns: ["mentions sur loyer"] },
  { field: "loyerM2", patterns: ["loyer/m2", "loyer m2", "loyer/m²"] },
  { field: "loyerHorsCharges", patterns: ["loyer hors charges"] },
  { field: "charges", patterns: ["charges"] },
  { field: "typeDeBail", patterns: ["type de bail", "bail"] },
  { field: "commentairesBail", patterns: ["commentaires du bail", "commentaires bail"] },
  { field: "depotGarantie", patterns: ["depot de garantie", "dépôt de garantie", "depot garantie"] },
  { field: "taxeFonciere", patterns: ["taxe fonciere", "taxe foncière"] },
  { field: "paiementTaxeFonciere", patterns: ["paiement taxe fonciere", "paiement taxe foncière"] },
  { field: "honoraires", patterns: ["honoraires", "fees"] },
  { field: "occupation", patterns: ["occupation"] },
  { field: "locataire", patterns: ["locataire", "tenant"] },
  { field: "libreDate", patterns: ["libre le", "disponible le"] },
];

const NUMERIC_FIELDS = new Set([
  "surface", "prix", "prixM2", "droitEntree",
  "loyer", "loyerM2", "depotGarantie", "honoraires",
]);

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s+\-/'.]/g, "").replace(/\s+/g, " ");
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
  if (field === "zipCode" && typeof value === "number") {
    return String(Math.round(value)).padStart(5, "0");
  }
  if (typeof value === "string") { const t = value.trim(); return t || null; }
  if (typeof value === "number") return String(value);
  return value;
}

export async function parseOffreRetailBuffer(buffer: ArrayBuffer): Promise<OffreRetail[]> {
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

  const seenSignatures = new Map<string, number>();

  return rows.flatMap((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item: any = { lat: null, lng: null, visible: true };
    for (const [header, field] of Object.entries(colMapping)) {
      const value = normalizeCellValue(field, row[header]);
      if (value == null) continue;
      item[field] = value;
    }

    if (!hasMeaningfulOffreRetailData(item)) return [];

    // Compute loyerM2 if missing
    if (item.loyer != null && item.surface != null && item.surface > 0 && item.loyerM2 == null) {
      item.loyerM2 = Math.round(item.loyer / item.surface);
    }

    const signature = buildOffreRetailSignature(item);
    const occurrence = seenSignatures.get(signature) || 0;
    seenSignatures.set(signature, occurrence + 1);
    item.id = buildStableOffreRetailId(signature, occurrence);
    return [item as OffreRetail];
  });
}
