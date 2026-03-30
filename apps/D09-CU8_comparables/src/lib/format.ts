export function fmtSurface(v: string | number | null | undefined): string {
  if (!v && v !== 0) return "-";
  const n = parseFloat(String(v));
  if (isNaN(n)) return "-";
  return n.toLocaleString("fr-FR") + " m²";
}

export function fmtLoyer(v: string | number | null | undefined): string {
  if (!v && v !== 0) return "-";
  const n = parseFloat(String(v));
  if (isNaN(n)) return "-";
  return n.toLocaleString("fr-FR") + " €/m²";
}
