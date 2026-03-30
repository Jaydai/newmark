"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { OffreRetail } from "@/lib/types";
import {
  buildOffreRetailSignature,
  hasMeaningfulOffreRetailData,
} from "@/lib/offre-retail-identity";
import { parseOffreRetailBuffer } from "@/lib/parse-offre-retail-xlsx";
import { downloadFile } from "@/lib/graph-client";
import type { AccountInfo, IPublicClientApplication } from "@azure/msal-browser";

const ITEMS_KEY = "newmark_offre_retail_items";
const GEO_KEY = "newmark_offre_retail_geo_cache";
const SP_REF_KEY = "newmark_offre_retail_sp_ref";
const UPDATED_KEY = "newmark_offre_retail_last_updated";

interface SpFileRef {
  driveId: string;
  fileId: string;
  fileName: string;
}

interface ImportResult {
  added: number;
  ignored: number;
}

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}
function save(key: string, val: unknown) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

function sanitizeItem(item: OffreRetail): OffreRetail | null {
  if (!hasMeaningfulOffreRetailData(item)) return null;
  // Compute loyerM2 if missing
  if (item.loyer != null && item.surface != null && item.surface > 0 && item.loyerM2 == null) {
    item.loyerM2 = Math.round(item.loyer / item.surface);
  }
  return item;
}

function sanitizeItems(items: OffreRetail[]): OffreRetail[] {
  return items.flatMap((item) => {
    const sanitized = sanitizeItem(item);
    return sanitized ? [sanitized] : [];
  });
}

function buildSignatureCounts(items: OffreRetail[]): Map<string, number> {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const signature = buildOffreRetailSignature(item);
    counts.set(signature, (counts.get(signature) || 0) + 1);
  });
  return counts;
}

export function useOffreRetailStore() {
  const [importedItems, setImported] = useState<OffreRetail[]>([]);
  const [localAdditions, setLocal] = useState<OffreRetail[]>([]);
  const [geoCache, setGeoCache] = useState<Record<string, { lat: number; lng: number }>>({});
  const [addressFilters, setAddressFilters] = useState<string[]>([]);
  const [spFileRef, setSpFileRefState] = useState<SpFileRef | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const initialized = useRef(false);

  // Load from localStorage
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setImported(sanitizeItems(load<OffreRetail[]>(ITEMS_KEY, [])));
      setLocal([]);
      setGeoCache(load(GEO_KEY, {}));
      setSpFileRefState(load<SpFileRef | null>(SP_REF_KEY, null));
      setLastUpdated(load<string | null>(UPDATED_KEY, null));
      initialized.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Persist
  useEffect(() => { if (initialized.current) save(ITEMS_KEY, importedItems); }, [importedItems]);
  useEffect(() => { if (initialized.current) save(GEO_KEY, geoCache); }, [geoCache]);
  useEffect(() => { if (initialized.current) save(SP_REF_KEY, spFileRef); }, [spFileRef]);
  useEffect(() => { if (initialized.current) save(UPDATED_KEY, lastUpdated); }, [lastUpdated]);

  // Merge all sources
  const items = useMemo<OffreRetail[]>(() => {
    const merged = importedItems.map((item) => {
      const geo = geoCache[item.id];
      if (geo) return { ...item, lat: geo.lat, lng: geo.lng };
      return item;
    });
    return [...merged, ...localAdditions.map((item) => {
      const geo = geoCache[item.id];
      if (geo) return { ...item, lat: geo.lat, lng: geo.lng };
      return item;
    })];
  }, [importedItems, localAdditions, geoCache]);

  // Filter
  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (!item.visible) return false;
      if (addressFilters.length > 0) {
        const addr = (item.adresse || "").toLowerCase();
        if (!addressFilters.some((f) => addr.includes(f))) return false;
      }
      return true;
    });
  }, [addressFilters, items]);

  // Address counts for filter dropdown
  const addressCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      if (item.adresse) {
        const addr = item.adresse.toLowerCase();
        counts[addr] = (counts[addr] || 0) + 1;
      }
    });
    return counts;
  }, [items]);

  const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  const setSpFileRef = useCallback((ref: SpFileRef) => {
    setSpFileRefState(ref);
  }, []);

  const importItems = useCallback((newItems: OffreRetail[]) => {
    const incoming = sanitizeItems(newItems);
    const existingIdSet = new Set(items.map((item) => item.id));
    const existingSignatureCounts = buildSignatureCounts(items);
    const seenBatchSignatureCounts = new Map<string, number>();
    const accepted: OffreRetail[] = [];
    let ignored = 0;

    incoming.forEach((item) => {
      const signature = buildOffreRetailSignature(item);
      const alreadyExisting = existingSignatureCounts.get(signature) || 0;
      const alreadySeenInBatch = seenBatchSignatureCounts.get(signature) || 0;

      seenBatchSignatureCounts.set(signature, alreadySeenInBatch + 1);

      if (existingIdSet.has(item.id) || alreadySeenInBatch < alreadyExisting) {
        ignored += 1;
        return;
      }

      accepted.push(item);
      existingIdSet.add(item.id);
    });

    if (accepted.length > 0) {
      setImported((prev) => [...prev, ...accepted]);
    }

    setLastUpdated(new Date().toISOString());
    return { added: accepted.length, ignored } satisfies ImportResult;
  }, [items]);

  const replaceImportedItems = useCallback((newItems: OffreRetail[]) => {
    const sanitized = sanitizeItems(newItems);
    setImported(sanitized);
    setLastUpdated(new Date().toISOString());
  }, []);

  const refresh = useCallback(async (
    msalInstance: IPublicClientApplication,
    account: AccountInfo,
  ) => {
    if (!spFileRef) return;
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const buffer = await downloadFile(msalInstance, account, spFileRef.driveId, spFileRef.fileId);
      const parsed = await parseOffreRetailBuffer(buffer);
      replaceImportedItems(parsed);
    } catch (e: unknown) {
      setRefreshError(`Erreur de rafraîchissement : ${(e as Error).message}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [spFileRef, replaceImportedItems]);

  const addItem = useCallback((item: Omit<OffreRetail, "id" | "visible">) => {
    const full: OffreRetail = { ...item, id: genId(), visible: true } as OffreRetail;
    if (full.loyer != null && full.surface != null && full.surface > 0 && full.loyerM2 == null) {
      full.loyerM2 = Math.round(full.loyer / full.surface);
    }
    setLocal((prev) => [...prev, full]);
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<OffreRetail>) => {
    setLocal((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx >= 0) {
        return prev.map((t, i) => (i === idx ? { ...t, ...patch } : t));
      }
      return prev;
    });
    if (importedItems.some((t) => t.id === id)) {
      setImported((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
    }
  }, [importedItems]);

  const deleteItem = useCallback((id: string) => {
    setLocal((prev) => {
      if (prev.some((t) => t.id === id)) return prev.filter((t) => t.id !== id);
      return prev;
    });
    if (importedItems.some((t) => t.id === id)) {
      setImported((prev) => prev.map((t) => t.id === id ? { ...t, visible: false } : t));
    }
  }, [importedItems]);

  const toggleVisible = useCallback((id: string) => {
    const item = items.find((t) => t.id === id);
    if (!item) return;
    const newVis = !item.visible;
    setLocal((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx >= 0) return prev.map((t, i) => (i === idx ? { ...t, visible: newVis } : t));
      return prev;
    });
    if (importedItems.some((t) => t.id === id)) {
      setImported((prev) => prev.map((t) => t.id === id ? { ...t, visible: newVis } : t));
    }
  }, [items, importedItems]);

  const updateGeoCache = useCallback((id: string, lat: number, lng: number) => {
    setGeoCache((prev) => ({ ...prev, [id]: { lat, lng } }));
  }, []);

  const toggleAddressFilter = useCallback((addr: string) => {
    const normalized = addr.trim().toLowerCase();
    if (!normalized) return;
    setAddressFilters((prev) =>
      prev.includes(normalized) ? prev.filter((v) => v !== normalized) : [...prev, normalized]
    );
  }, []);

  const clearAddressFilters = useCallback(() => {
    setAddressFilters([]);
  }, []);

  const setAllVisible = useCallback((vis: boolean) => {
    setImported((prev) => prev.map((t) => ({ ...t, visible: vis })));
    setLocal((prev) => prev.map((t) => ({ ...t, visible: vis })));
  }, []);

  return {
    items, filtered, addressCounts, geoCache,
    spFileRef, lastUpdated, isRefreshing, refreshError,
    addressFilters, toggleAddressFilter, clearAddressFilters,
    setSpFileRef, importItems, replaceImportedItems, refresh,
    addItem, updateItem, deleteItem, toggleVisible, setAllVisible,
    updateGeoCache,
  };
}
