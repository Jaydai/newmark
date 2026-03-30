import type { OffreRetail } from "./types";

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function stringHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

export function buildOffreRetailSignature(item: Partial<OffreRetail>): string {
  return stableSerialize({
    ref: item.ref || "",
    enseigne: item.enseigne || "",
    adresse: item.adresse || "",
    zipCode: item.zipCode || "",
    city: item.city || "",
    surface: item.surface ?? null,
    loyer: item.loyer ?? null,
    loyerM2: item.loyerM2 ?? null,
    prix: item.prix ?? null,
    typeDeBien: item.typeDeBien || "",
    transactionType: item.transactionType || "",
  });
}

export function hasMeaningfulOffreRetailData(item: Partial<OffreRetail>): boolean {
  if (item.ref || item.enseigne || item.activite) return true;
  if (item.adresse || item.zipCode || item.city || item.quartier) return true;
  if (item.typeDeBien || item.transactionType) return true;

  const numericValues = [
    item.surface, item.prix, item.prixM2, item.droitEntree,
    item.loyer, item.loyerM2, item.depotGarantie, item.honoraires,
  ];

  return numericValues.some((value) => value != null && Number.isFinite(Number(value)));
}

export function buildStableOffreRetailId(signature: string, occurrence: number): string {
  return `or-${stringHash(`${signature}:${occurrence}`)}`;
}
