import type { Visit } from "./types";

const COL_MAP: { field: keyof Visit; patterns: string[] }[] = [
  { field: "name", patterns: ["nom", "name", "visite", "lieu", "site", "immeuble", "actif", "asset", "bien"] },
  { field: "address", patterns: ["adresse", "address", "rue", "street", "localisation", "location"] },
  { field: "duration", patterns: ["duree", "durée", "duration", "temps", "min", "minutes"] },
  { field: "lat", patterns: ["lat", "latitude"] },
  { field: "lng", patterns: ["lng", "lon", "longitude"] },
];

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
}

function matchColumn(header: string): keyof Visit | null {
  const norm = normalizeHeader(header);
  for (const col of COL_MAP) {
    for (const pat of col.patterns) {
      const normPat = normalizeHeader(pat);
      if (norm === normPat || norm.includes(normPat)) return col.field;
    }
  }
  return null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/[\s\u00a0]/g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export async function parseVisitsExcel(buffer: ArrayBuffer): Promise<Visit[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

  if (!rows.length) return [];

  const headers = Object.keys(rows[0]);
  const colMapping: Record<string, keyof Visit> = {};
  headers.forEach((h) => {
    const f = matchColumn(h);
    if (f) colMapping[h] = f;
  });

  if (!colMapping || !Object.values(colMapping).some((f) => f === "name" || f === "address")) {
    throw new Error("Colonnes 'Nom' ou 'Adresse' introuvables. Vérifiez les en-têtes.");
  }

  return rows.flatMap((row, i) => {
    const name = String(row[headers.find((h) => colMapping[h] === "name") ?? ""] || "").trim();
    const address = String(row[headers.find((h) => colMapping[h] === "address") ?? ""] || "").trim();

    if (!name && !address) return [];

    const durationHeader = headers.find((h) => colMapping[h] === "duration");
    const latHeader = headers.find((h) => colMapping[h] === "lat");
    const lngHeader = headers.find((h) => colMapping[h] === "lng");

    const duration = durationHeader ? parseNumber(row[durationHeader]) : null;
    const lat = latHeader ? parseNumber(row[latHeader]) : null;
    const lng = lngHeader ? parseNumber(row[lngHeader]) : null;

    return [{
      name: name || `Visite ${i + 1}`,
      address: address || "",
      duration: duration && duration >= 5 ? Math.round(duration) : 30,
      lat,
      lng,
    }] satisfies Visit[];
  });
}
