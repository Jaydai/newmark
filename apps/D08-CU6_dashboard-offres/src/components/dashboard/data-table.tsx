"use client";

import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { OfferRow } from "@/types/kpi";
import { formatNumber, formatDate, formatSurface, formatCurrency, truncate } from "@/utils/format";
import { clsx } from "clsx";

interface Column {
  key: keyof OfferRow;
  label: string;
  format?: (val: unknown) => string;
  width?: string;
}

const COLUMNS: Column[] = [
  { key: "id", label: "N°", width: "w-20" },
  { key: "gestionnaire", label: "Gestionnaire", width: "w-40" },
  { key: "nomImmeuble", label: "Immeuble", width: "w-44", format: (v) => truncate(String(v || "—"), 30) },
  { key: "ville", label: "Ville", width: "w-36" },
  { key: "secteurMarche", label: "Secteur", width: "w-44" },
  { key: "offreDirecte", label: "Directe", width: "w-24" },
  { key: "compte", label: "Société", width: "w-40", format: (v) => truncate(String(v || "—"), 28) },
  { key: "nature", label: "Nature", width: "w-28" },
  { key: "typeContrat", label: "Contrat", width: "w-28" },
  { key: "surfaceTotale", label: "Surface", width: "w-24", format: (v) => (typeof v === "number" && v > 0 ? formatSurface(v) : "—") },
  { key: "loyerMin", label: "Loyer min.", width: "w-24", format: (v) => (typeof v === "number" && v > 0 ? `${formatNumber(Math.round(v))} €` : "—") },
  { key: "disponibilite", label: "Dispo.", width: "w-28" },
  { key: "dateCreation", label: "Créé le", width: "w-28", format: (v) => formatDate(v as Date | null) },
];

interface DataTableProps {
  title: string;
  data: OfferRow[];
}

export function DataTable({ title, data }: DataTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof OfferRow>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const perPage = 20;

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      [row.gestionnaire, row.ville, row.nomImmeuble, row.secteurMarche, row.nature, row.voie, row.compte, String(row.id)]
        .some((v) => v?.toLowerCase().includes(q))
    );
  }, [data, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      let cmp = 0;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else if (va instanceof Date && vb instanceof Date) cmp = va.getTime() - vb.getTime();
      else cmp = String(va).localeCompare(String(vb), "fr");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / perPage);
  const paginated = sorted.slice(page * perPage, (page + 1) * perPage);

  const handleSort = (key: keyof OfferRow) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  };

  const SortIcon = ({ col }: { col: keyof OfferRow }) => {
    if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 text-text-tertiary" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 text-accent" />
    ) : (
      <ChevronDown className="w-3 h-3 text-accent" />
    );
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>
          {title}{" "}
          <span className="text-text-tertiary font-normal">({formatNumber(filtered.length)} résultats)</span>
        </CardTitle>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent w-56"
          />
        </div>
      </CardHeader>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-t border-b border-border bg-surface-hover">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={clsx(
                    "px-3 py-2.5 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-foreground whitespace-nowrap",
                    col.width
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <SortIcon col={col.key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((row, i) => (
              <tr
                key={`${row.id}-${i}`}
                className="border-b border-border/50 hover:bg-surface-hover/50"
              >
                {COLUMNS.map((col) => (
                  <td key={col.key} className={clsx("px-3 py-2.5 text-foreground whitespace-nowrap", col.width)}>
                    {col.format ? col.format(row[col.key]) : (String(row[col.key] ?? "—"))}
                  </td>
                ))}
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-12 text-center text-text-tertiary">
                  Aucun résultat trouvé
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-xs text-text-tertiary">
            Page {page + 1} sur {totalPages}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Précédent
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
