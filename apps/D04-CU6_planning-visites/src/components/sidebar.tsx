"use client";

import { useState, useRef, useCallback } from "react";
import type { Visit, RouteSegment } from "@/lib/types";
import { formatDuration } from "@/lib/time-utils";
import { ChevronUp, ChevronDown, X, MapPin, GripVertical, Sparkles, Loader2 } from "lucide-react";

interface SidebarProps {
  visits: Visit[];
  routes: (RouteSegment | null)[];
  startTime: string;
  routesPending: boolean;
  onStartTimeChange: (time: string) => void;
  onEditVisit: (idx: number) => void;
  onDeleteVisit: (idx: number) => void;
  onMoveVisit: (idx: number, dir: number) => void;
  onReorderVisit: (fromIdx: number, toIdx: number) => void;
  onDurationChange: (idx: number, dur: number) => void;
  onAddVisit: () => void;
  onOptimizeOrder: () => void;
}

export default function Sidebar({
  visits,
  routes,
  startTime,
  routesPending,
  onStartTimeChange,
  onEditVisit,
  onDeleteVisit,
  onMoveVisit,
  onReorderVisit,
  onDurationChange,
  onAddVisit,
  onOptimizeOrder,
}: SidebarProps) {
  const n = visits.length;
  const totalVisitMin = visits.reduce((s, v) => s + v.duration, 0);
  const totalTravelMin = routes.reduce((s, r) => s + (r ? r.duration : 0), 0);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ idx: number; half: "top" | "bottom" } | null>(null);
  const dragIdxRef = useRef<number | null>(null);
  const gripActiveRef = useRef(false);
  const didDragRef = useRef(false);

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    if (!gripActiveRef.current) {
      e.preventDefault();
      return;
    }
    didDragRef.current = true;
    dragIdxRef.current = idx;
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
    requestAnimationFrame(() => {
      (e.target as HTMLElement).style.opacity = "0.35";
    });
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = "1";
    dragIdxRef.current = null;
    setDragIdx(null);
    setDropTarget(null);
    gripActiveRef.current = false;
    setTimeout(() => { didDragRef.current = false; }, 0);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const half = e.clientY < rect.top + rect.height / 2 ? "top" : "bottom";
    setDropTarget((prev) =>
      prev?.idx === idx && prev.half === half ? prev : { idx, half }
    );
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    const fromIdx = dragIdxRef.current ?? parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (isNaN(fromIdx)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const half = e.clientY < rect.top + rect.height / 2 ? "top" : "bottom";
    let toIdx = half === "top" ? idx : idx + 1;
    if (fromIdx < toIdx) toIdx--;
    if (toIdx !== fromIdx) onReorderVisit(fromIdx, toIdx);
    dragIdxRef.current = null;
    setDragIdx(null);
    setDropTarget(null);
    gripActiveRef.current = false;
  }, [onReorderVisit]);

  const handleCardClick = useCallback((idx: number) => {
    if (didDragRef.current) return;
    onEditVisit(idx);
  }, [onEditVisit]);

  return (
    <div
      data-sidebar
      className="fixed top-[var(--bar-h)] left-0 w-[var(--sidebar-w)] h-[calc(100vh-var(--bar-h))] bg-white border-r border-border z-[900] flex flex-col"
    >
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-border/60 shrink-0 flex flex-col gap-2.5">
        <div className="inline-flex items-center gap-1.5">
          <label className="text-[9px] font-semibold text-text-secondary uppercase tracking-wider">
            Départ
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => onStartTimeChange(e.target.value)}
            className="h-[22px] px-1.5 border-[1.5px] border-border-input rounded-[5px] text-[11px] font-semibold text-primary bg-white transition-colors focus:outline-none focus:border-map-green focus:ring-2 focus:ring-map-green/10 tabular-nums"
          />
        </div>

        {n >= 3 && (
          <button
            onClick={onOptimizeOrder}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--map-green-25)] bg-[var(--map-green-10)] text-[var(--map-green)] text-[9px] font-bold uppercase tracking-wider transition-all hover:bg-[var(--map-green)] hover:text-white hover:shadow-sm w-fit"
          >
            <Sparkles className="w-3 h-3" />
            Optimiser le trajet
          </button>
        )}

        {n > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <div className="min-w-[68px] px-2 py-1.5 rounded-lg border border-border bg-surface-alt">
              <div className="text-[7px] font-bold tracking-wider uppercase text-text-tertiary">
                Visites
              </div>
              <div className="mt-0.5 text-[11px] font-bold text-primary">{n}</div>
            </div>
            <div className="min-w-[68px] px-2 py-1.5 rounded-lg border border-border bg-surface-alt">
              <div className="text-[7px] font-bold tracking-wider uppercase text-text-tertiary">
                Sur place
              </div>
              <div className="mt-0.5 text-[11px] font-bold text-primary">
                {formatDuration(totalVisitMin)}
              </div>
            </div>
            <div className="min-w-[68px] px-2 py-1.5 rounded-lg border border-border bg-surface-alt">
              <div className="text-[7px] font-bold tracking-wider uppercase text-text-tertiary">
                Trajet
              </div>
              <div className="mt-0.5 text-[11px] font-bold text-primary">
                {formatDuration(totalTravelMin)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Visit List */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3">
        {!n && (
          <div className="py-8 text-center text-text-faint">
            <MapPin className="w-7 h-7 mx-auto mb-2 opacity-50" />
            <div className="text-[11px] leading-relaxed">
              Aucune visite.
              <br />
              Cliquez sur la carte ou utilisez le bouton + pour ajouter des
              points.
            </div>
          </div>
        )}

        {visits.map((v, i) => (
          <div
            key={`visit-${v.name}-${v.lat}-${v.lng}`}
            draggable
            onDragStart={(e) => handleDragStart(e, i)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={(e) => handleDrop(e, i)}
          >
            {/* Drop indicator top */}
            {dragIdx !== null && dropTarget?.idx === i && dropTarget.half === "top" && dragIdx !== i && (
              <div className="h-0.5 bg-[var(--map-green)] rounded-full mx-2 mb-0.5" />
            )}
            {/* Visit Card */}
            <div
              className={`bg-white border-[1.5px] border-border rounded-[var(--radius)] px-3 py-2.5 relative transition-all cursor-pointer hover:border-black/30 hover:shadow-sm ${dragIdx === i ? "opacity-40" : ""}`}
              onClick={() => handleCardClick(i)}
              role="button"
              tabIndex={0}
              aria-label={`Modifier la visite ${v.name}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onEditVisit(i);
                }
              }}
            >
              <div className="flex items-start gap-2">
                <div
                  className="flex items-center gap-1 shrink-0 cursor-grab active:cursor-grabbing"
                  onMouseDown={() => { gripActiveRef.current = true; }}
                  onMouseUp={() => { gripActiveRef.current = false; }}
                >
                  <GripVertical className="w-3 h-3 text-black/20" />
                  <div className="w-6 h-6 rounded-full bg-[var(--map-green)] text-white text-[11px] font-bold flex items-center justify-center">
                    {i + 1}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-xs font-bold text-primary truncate"
                    title={v.name}
                  >
                    {v.name}
                  </div>
                  <div
                    className="text-[10px] text-text-tertiary truncate mt-0.5"
                    title={v.address}
                  >
                    {v.address}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveVisit(i, -1);
                    }}
                    disabled={i === 0}
                    title="Monter"
                    aria-label={`Monter ${v.name}`}
                    className="bg-transparent border-none text-black/25 text-xs cursor-pointer p-0.5 transition-colors hover:text-black disabled:opacity-20 disabled:cursor-default"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveVisit(i, 1);
                    }}
                    disabled={i === n - 1}
                    title="Descendre"
                    aria-label={`Descendre ${v.name}`}
                    className="bg-transparent border-none text-black/25 text-xs cursor-pointer p-0.5 transition-colors hover:text-black disabled:opacity-20 disabled:cursor-default"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteVisit(i);
                    }}
                    title="Supprimer"
                    aria-label={`Supprimer ${v.name}`}
                    className="bg-transparent border-none text-black/25 text-base cursor-pointer px-1 transition-colors hover:text-danger"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Time chips */}
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {v.arrival && (
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-[var(--map-green-10)] text-[var(--map-green)]">
                    {v.arrival}
                  </span>
                )}
                {v.departure && (
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-[var(--map-blue-08)] text-[var(--map-blue)]">
                    {v.departure}
                  </span>
                )}
                <span
                  className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-surface-alt text-text-secondary inline-flex items-center gap-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="number"
                    min={5}
                    max={480}
                    value={v.duration}
                    onChange={(e) => {
                      const d = parseInt(e.target.value);
                      if (!isNaN(d) && d >= 5) onDurationChange(i, Math.min(d, 480));
                    }}
                    className="w-7 px-0.5 border-none rounded-[3px] text-[9px] text-center text-text-secondary font-semibold bg-transparent cursor-text focus:outline-none focus:bg-white focus:shadow-[0_0_0_1.5px_var(--map-green-25)] focus:text-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />{" "}
                  min
                </span>
              </div>
            </div>

            {/* Drop indicator bottom */}
            {dragIdx !== null && dropTarget?.idx === i && dropTarget.half === "bottom" && dragIdx !== i && (
              <div className="h-0.5 bg-[var(--map-green)] rounded-full mx-2 mt-0.5" />
            )}

            {/* Travel connector between visits */}
            {i < n - 1 && (
              <div className="relative flex items-center gap-2.5 py-1 pl-4 ml-3 text-text-faint">
                <div className="absolute left-1.5 top-[-2px] bottom-0.5 w-px bg-gradient-to-b from-black/[.04] via-black/[.12] to-black/[.04]" />
                {routesPending && !routes[i] ? (
                  <div className="text-[8.5px] font-bold text-text-secondary inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface-alt border border-border">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    Calcul…
                  </div>
                ) : routes[i] ? (
                  <div className="text-[8.5px] font-bold text-[var(--map-blue-hover)] inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--map-blue-08)] border border-[rgba(0,98,174,.14)]">
                    ↓ {routes[i]!.duration} min · {routes[i]!.distance} km
                  </div>
                ) : (
                  <div className="text-[8.5px] font-bold text-text-secondary inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface-alt border border-border">
                    ↓ ---
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div data-sidebar-footer className="px-3.5 py-3 border-t border-border/60 shrink-0">
        <button
          onClick={onAddVisit}
          className="w-full py-2.5 border-2 border-dashed border-border-input rounded-[var(--radius)] bg-transparent text-xs font-bold text-text-secondary cursor-pointer transition-all hover:border-[var(--map-green)] hover:text-[var(--map-green)] hover:bg-[var(--map-green-10)]/30"
        >
          + Ajouter une visite
        </button>
      </div>
    </div>
  );
}
