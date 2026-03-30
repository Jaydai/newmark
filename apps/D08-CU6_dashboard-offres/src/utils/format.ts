/** Format a number with French locale separators */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

/** Format a number as a surface area */
export function formatSurface(n: number): string {
  return `${formatNumber(Math.round(n))} m²`;
}

/** Format a number as currency (EUR) */
export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Format a date in French locale */
export function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Truncate text with ellipsis */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

/** Color palette for charts — Newmark brand inspired */
export const CHART_COLORS = [
  "#002855", // Newmark navy
  "#0066cc", // Blue
  "#3b82f6", // Light blue
  "#06b6d4", // Cyan
  "#10b981", // Green
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#64748b", // Slate
  "#14b8a6", // Teal
  "#f97316", // Orange
];
