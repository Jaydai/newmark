/**
 * Detect a date from a filename.
 *
 * Supported patterns:
 *   "Export 25 mars 2026.xlsx"       → 2026-03-25
 *   "KPI - Janvier 2026.xlsx"        → 2026-01-31 (last day of month)
 *   "Point Offres - Décembre 2025"   → 2025-12-31
 *   "Point Offres - sept 2025"       → 2025-09-30
 */

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const RAW_MONTHS: Record<string, number> = {
  // French full
  janvier: 1, "février": 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, "août": 8, septembre: 9, octobre: 10, novembre: 11, "décembre": 12,
  // French abbreviations
  janv: 1, "fév": 2, avr: 4, juil: 7, "aoû": 8, sept: 9, "déc": 12,
  // English full
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  // Common short (FR + EN)
  jan: 1, feb: 2, fev: 2, mar: 3, apr: 4, jun: 6, jul: 7,
  aug: 8, aou: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// Build lookup with normalized keys (accent-free)
const MONTH_MAP = new Map<string, number>();
for (const [k, v] of Object.entries(RAW_MONTHS)) {
  MONTH_MAP.set(norm(k), v);
}

/** Extract a date from a filename, or null if undetectable */
export function detectDateFromFilename(filename: string): Date | null {
  const base = norm(filename.replace(/\.[^.]+$/, ""));
  const tokens = base.split(/[\s\-–—_.,()/:]+/).filter(Boolean);

  for (let i = 0; i < tokens.length; i++) {
    const monthNum = MONTH_MAP.get(tokens[i]);
    if (!monthNum) continue;

    // Next token must be a 4-digit year
    const yearStr = tokens[i + 1];
    if (!yearStr || !/^\d{4}$/.test(yearStr)) continue;
    const year = parseInt(yearStr, 10);
    if (year < 2000 || year > 2100) continue;

    // Previous token might be a day (1-31)
    if (i > 0 && /^\d{1,2}$/.test(tokens[i - 1])) {
      const day = parseInt(tokens[i - 1], 10);
      if (day >= 1 && day <= 31) {
        return new Date(year, monthNum - 1, day);
      }
    }

    // Month + year only → last day of month
    return new Date(year, monthNum, 0);
  }

  return null;
}

/** Format a Date as YYYY-MM-DD for <input type="date"> */
export function formatDateForInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse a YYYY-MM-DD string from a date input */
export function parseDateInput(value: string): Date | null {
  const d = new Date(value + "T12:00:00");
  return isNaN(d.getTime()) ? null : d;
}

/** Get the month key "YYYY-MM" from a date */
export function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
