export function fmtSurface(v: number | null | undefined): string {
  if (v == null) return "-";
  return Math.round(v).toLocaleString("fr-FR") + " m²";
}

export function fmtLoyer(v: number | null | undefined): string {
  if (v == null) return "-";
  return Math.round(v).toLocaleString("fr-FR") + " €/m²";
}

export function fmtEuro(v: number | null | undefined): string {
  if (v == null) return "-";
  return Math.round(v).toLocaleString("fr-FR") + " €";
}

export function fmtNumber(v: number | null | undefined): string {
  if (v == null) return "-";
  return Math.round(v).toLocaleString("fr-FR");
}
