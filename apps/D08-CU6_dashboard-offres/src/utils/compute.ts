import type {
  OfferRow,
  Distribution,
  MonthlyDataPoint,
  FileSnapshot,
} from "@/types/kpi";

const MONTH_LABELS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
  "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
];

function monthKeyToLabel(key: string): string {
  const [y, m] = key.split("-");
  const idx = parseInt(m, 10) - 1;
  return `${MONTH_LABELS[idx]} ${y.slice(2)}`;
}

/* ──────────────────────────────────────────────
   Month range helpers (single-file fallback)
   ────────────────────────────────────────────── */

export function getMonthRange(
  months: number,
  refDate: Date,
): { month: string; label: string }[] {
  const result: { month: string; label: string }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    result.push({
      month: `${d.getFullYear()}-${m}`,
      label: `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
    });
  }
  return result;
}

function toMonthKey(d: Date | null): string | null {
  if (!d || isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ──────────────────────────────────────────────
   Single-file date-grouping functions
   ────────────────────────────────────────────── */

export function newOffersPerMonth(
  offers: OfferRow[],
  range: { month: string; label: string }[],
): MonthlyDataPoint[] {
  const counts = new Map<string, number>();
  for (const r of range) counts.set(r.month, 0);
  for (const o of offers) {
    const k = toMonthKey(o.dateCreation);
    if (k && counts.has(k)) counts.set(k, counts.get(k)! + 1);
  }
  return range.map(({ month, label }) => ({
    month,
    label,
    value: counts.get(month) ?? 0,
  }));
}

export function updatedOffersPerMonth(
  offers: OfferRow[],
  range: { month: string; label: string }[],
): MonthlyDataPoint[] {
  const counts = new Map<string, number>();
  for (const r of range) counts.set(r.month, 0);
  for (const o of offers) {
    const updateKey = toMonthKey(o.dateMiseAJour ?? o.dateModification);
    const createKey = toMonthKey(o.dateCreation);
    if (updateKey && counts.has(updateKey) && updateKey !== createKey) {
      counts.set(updateKey, counts.get(updateKey)! + 1);
    }
  }
  return range.map(({ month, label }) => ({
    month,
    label,
    value: counts.get(month) ?? 0,
  }));
}

export function updateRatePerMonth(
  offers: OfferRow[],
  totalActive: number,
  range: { month: string; label: string }[],
): MonthlyDataPoint[] {
  const updated = updatedOffersPerMonth(offers, range);
  return updated.map((p) => ({
    ...p,
    value: totalActive > 0 ? Math.round((p.value / totalActive) * 100) : 0,
  }));
}

export function archivedPerMonth(
  archived: OfferRow[],
  range: { month: string; label: string }[],
): MonthlyDataPoint[] {
  const counts = new Map<string, number>();
  for (const r of range) counts.set(r.month, 0);
  for (const o of archived) {
    const k = toMonthKey(
      o.dateMiseAJour ?? o.dateModification ?? o.dateCreation,
    );
    if (k && counts.has(k)) counts.set(k, counts.get(k)! + 1);
  }
  return range.map(({ month, label }) => ({
    month,
    label,
    value: counts.get(month) ?? 0,
  }));
}

/* ──────────────────────────────────────────────
   Multi-file snapshot-based evolution functions
   ────────────────────────────────────────────── */

/** Total active offers at each snapshot point */
export function snapshotActiveEvolution(
  snapshots: FileSnapshot[],
): MonthlyDataPoint[] {
  return snapshots.map((s) => ({
    month: s.monthKey,
    label: monthKeyToLabel(s.monthKey),
    value: s.activeOffers.length,
  }));
}

/** New offers per snapshot — count offers created in that snapshot's month */
export function snapshotNewOffers(
  snapshots: FileSnapshot[],
): MonthlyDataPoint[] {
  return snapshots.map((s) => {
    const count = s.activeOffers.filter((o) => {
      const k = toMonthKey(o.dateCreation);
      return k === s.monthKey;
    }).length;
    return {
      month: s.monthKey,
      label: monthKeyToLabel(s.monthKey),
      value: count,
    };
  });
}

/** Updated offers per snapshot — count offers with dateMiseAJour in that month */
export function snapshotUpdatedOffers(
  snapshots: FileSnapshot[],
): MonthlyDataPoint[] {
  return snapshots.map((s) => {
    const count = s.activeOffers.filter((o) => {
      const updateKey = toMonthKey(o.dateMiseAJour ?? o.dateModification);
      const createKey = toMonthKey(o.dateCreation);
      return updateKey === s.monthKey && updateKey !== createKey;
    }).length;
    return {
      month: s.monthKey,
      label: monthKeyToLabel(s.monthKey),
      value: count,
    };
  });
}

/** Update rate (%) per snapshot */
export function snapshotUpdateRate(
  snapshots: FileSnapshot[],
): MonthlyDataPoint[] {
  return snapshots.map((s) => {
    const total = s.activeOffers.length;
    const updated = s.activeOffers.filter((o) => {
      const updateKey = toMonthKey(o.dateMiseAJour ?? o.dateModification);
      const createKey = toMonthKey(o.dateCreation);
      return updateKey === s.monthKey && updateKey !== createKey;
    }).length;
    return {
      month: s.monthKey,
      label: monthKeyToLabel(s.monthKey),
      value: total > 0 ? Math.round((updated / total) * 100) : 0,
    };
  });
}

/** Archived offers per snapshot */
export function snapshotArchivedEvolution(
  snapshots: FileSnapshot[],
): MonthlyDataPoint[] {
  return snapshots.map((s) => ({
    month: s.monthKey,
    label: monthKeyToLabel(s.monthKey),
    value: s.archivedOffers.length,
  }));
}

/** Filter each snapshot's offers by a predicate (for per-tab views) */
export function filterSnapshots(
  snapshots: FileSnapshot[],
  predicate: (row: OfferRow) => boolean,
): FileSnapshot[] {
  return snapshots.map((s) => ({
    ...s,
    activeOffers: s.activeOffers.filter(predicate),
    archivedOffers: s.archivedOffers.filter(predicate),
  }));
}

/* ──────────────────────────────────────────────
   Common analysis functions
   ────────────────────────────────────────────── */

export function isDirectOffer(row: OfferRow): boolean {
  const v = (row.offreDirecte || "").toLowerCase().trim();
  if (v === "oui" || v === "o" || v === "true") return true;
  if (v === "non" || v === "n" || v === "false") return false;
  return !(row.gestionnaire || "").toLowerCase().includes("confr");
}

export function directVsConfreres(offers: OfferRow[]) {
  let direct = 0;
  let confreres = 0;
  for (const o of offers) {
    if (isDirectOffer(o)) direct++;
    else confreres++;
  }
  const total = direct + confreres;
  return {
    direct,
    confreres,
    directPct: total > 0 ? Math.round((direct / total) * 100) : 0,
    confreresPct: total > 0 ? Math.round((confreres / total) * 100) : 0,
  };
}

export function offersByCompany(offers: OfferRow[]): Distribution[] {
  const counts = new Map<string, number>();
  for (const o of offers) {
    const company = isDirectOffer(o)
      ? "Newmark"
      : o.compte?.trim() || "Confrère (non spécifié)";
    counts.set(company, (counts.get(company) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function countBy(
  rows: OfferRow[],
  field: keyof OfferRow,
): Distribution[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const val = String(row[field] ?? "").trim();
    if (!val) continue;
    counts.set(val, (counts.get(val) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function directConfreresBySector(
  offers: OfferRow[],
): { sector: string; direct: number; confreres: number }[] {
  const map = new Map<string, { direct: number; confreres: number }>();
  for (const o of offers) {
    const sector = o.secteurMarche?.trim();
    if (!sector) continue;
    if (!map.has(sector)) map.set(sector, { direct: 0, confreres: 0 });
    const entry = map.get(sector)!;
    if (isDirectOffer(o)) entry.direct++;
    else entry.confreres++;
  }
  return Array.from(map.entries())
    .map(([sector, c]) => ({ sector, ...c }))
    .sort((a, b) => b.direct + b.confreres - (a.direct + a.confreres));
}

export function getRefDate(offers: OfferRow[]): Date {
  let max = new Date(0);
  for (const o of offers) {
    for (const d of [o.dateCreation, o.dateMiseAJour, o.dateModification]) {
      if (d && d > max) max = d;
    }
  }
  return max > new Date(0) ? max : new Date();
}
