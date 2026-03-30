"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { OffreRetail } from "@/lib/types";
import { hasCoords } from "@/lib/geocode";
import { fmtSurface, fmtEuro } from "@/lib/format";
import { Search, X, Eye, EyeOff, MapPin, Plus, Trash2, FileUp, RefreshCw, Loader2 } from "lucide-react";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  return `il y a ${Math.floor(hrs / 24)}j`;
}

interface SidebarProps {
  items: OffreRetail[];
  filtered: OffreRetail[];
  addressCounts: Record<string, number>;
  addressFilters: string[];
  onAddressToggle: (address: string) => void;
  onAddressFiltersClear: () => void;
  onToggleVisible: (id: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  onSelect: (item: OffreRetail) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onImport: () => void;
  onGeocode: () => void;
  ungeocodedCount: number;
  geocoding: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastUpdated: string | null;
  hasSpFileRef: boolean;
}

export default function ORSidebar({
  items, filtered, addressCounts, addressFilters, onAddressToggle, onAddressFiltersClear,
  onToggleVisible, onShowAll, onHideAll, onSelect, onDelete, onAdd, onImport, onGeocode,
  ungeocodedCount, geocoding, onRefresh, isRefreshing, lastUpdated, hasSpFileRef,
}: SidebarProps) {
  const [searchText, setSearchText] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const addresses = useMemo(() => {
    const entries = Object.entries(addressCounts).sort((a, b) => b[1] - a[1]);
    if (!searchText) return entries;
    const q = searchText.toLowerCase();
    return entries.filter(([a]) => a.toLowerCase().includes(q));
  }, [addressCounts, searchText]);

  const onMap = filtered.filter((o) => hasCoords(o.lat, o.lng)).length;
  const toGeocode = filtered.filter((o) => !hasCoords(o.lat, o.lng)).length;
  const hidden = items.filter((o) => !o.visible).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <div className="fixed left-0 top-[var(--bar-h)] bottom-0 w-[var(--sidebar-w)] bg-white border-r border-border z-[900] flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
        {/* Address search */}
        <div className="relative mb-3" ref={containerRef}>
          <div className="flex items-start gap-2 border-[1.5px] border-border-input rounded-lg px-3 py-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/10">
            <Search className="w-3.5 h-3.5 text-text-tertiary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              {addressFilters.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {addressFilters.map((address) => (
                    <button
                      key={address}
                      onClick={() => onAddressToggle(address)}
                      className="inline-flex max-w-full items-center gap-1 rounded-md bg-accent-light px-2 py-1 text-[10px] font-medium text-accent hover:bg-accent-light/80 transition-colors"
                    >
                      <span className="capitalize truncate">{address}</span>
                      <X className="w-3 h-3 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
              <input
                ref={searchInputRef}
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setDropdownOpen(true); }}
                onFocus={() => setDropdownOpen(true)}
                placeholder={addressFilters.length > 0 ? "Ajouter une autre adresse…" : "Rechercher une adresse…"}
                className="w-full border-none outline-none text-xs bg-transparent"
              />
            </div>
            {(addressFilters.length > 0 || searchText) && (
              <button
                onClick={() => {
                  setSearchText("");
                  if (addressFilters.length > 0) onAddressFiltersClear();
                  searchInputRef.current?.focus();
                }}
                className="text-text-tertiary hover:text-foreground mt-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {dropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-border shadow-lg max-h-48 overflow-y-auto z-50">
              <button
                onClick={() => {
                  onAddressFiltersClear();
                  setSearchText("");
                  setDropdownOpen(false);
                  searchInputRef.current?.focus();
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-surface-hover transition-colors flex justify-between border-b border-border"
              >
                <span className="font-semibold">Toutes les adresses</span>
                <span className="text-text-tertiary">{items.length}</span>
              </button>
              {addresses.length === 0 ? (
                <div className="px-3 py-2 text-xs text-text-tertiary">Aucune adresse trouvée.</div>
              ) : (
                addresses.slice(0, 20).map(([address, count]) => {
                  const selected = addressFilters.includes(address);

                  return (
                    <button
                      key={address}
                      onClick={() => {
                        onAddressToggle(address);
                        setSearchText("");
                        setDropdownOpen(true);
                        searchInputRef.current?.focus();
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-surface-hover transition-colors flex items-center justify-between ${
                        selected ? "bg-accent-light" : ""
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                            selected ? "border-accent bg-accent" : "border-border-input bg-white"
                          }`}
                        >
                          {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                        <span className="capitalize truncate">{address}</span>
                      </span>
                      <span className="text-text-tertiary shrink-0 ml-2">{count}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mb-3">
          <button onClick={onShowAll} className="flex-1 py-1.5 text-[10px] font-semibold border border-border-input rounded-md hover:bg-surface-hover transition-colors flex items-center justify-center gap-1">
            <Eye className="w-3 h-3" /> Tout afficher
          </button>
          <button onClick={onHideAll} className="flex-1 py-1.5 text-[10px] font-semibold border border-border-input rounded-md hover:bg-surface-hover transition-colors flex items-center justify-center gap-1">
            <EyeOff className="w-3 h-3" /> Tout masquer
          </button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Carte", value: onMap, color: "var(--map-blue)" },
            { label: "À Géocoder", value: toGeocode, color: "var(--warning)" },
            { label: "Masquées", value: hidden, color: "var(--text-tertiary)" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-surface-alt rounded-lg p-2 text-center">
              <div className="text-base font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
              <div className="text-[8px] text-text-tertiary uppercase tracking-wider font-medium">{kpi.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-secondary">
            Aucune offre à afficher.
          </div>
        ) : (
          filtered.map((item) => (
            <div key={item.id}
              className="flex items-start gap-2 px-4 py-2.5 border-b border-border/50 hover:bg-surface-hover/50 transition-colors group cursor-pointer"
              onClick={() => onSelect(item)}
            >
              <input
                type="checkbox"
                checked={item.visible}
                onChange={(e) => { e.stopPropagation(); onToggleVisible(item.id); }}
                onClick={(e) => e.stopPropagation()}
                className="mt-1 shrink-0 cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">
                  {item.enseigne || item.ref || "Offre"}
                </div>
                <div className="text-[10px] text-text-secondary truncate">{item.adresse}</div>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {item.surface != null && <span className="text-[9px] bg-surface-alt text-text-secondary px-1.5 py-0.5 rounded">{fmtSurface(item.surface)}</span>}
                  {item.loyer != null && <span className="text-[9px] bg-surface-alt text-text-secondary px-1.5 py-0.5 rounded">{fmtEuro(item.loyer)}</span>}
                  {item.transactionType && <span className="text-[9px] bg-surface-alt text-text-secondary px-1.5 py-0.5 rounded">{item.transactionType}</span>}
                  {!hasCoords(item.lat, item.lng) && <span className="text-[9px] bg-warning/10 text-warning px-1.5 py-0.5 rounded font-medium">⚠ Non localisé</span>}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger transition-all p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border shrink-0 flex flex-col gap-2">
        {hasSpFileRef && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-full py-2 text-[11px] font-semibold border-[1.5px] border-border-input rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-1"
          >
            {isRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Rafraîchir
            {lastUpdated && (
              <span className="text-text-tertiary font-normal ml-1">({relativeTime(lastUpdated)})</span>
            )}
          </button>
        )}
        {ungeocodedCount > 0 && (
          <button
            onClick={onGeocode}
            disabled={geocoding}
            className="w-full py-2 text-[11px] font-semibold border-[1.5px] border-accent text-accent rounded-lg hover:bg-accent/5 transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            <MapPin className="w-3.5 h-3.5 inline mr-1" />
            Géocoder ({ungeocodedCount} non localisés)
          </button>
        )}
        <button
          onClick={onImport}
          className="w-full py-2 text-[11px] font-semibold border-[1.5px] border-border-input rounded-lg hover:bg-surface-hover transition-colors flex items-center justify-center gap-1"
        >
          <FileUp className="w-3.5 h-3.5" />
          Importer depuis SharePoint
        </button>
        <button
          onClick={onAdd}
          className="w-full py-2.5 text-[11px] font-semibold bg-accent text-white border-none rounded-lg hover:bg-accent/90 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 inline mr-1" />
          Ajouter une offre
        </button>
      </div>
    </div>
  );
}
