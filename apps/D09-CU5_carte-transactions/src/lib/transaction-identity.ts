import type { Transaction } from "./types";

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

export function buildTransactionSignature(tx: Partial<Transaction>): string {
  return stableSerialize({
    year: tx.year || "",
    type: tx.type || "",
    landlord: tx.landlord || "",
    previousTenant: tx.previousTenant || "",
    newTenant: tx.newTenant || "",
    enseigne: tx.enseigne || "",
    streetNumber: tx.streetNumber || "",
    street: tx.street || "",
    zipCode: tx.zipCode || "",
    city: tx.city || "",
    area: tx.area || "",
    surfaces: tx.surfaces || {},
    totalSurfaceSqm: tx.totalSurfaceSqm ?? null,
    weightedSurfaceSqm: tx.weightedSurfaceSqm ?? null,
    annualHeadlineRent: tx.annualHeadlineRent ?? null,
    keyMoney: tx.keyMoney ?? null,
    rentSqmWeighted: tx.rentSqmWeighted ?? null,
    rentSqmTotal: tx.rentSqmTotal ?? null,
    annualRentReviewed: tx.annualRentReviewed ?? null,
    latestRentKnown: tx.latestRentKnown ?? null,
    leaseDuration: tx.leaseDuration || "",
    breakOptions: tx.breakOptions || "",
    source: tx.source || "",
  });
}

export function hasMeaningfulTransactionData(tx: Partial<Transaction>): boolean {
  if (tx.year || tx.type || tx.landlord || tx.previousTenant || tx.newTenant || tx.enseigne) return true;
  if (tx.streetNumber || tx.street || tx.zipCode || tx.city || tx.area) return true;
  if (tx.leaseDuration || tx.breakOptions || tx.source) return true;

  const numericValues = [
    tx.totalSurfaceSqm,
    tx.weightedSurfaceSqm,
    tx.annualHeadlineRent,
    tx.keyMoney,
    tx.annualRentReviewed,
    tx.latestRentKnown,
    tx.rentSqmWeighted,
    tx.rentSqmTotal,
    tx.lat,
    tx.lng,
    tx.surfaces?.r2,
    tx.surfaces?.r1Storage,
    tx.surfaces?.r1SalesArea,
    tx.surfaces?.rdc,
    tx.surfaces?.r1Plus,
    tx.surfaces?.r2Plus,
    tx.surfaces?.otherSpaces,
  ];

  return numericValues.some((value) => value != null && Number.isFinite(Number(value)));
}

export function buildStableClientTransactionId(signature: string, occurrence: number): string {
  return `import-${stringHash(`${signature}:${occurrence}`)}`;
}
