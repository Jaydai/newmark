import type { Transaction } from "./types";

function toFinite(v: number | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function computeFields(tx: Transaction): void {
  const s = tx.surfaces || {};
  const parts = [s.r2, s.r1Storage, s.r1SalesArea, s.rdc, s.r1Plus, s.r2Plus, s.otherSpaces];
  const sum = parts.reduce<number>((acc, v) => acc + (toFinite(v) || 0), 0);
  if (toFinite(tx.totalSurfaceSqm) == null && sum > 0) tx.totalSurfaceSqm = sum;

  const rent = toFinite(tx.annualHeadlineRent);
  const weighted = toFinite(tx.weightedSurfaceSqm);
  const total = toFinite(tx.totalSurfaceSqm);

  if (rent != null && weighted != null && weighted > 0 && toFinite(tx.rentSqmWeighted) == null) {
    tx.rentSqmWeighted = Math.round(rent / weighted);
  }
  if (rent != null && total != null && total > 0 && toFinite(tx.rentSqmTotal) == null) {
    tx.rentSqmTotal = Math.round(rent / total);
  }
}
