import type { Comparable, ParsedExcelData } from "./types";

export function parseExcelRows(rows: (string | number)[][]): ParsedExcelData {
  let refAddr = "";
  for (const row of rows) {
    const cell = String(row[0] || "").trim();
    if (cell && cell.includes(":")) {
      refAddr = cell.split(":").slice(1).join(":").trim();
      break;
    }
  }

  let headerIdx = -1;
  const colMap: Record<string, number> = {};
  const columns: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.length) continue;
    const cells = row.map((c) =>
      String(c)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
    );
    const hasPreneur = cells.some((c) => c.includes("preneur"));
    const hasAdresse = cells.some(
      (c) => c.includes("adresse") || c.includes("address")
    );
    if (hasPreneur && hasAdresse) {
      headerIdx = i;
      cells.forEach((c, j) => {
        if (c === "date") {
          colMap.date = j;
          columns.push("Date");
        } else if (c.includes("preneur")) {
          colMap.preneur = j;
          columns.push("Preneur");
        } else if (c.includes("adresse") || c.includes("address")) {
          colMap.adresse = j;
          columns.push("Adresse");
        } else if (c.includes("surface")) {
          colMap.surface = j;
          columns.push("Surface");
        } else if (c.includes("etat") || c.includes("etat des")) {
          colMap.etat = j;
          columns.push("État");
        } else if (c.includes("loyer")) {
          colMap.loyer = j;
          columns.push("Loyer/m²");
        }
      });
      break;
    }
  }

  if (headerIdx < 0)
    return {
      refAddr: "",
      comps: [],
      columns: [],
      error: "Format non reconnu : colonnes Preneur et Adresse requises.",
    };

  const comps: Comparable[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.some((c) => c !== "" && c != null)) continue;

    const preneur =
      colMap.preneur != null ? String(row[colMap.preneur] || "").trim() : "";
    const adresse =
      colMap.adresse != null ? String(row[colMap.adresse] || "").trim() : "";
    if (!preneur && !adresse) continue;

    comps.push({
      preneur,
      adresse,
      date: colMap.date != null ? String(row[colMap.date] || "") : "",
      surface: colMap.surface != null ? row[colMap.surface] : "",
      etat: colMap.etat != null ? String(row[colMap.etat] || "").trim() : "",
      loyer: colMap.loyer != null ? row[colMap.loyer] : "",
      lat: null,
      lng: null,
    });
  }

  return { refAddr, comps, columns };
}
