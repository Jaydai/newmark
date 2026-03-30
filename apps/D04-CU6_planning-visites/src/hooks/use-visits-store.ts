"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Visit, RouteSegment } from "@/lib/types";
import { hasCoords } from "@/lib/geocode";
import { addMinutes } from "@/lib/time-utils";
import { calcRoute } from "@/lib/routing";
import { optimizeVisitOrder } from "@/lib/route-optimizer";

const STORAGE_KEY = "newmark_visites_data";

const DEFAULT_VISITS: Visit[] = [];

export function useVisitsStore() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [routes, setRoutes] = useState<(RouteSegment | null)[]>([]);
  const [startTime, setStartTime] = useState("09:00");
  const [routesPending, setRoutesPending] = useState(false);
  const routeCalcIdRef = useRef(0);
  const initializedRef = useRef(false);

  // Load from localStorage
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (Array.isArray(d.visits)) {
          const loaded = d.visits
            .filter((v: Visit) => hasCoords(v.lat, v.lng))
            .map((v: Visit) => ({
              ...v,
              duration: typeof v.duration === "number" && v.duration >= 5 ? v.duration : 30,
              name: v.name || "Sans nom",
            }));
          if (loaded.length) {
            setVisits(loaded);
            if (d.startTime) setStartTime(d.startTime);
            return;
          }
        }
      }
    } catch { /* use defaults */ }
    setVisits(DEFAULT_VISITS.map((v) => ({ ...v })));
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (!initializedRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ visits, startTime }));
    } catch { /* ignore */ }
  }, [visits, startTime]);

  const recalcTimes = useCallback(
    (v: Visit[], r: (RouteSegment | null)[], st: string): Visit[] => {
      if (!v.length) return v;
      const updated = v.map((vis) => ({ ...vis }));
      updated[0].arrival = st;
      updated[0].departure = addMinutes(st, updated[0].duration);
      for (let i = 1; i < updated.length; i++) {
        const route = r[i - 1];
        const travelMin = route ? route.duration : 0;
        updated[i].arrival = addMinutes(updated[i - 1].departure!, travelMin);
        updated[i].departure = addMinutes(updated[i].arrival!, updated[i].duration);
      }
      return updated;
    },
    []
  );

  const calcAllRoutes = useCallback(
    async (currentVisits: Visit[]) => {
      const id = ++routeCalcIdRef.current;
      setRoutesPending(true);
      try {
        const newRoutes: (RouteSegment | null)[] = [];
        for (let i = 0; i < currentVisits.length - 1; i++) {
          const from = currentVisits[i];
          const to = currentVisits[i + 1];
          if (hasCoords(from.lat, from.lng) && hasCoords(to.lat, to.lng)) {
            const route = await calcRoute(
              { lat: from.lat!, lng: from.lng! },
              { lat: to.lat!, lng: to.lng! }
            );
            if (routeCalcIdRef.current !== id) return;
            newRoutes.push(route);
          } else {
            newRoutes.push(null);
          }
        }
        if (routeCalcIdRef.current !== id) return;
        setRoutes(newRoutes);
        setVisits((prev) => recalcTimes(prev, newRoutes, startTime));
      } finally {
        if (routeCalcIdRef.current === id) {
          setRoutesPending(false);
        }
      }
    },
    [startTime, recalcTimes]
  );

  // Calculate routes when visits change
  useEffect(() => {
    if (visits.length > 0 && initializedRef.current) {
      calcAllRoutes(visits);
    }
    // Only re-run when visit count or positions change, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visits.length]);

  const updateStartTime = useCallback(
    (time: string) => {
      setStartTime(time);
      setVisits((prev) => recalcTimes(prev, routes, time));
    },
    [routes, recalcTimes]
  );

  const addVisit = useCallback(
    (visit: Visit) => {
      setVisits((prev) => {
        const next = [...prev, visit];
        calcAllRoutes(next);
        return next;
      });
    },
    [calcAllRoutes]
  );

  const updateVisit = useCallback(
    (idx: number, visit: Visit) => {
      setVisits((prev) => {
        const next = [...prev];
        next[idx] = visit;
        calcAllRoutes(next);
        return next;
      });
    },
    [calcAllRoutes]
  );

  const deleteVisit = useCallback(
    (idx: number): Visit => {
      let removed: Visit = {} as Visit;
      setVisits((prev) => {
        const next = [...prev];
        [removed] = next.splice(idx, 1);
        calcAllRoutes(next);
        return next;
      });
      return removed;
    },
    [calcAllRoutes]
  );

  const undoDelete = useCallback(
    (idx: number, visit: Visit) => {
      setVisits((prev) => {
        const next = [...prev];
        next.splice(idx, 0, visit);
        calcAllRoutes(next);
        return next;
      });
    },
    [calcAllRoutes]
  );

  const moveVisit = useCallback(
    (idx: number, dir: number) => {
      setVisits((prev) => {
        const j = idx + dir;
        if (j < 0 || j >= prev.length) return prev;
        const next = [...prev];
        [next[idx], next[j]] = [next[j], next[idx]];
        calcAllRoutes(next);
        return next;
      });
    },
    [calcAllRoutes]
  );

  const reorderVisit = useCallback(
    (fromIdx: number, toIdx: number) => {
      setVisits((prev) => {
        if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= prev.length || toIdx >= prev.length) return prev;
        const next = [...prev];
        const [item] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, item);
        calcAllRoutes(next);
        return next;
      });
    },
    [calcAllRoutes]
  );

  const optimizeOrder = useCallback(() => {
    setVisits((prev) => {
      const optimized = optimizeVisitOrder(prev);
      calcAllRoutes(optimized);
      return optimized;
    });
  }, [calcAllRoutes]);

  const updateDuration = useCallback(
    (idx: number, duration: number) => {
      setVisits((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], duration };
        return recalcTimes(next, routes, startTime);
      });
    },
    [routes, startTime, recalcTimes]
  );

  return {
    visits,
    setVisits,
    routes,
    startTime,
    routesPending,
    updateStartTime,
    addVisit,
    updateVisit,
    deleteVisit,
    undoDelete,
    moveVisit,
    reorderVisit,
    optimizeOrder,
    updateDuration,
    calcAllRoutes,
  };
}
