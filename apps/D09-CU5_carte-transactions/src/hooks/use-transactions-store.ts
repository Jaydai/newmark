"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Transaction } from "@/lib/types";
import { computeFields } from "@/lib/transaction-fields";
import { buildTransactionSignature, hasMeaningfulTransactionData } from "@/lib/transaction-identity";

const LOCAL_KEY = "newmark_local_additions";
const OVERRIDE_KEY = "newmark_api_overrides";
const GEO_KEY = "newmark_geo_cache";
const YEAR_KEY = "newmark_transactions_year_filter";
const TX_DATA_ENDPOINT_API = "/api/transactions";
const TX_DATA_ENDPOINT_STATIC = "/data/transactions.json";
const TX_HASH_ENDPOINT_API = "/api/transactions/hash";
const TX_HASH_ENDPOINT_STATIC = "/data/transactions-hash.json";

type FetchSource = "api" | "static";

interface ImportResult {
  added: number;
  ignored: number;
}

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}
function save(key: string, val: unknown) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

async function fetchJsonWithFallback(urls: string[]) {
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status} on ${url}`);
      return { url, data: await response.json() };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error("No endpoint available");
}

function sanitizeTransaction(tx: Transaction): Transaction | null {
  const next: Transaction = {
    ...tx,
    surfaces: { ...(tx.surfaces || {}) },
  };

  if (!hasMeaningfulTransactionData(next)) return null;
  computeFields(next);
  return next;
}

function sanitizeTransactions(txs: Transaction[]): Transaction[] {
  return txs.flatMap((tx) => {
    const sanitized = sanitizeTransaction(tx);
    return sanitized ? [sanitized] : [];
  });
}

function buildSignatureCounts(txs: Transaction[]): Map<string, number> {
  const counts = new Map<string, number>();
  txs.forEach((tx) => {
    const signature = buildTransactionSignature(tx);
    counts.set(signature, (counts.get(signature) || 0) + 1);
  });
  return counts;
}

export function useTransactionsStore() {
  const [apiTransactions, setApiTx] = useState<Transaction[]>([]);
  const [localAdditions, setLocal] = useState<Transaction[]>([]);
  const [apiOverrides, setOverrides] = useState<Record<string, Partial<Transaction>>>({});
  const [geoCache, setGeoCache] = useState<Record<string, { lat: number; lng: number }>>({});
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [streetFilters, setStreetFilters] = useState<string[]>([]);
  const [hash, setHash] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pollWarning, setPollWarning] = useState<string | null>(null);
  const initialized = useRef(false);
  const sourceRef = useRef<FetchSource>("static");
  const lastHashRef = useRef("");

  // Load from localStorage + fetch data
  useEffect(() => {
    const initTimer = window.setTimeout(() => {
      const saved = sanitizeTransactions(load<Transaction[]>(LOCAL_KEY, []));
      setLocal(saved);
      setOverrides(load(OVERRIDE_KEY, {}));
      setGeoCache(load(GEO_KEY, {}));
      const yf = load<{ from: string; to: string }>(YEAR_KEY, { from: "", to: "" });
      setYearFrom(yf.from);
      setYearTo(yf.to);
      initialized.current = true;
    }, 0);

    return () => {
      window.clearTimeout(initTimer);
    };
  }, []);

  const fetchTransactions = useCallback(async () => {
    const orderedDataUrls = sourceRef.current === "static"
      ? [TX_DATA_ENDPOINT_STATIC, TX_DATA_ENDPOINT_API]
      : [TX_DATA_ENDPOINT_API, TX_DATA_ENDPOINT_STATIC];

    const result = await fetchJsonWithFallback(orderedDataUrls);
    const payload = result.data;
    if (!payload || !Array.isArray(payload.transactions)) {
      throw new Error("Malformed transactions payload");
    }

    const nextTransactions = sanitizeTransactions(payload.transactions as Transaction[]);
    const nextHash = payload.hash || "";

    sourceRef.current = result.url === TX_DATA_ENDPOINT_STATIC ? "static" : "api";
    lastHashRef.current = nextHash;
    setApiTx(nextTransactions);
    setHash(nextHash);
    setFetchError(null);
    setPollWarning(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | null = null;

    const start = async () => {
      try {
        await fetchTransactions();
      } catch {
        if (!cancelled) {
          setFetchError("Impossible de charger les transactions. Les données affichées peuvent être incomplètes.");
        }
      }

      pollTimer = window.setInterval(async () => {
        try {
          const result = await fetchJsonWithFallback([TX_HASH_ENDPOINT_API, TX_HASH_ENDPOINT_STATIC]);
          const nextHash = result.data?.hash || "";
          sourceRef.current = result.url === TX_HASH_ENDPOINT_STATIC ? "static" : "api";

          if (nextHash && nextHash !== lastHashRef.current) {
            await fetchTransactions();
          } else if (!cancelled) {
            setPollWarning(null);
          }
        } catch {
          if (!cancelled && !fetchError) {
            setPollWarning("Vérification des mises à jour indisponible pour le moment.");
          }
        }
      }, 30000);
    };

    void start();

    return () => {
      cancelled = true;
      if (pollTimer) window.clearInterval(pollTimer);
    };
  }, [fetchTransactions, fetchError]);

  // Persist
  useEffect(() => { if (initialized.current) save(LOCAL_KEY, localAdditions); }, [localAdditions]);
  useEffect(() => { if (initialized.current) save(OVERRIDE_KEY, apiOverrides); }, [apiOverrides]);
  useEffect(() => { if (initialized.current) save(GEO_KEY, geoCache); }, [geoCache]);
  useEffect(() => { if (initialized.current) save(YEAR_KEY, { from: yearFrom, to: yearTo }); }, [yearFrom, yearTo]);

  // Merge all sources
  const transactions = useMemo<Transaction[]>(() => {
    const merged = apiTransactions.map((tx) => {
      const over = apiOverrides[tx.id];
      const geo = geoCache[tx.id];
      const base = over ? { ...tx, ...over } : tx;
      if (geo) return { ...base, lat: geo.lat, lng: geo.lng };
      return base;
    });
    return [...merged, ...localAdditions];
  }, [apiOverrides, apiTransactions, geoCache, localAdditions]);

  // Filter
  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (!tx.visible) return false;
      if (yearFrom && Number(tx.year) < Number(yearFrom)) return false;
      if (yearTo && Number(tx.year) > Number(yearTo)) return false;
      if (streetFilters.length > 0 && !streetFilters.includes((tx.street || "").toLowerCase())) return false;
      return true;
    });
  }, [streetFilters, transactions, yearFrom, yearTo]);

  // All years for dropdowns
  const allYears = useMemo(() => {
    return [...new Set(transactions.map((t) => t.year).filter(Boolean))].sort();
  }, [transactions]);

  // All streets for search
  const streetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    transactions.forEach((tx) => {
      if (tx.street) {
        const street = tx.street.toLowerCase();
        counts[street] = (counts[street] || 0) + 1;
      }
    });
    return counts;
  }, [transactions]);

  const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  const addTransaction = useCallback((tx: Omit<Transaction, "id" | "visible">) => {
    const full: Transaction = { ...tx, id: genId(), visible: true } as Transaction;
    computeFields(full);
    setLocal((prev) => [...prev, full]);
  }, []);

  const importTransactions = useCallback((txs: Transaction[]) => {
    const incoming = sanitizeTransactions(txs);
    const existingIdSet = new Set(transactions.map((tx) => tx.id));
    const existingSignatureCounts = buildSignatureCounts(transactions);
    const seenBatchSignatureCounts = new Map<string, number>();
    const accepted: Transaction[] = [];
    let ignored = 0;

    incoming.forEach((tx) => {
      const signature = buildTransactionSignature(tx);
      const alreadyExisting = existingSignatureCounts.get(signature) || 0;
      const alreadySeenInBatch = seenBatchSignatureCounts.get(signature) || 0;

      seenBatchSignatureCounts.set(signature, alreadySeenInBatch + 1);

      if (existingIdSet.has(tx.id) || alreadySeenInBatch < alreadyExisting) {
        ignored += 1;
        return;
      }

      accepted.push(tx);
      existingIdSet.add(tx.id);
    });

    if (accepted.length > 0) {
      setLocal((prev) => [...prev, ...accepted]);
    }

    return { added: accepted.length, ignored } satisfies ImportResult;
  }, [transactions]);

  const updateTransaction = useCallback((id: string, patch: Partial<Transaction>) => {
    // Check if it's a local addition
    setLocal((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx >= 0) {
        const updated = { ...prev[idx], ...patch };
        computeFields(updated);
        return prev.map((t, i) => (i === idx ? updated : t));
      }
      return prev;
    });
    // Or an API transaction
    if (apiTransactions.some((t) => t.id === id)) {
      setOverrides((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
    }
  }, [apiTransactions]);

  const deleteTransaction = useCallback((id: string) => {
    // Local: remove entirely
    setLocal((prev) => {
      if (prev.some((t) => t.id === id)) return prev.filter((t) => t.id !== id);
      return prev;
    });
    // API: set visible=false
    if (apiTransactions.some((t) => t.id === id)) {
      setOverrides((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), visible: false } }));
    }
  }, [apiTransactions]);

  const toggleVisible = useCallback((id: string) => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return;
    const newVis = !tx.visible;
    setLocal((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx >= 0) return prev.map((t, i) => (i === idx ? { ...t, visible: newVis } : t));
      return prev;
    });
    if (apiTransactions.some((t) => t.id === id)) {
      setOverrides((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), visible: newVis } }));
    }
  }, [transactions, apiTransactions]);

  const updateGeoCache = useCallback((id: string, lat: number, lng: number) => {
    setGeoCache((prev) => ({ ...prev, [id]: { lat, lng } }));
  }, []);

  const toggleStreetFilter = useCallback((street: string) => {
    const normalizedStreet = street.trim().toLowerCase();
    if (!normalizedStreet) return;

    setStreetFilters((prev) =>
      prev.includes(normalizedStreet)
        ? prev.filter((value) => value !== normalizedStreet)
        : [...prev, normalizedStreet]
    );
  }, []);

  const clearStreetFilters = useCallback(() => {
    setStreetFilters([]);
  }, []);

  const setAllVisible = useCallback((vis: boolean) => {
    const ids = transactions.map((t) => t.id);
    setLocal((prev) => prev.map((t) => ids.includes(t.id) ? { ...t, visible: vis } : t));
    const newOver: Record<string, Partial<Transaction>> = { ...apiOverrides };
    apiTransactions.forEach((t) => { newOver[t.id] = { ...(newOver[t.id] || {}), visible: vis }; });
    setOverrides(newOver);
  }, [transactions, apiTransactions, apiOverrides]);

  return {
    transactions, filtered, allYears, streetCounts, hash, fetchError, pollWarning,
    yearFrom, yearTo, setYearFrom, setYearTo,
    streetFilters, setStreetFilters, toggleStreetFilter, clearStreetFilters,
    addTransaction, importTransactions, updateTransaction, deleteTransaction, toggleVisible,
    updateGeoCache, setAllVisible, geoCache,
  };
}
