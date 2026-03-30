"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Reference, Comparable } from "@/lib/types";

const STORAGE_KEY = "newmark_map_comparables";

interface StoreState {
  actif: Reference | null;
  comps: Comparable[];
}

function loadFromStorage(): StoreState {
  if (typeof window === "undefined") return { actif: null, comps: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { actif: null, comps: [] };
    const d = JSON.parse(raw);
    return {
      actif: d.actif || null,
      comps: Array.isArray(d.comps) ? d.comps : [],
    };
  } catch {
    return { actif: null, comps: [] };
  }
}

function saveToStorage(state: StoreState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function useComparablesStore() {
  const [actif, setActifState] = useState<Reference | null>(null);
  const [comps, setCompsState] = useState<Comparable[]>([]);
  const initialized = useRef(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = loadFromStorage();
    setActifState(stored.actif);
    setCompsState(stored.comps);
    initialized.current = true;
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (!initialized.current) return;
    saveToStorage({ actif, comps });
  }, [actif, comps]);

  const setActif = useCallback((ref: Reference | null) => {
    setActifState(ref);
  }, []);

  const setComps = useCallback((newComps: Comparable[]) => {
    setCompsState(newComps);
  }, []);

  const addComp = useCallback((comp: Comparable) => {
    setCompsState((prev) => [...prev, comp]);
  }, []);

  const updateComp = useCallback((idx: number, comp: Comparable) => {
    setCompsState((prev) => prev.map((c, i) => (i === idx ? comp : c)));
  }, []);

  const deleteComp = useCallback((idx: number) => {
    setCompsState((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const insertComp = useCallback((idx: number, comp: Comparable) => {
    setCompsState((prev) => {
      const next = [...prev];
      next.splice(idx, 0, comp);
      return next;
    });
  }, []);

  return {
    actif,
    comps,
    setActif,
    setComps,
    addComp,
    updateComp,
    deleteComp,
    insertComp,
  };
}
