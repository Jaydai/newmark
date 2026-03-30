"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { Reference, Comparable, ViewMode } from "@/lib/types";
import { hasCoords } from "@/lib/geocode";
import { fmtSurface, fmtLoyer } from "@/lib/format";

function esc(s: string) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

interface BubbleSceneProps {
  view: ViewMode;
  actif: Reference | null;
  comps: Comparable[];
  mapRef: React.MutableRefObject<LeafletMap | null>;
  onEditReference: () => void;
  onEditComp: (idx: number) => void;
  onExportPNG: () => void;
}

export default function BubbleScene({
  view,
  actif,
  comps,
  mapRef,
  onEditReference,
  onEditComp,
  onExportPNG,
}: BubbleSceneProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const handlersRef = useRef<Array<() => void>>([]);
  const [layoutTick, setLayoutTick] = useState(0);

  const clearBubbles = useCallback(() => {
    const map = mapRef.current;
    if (map) {
      handlersRef.current.forEach((h) => map.off("move zoom viewreset resize", h));
    }
    handlersRef.current = [];
    if (sceneRef.current) sceneRef.current.innerHTML = "";
  }, [mapRef]);

  useEffect(() => {
    if (view !== "bubbles") {
      clearBubbles();
      return;
    }
    const map = mapRef.current;
    if (!map) {
      const retryId = window.setTimeout(() => setLayoutTick((tick) => tick + 1), 120);
      return () => window.clearTimeout(retryId);
    }

    // Trigger map resize after view switch
    setTimeout(() => map.invalidateSize(), 100);

    const scene = sceneRef.current;
    if (!scene) return;
    scene.innerHTML = "";

    const items: Array<{ data: Reference | Comparable; isAsset: boolean; idx: number }> = [];
    if (actif && hasCoords(actif.lat, actif.lng))
      items.push({ data: actif, isAsset: true, idx: -1 });
    comps.forEach((c, i) => {
      if (hasCoords(c.lat, c.lng)) items.push({ data: c, isAsset: false, idx: i });
    });

    if (!items.length) {
      scene.innerHTML = '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font-size:14px;color:var(--text-secondary);pointer-events:auto"><div>Aucune donnée. Importez un fichier Excel.</div></div>';
      return;
    }

    const W = window.innerWidth;
    const H = window.innerHeight;
    const T = 56;
    const n = items.length;
    const assetW = 200, assetH = 120;
    const compW = 180, compH = 140;

    // SVG for connection lines
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "absolute inset-0 w-full h-full pointer-events-none");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    scene.appendChild(svg);

    const radii = items.map((it) => {
      return it.isAsset ? Math.max(assetW, assetH) / 2 : Math.max(compW, compH) / 2;
    });

    // Position calculation (perimeter distribution)
    const pad = 20;
    const Left = pad, R = W - pad, Top = T + pad, Bot = H - pad;
    const usableW = R - Left, usableH = Bot - Top;
    const perim = 2 * (usableW + usableH);

    function markerToScreen(lat: number, lng: number) {
      if (!map) return { x: W / 2, y: H / 2 };
      const rect = map.getContainer().getBoundingClientRect();
      const pt = map.latLngToContainerPoint([lat, lng]);
      return { x: rect.left + pt.x, y: rect.top + pt.y };
    }

    function xyToPerimD(px: number, py: number) {
      const cx = (Left + R) / 2, cy = (Top + Bot) / 2;
      const dx = px - cx, dy = py - cy;
      if (dx === 0 && dy === 0) return 0;
      const scaleX = Math.abs(dx) > 0 ? usableW / 2 / Math.abs(dx) : Infinity;
      const scaleY = Math.abs(dy) > 0 ? usableH / 2 / Math.abs(dy) : Infinity;
      const s = Math.min(scaleX, scaleY);
      const ex = cx + dx * s, ey = cy + dy * s;
      if (Math.abs(ey - Top) < 1) return ex - Left;
      if (Math.abs(ex - R) < 1) return usableW + (ey - Top);
      if (Math.abs(ey - Bot) < 1) return usableW + usableH + (R - ex);
      return 2 * usableW + usableH + (Bot - ey);
    }

    function perimDtoXY(d: number) {
      d = ((d % perim) + perim) % perim;
      if (d <= usableW) return { x: Left + d, y: Top };
      if (d <= usableW + usableH) return { x: R, y: Top + (d - usableW) };
      if (d <= 2 * usableW + usableH) return { x: R - (d - usableW - usableH), y: Bot };
      return { x: Left, y: Bot - (d - 2 * usableW - usableH) };
    }

    const markerScreens = items.map((it) => {
      const d = it.data as { lat: number; lng: number };
      return markerToScreen(d.lat!, d.lng!);
    });
    const perimDs = markerScreens.map((ms) => xyToPerimD(ms.x, ms.y));
    const sortedIndices = [...Array(n).keys()].sort((a, b) => perimDs[a] - perimDs[b]);
    const slotPerimDs = new Array(n);
    sortedIndices.forEach((idx) => { slotPerimDs[idx] = perimDs[idx]; });
    const minGap = perim / (n * 0.8);
    for (let pass = 0; pass < 3; pass++) {
      for (let k = 0; k < sortedIndices.length - 1; k++) {
        const a = sortedIndices[k], b = sortedIndices[k + 1];
        const gap = slotPerimDs[b] - slotPerimDs[a];
        if (gap < minGap) { const push = (minGap - gap) / 2; slotPerimDs[a] -= push; slotPerimDs[b] += push; }
      }
      for (let i = 0; i < n; i++) slotPerimDs[i] = ((slotPerimDs[i] % perim) + perim) % perim;
    }

    const positions = items.map((_, i) => perimDtoXY(slotPerimDs[i]));

    // Physics simulation for overlap resolution
    for (let iter = 0; iter < 60; iter++) {
      for (let i = 0; i < n; i++) {
        let fx = 0, fy = 0;
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const dx = positions[i].x - positions[j].x;
          const dy = positions[i].y - positions[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minD = radii[i] + radii[j] + 16;
          if (dist < minD) { const f = (minD - dist) * 0.18; fx += (dx / dist) * f; fy += (dy / dist) * f; }
        }
        const slot = perimDtoXY(slotPerimDs[i]);
        fx += (slot.x - positions[i].x) * 0.06;
        fy += (slot.y - positions[i].y) * 0.06;
        positions[i].x += fx; positions[i].y += fy;
        const hw = items[i].isAsset ? assetW / 2 : compW / 2;
        const hh = items[i].isAsset ? assetH / 2 : compH / 2;
        positions[i].x = Math.max(hw + 6, Math.min(W - hw - 6, positions[i].x));
        positions[i].y = Math.max(T + hh + 6, Math.min(H - hh - 6, positions[i].y));
      }
    }

    // Draw SVG lines + dots
    const svgEls = items.map((it) => {
      const col = it.isAsset ? "var(--map-green)" : "var(--map-blue)";
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("stroke", col); line.setAttribute("stroke-width", it.isAsset ? "2.5" : "2");
      line.setAttribute("stroke-dasharray", "6 4"); line.setAttribute("opacity", it.isAsset ? "0.8" : "0.7");
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("r", it.isAsset ? "5" : "4"); dot.setAttribute("fill", col); dot.setAttribute("opacity", "0.85");
      const ring = document.createElementNS(svgNS, "circle");
      ring.setAttribute("r", it.isAsset ? "10" : "7"); ring.setAttribute("fill", "none");
      ring.setAttribute("stroke", col); ring.setAttribute("stroke-width", "1.5"); ring.setAttribute("opacity", "0.6");
      svg.appendChild(line); svg.appendChild(ring); svg.appendChild(dot);
      return { line, dot, ring };
    });

    function updateLines() {
      items.forEach((it, i) => {
        const d = it.data as { lat: number; lng: number };
        const vp = markerToScreen(d.lat!, d.lng!);
        const bub = positions[i];
        svgEls[i].line.setAttribute("x1", String(vp.x)); svgEls[i].line.setAttribute("y1", String(vp.y));
        svgEls[i].line.setAttribute("x2", String(bub.x)); svgEls[i].line.setAttribute("y2", String(bub.y));
        svgEls[i].dot.setAttribute("cx", String(vp.x)); svgEls[i].dot.setAttribute("cy", String(vp.y));
        svgEls[i].ring.setAttribute("cx", String(vp.x)); svgEls[i].ring.setAttribute("cy", String(vp.y));
      });
    }
    updateLines();

    let raf: number | null = null;
    const throttledUpdate = () => { if (raf) return; raf = requestAnimationFrame(() => { updateLines(); raf = null; }); };
    map.on("move zoom viewreset resize", throttledUpdate);
    handlersRef.current.push(throttledUpdate);

    // Create bubble cards
    items.forEach((it, i) => {
      const w = it.isAsset ? assetW : compW;
      const h = it.isAsset ? assetH : compH;
      const el = document.createElement("div");
      el.dataset.bubbleCard = "true";
      el.style.cssText = `position:absolute;border-radius:var(--radius);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;cursor:grab;pointer-events:auto;overflow:hidden;width:${w}px;height:${h}px;left:${positions[i].x - w / 2}px;top:${positions[i].y - h / 2}px;animation:bubAppear .5s cubic-bezier(.34,1.56,.64,1) forwards;animation-delay:${i * 0.07}s;opacity:0;background:#fff;border:2px solid ${it.isAsset ? "var(--map-green)" : "var(--map-blue)"};box-shadow:0 0 0 1px ${it.isAsset ? "var(--map-green-10)" : "var(--map-blue-10)"},0 ${it.isAsset ? "12" : "8"}px ${it.isAsset ? "40" : "28"}px rgba(0,0,0,.12);font-family:'DM Sans',system-ui,sans-serif`;
      el.tabIndex = 0;
      el.setAttribute("role", "button");

      if (it.isAsset) {
        const ref = it.data as Reference;
        el.innerHTML = `<div class="cmp-ref-badge" style="background:var(--map-green);color:#fff;font-size:8px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;padding:3px 12px;border-radius:20px;margin-bottom:6px;white-space:nowrap">★ RÉFÉRENCE</div><div class="cmp-ref-name" style="font-size:14px;font-weight:700;color:var(--primary);line-height:1.15;margin-bottom:2px;max-width:85%;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(ref.nom || ref.adresse)}</div>${ref.adresse && ref.nom !== ref.adresse ? `<div class="cmp-ref-address" style="font-size:9px;color:var(--text-secondary);margin-bottom:4px;max-width:80%;line-height:1.3">${esc(ref.adresse)}</div>` : ""}`;
      } else {
        const c = it.data as Comparable;
        el.innerHTML = `<div class="cmp-card-badge" style="background:var(--map-blue);color:#fff;font-size:7px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:2px 9px;border-radius:20px;margin-bottom:4px;white-space:nowrap">COMPARABLE</div><div class="cmp-card-name" style="font-size:12px;font-weight:700;color:var(--primary);line-height:1.15;margin-bottom:3px;max-width:85%;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(c.preneur)}</div><div class="cmp-card-row" style="display:flex;justify-content:space-between;width:78%;font-size:9px;padding:1px 0"><span class="cmp-card-label" style="color:var(--text-tertiary)">Surface</span><span class="cmp-card-value" style="font-weight:700;color:var(--primary)">${fmtSurface(c.surface)}</span></div><div class="cmp-card-row" style="display:flex;justify-content:space-between;width:78%;font-size:9px;padding:1px 0"><span class="cmp-card-label" style="color:var(--text-tertiary)">Loyer/m²</span><span class="cmp-card-value" style="font-weight:700;color:var(--primary)">${fmtLoyer(c.loyer)}</span></div><div class="cmp-card-footer" style="font-size:8px;color:var(--text-tertiary);margin-top:3px;font-style:italic">${esc(c.date)}${c.etat ? " · " + esc(c.etat) : ""}</div>`;
      }

      // Drag
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault(); e.stopPropagation();
        el.setPointerCapture(e.pointerId);
        el.style.cursor = "grabbing"; el.style.zIndex = "900"; el.style.transform = "scale(1.05)"; el.style.boxShadow = "0 16px 48px rgba(0,0,0,.35)";
        const off = { x: e.clientX - positions[i].x, y: e.clientY - positions[i].y };
        const onMove = (ev: PointerEvent) => {
          positions[i].x = Math.max(w / 2 + 6, Math.min(W - w / 2 - 6, ev.clientX - off.x));
          positions[i].y = Math.max(T + h / 2 + 6, Math.min(H - h / 2 - 6, ev.clientY - off.y));
          el.style.left = `${positions[i].x - w / 2}px`;
          el.style.top = `${positions[i].y - h / 2}px`;
          updateLines();
        };
        const onUp = () => {
          el.style.cursor = "grab"; el.style.zIndex = ""; el.style.transform = ""; el.style.boxShadow = "";
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerup", onUp);
        };
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerup", onUp);
      });

      el.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        if (it.isAsset) onEditReference(); else onEditComp(it.idx);
      });

      scene.appendChild(el);
    });

    // Legend
    const leg = document.createElement("div");
    leg.style.cssText = "position:absolute;bottom:20px;left:28px;z-index:810;font-size:10px;color:rgba(0,0,0,.4)";
    leg.innerHTML = `<div style="display:flex;align-items:center;gap:7px;margin-bottom:3px"><div style="width:10px;height:10px;border-radius:50%;background:var(--map-green);border:1.5px solid rgba(255,255,255,.2)"></div> Adresse de référence</div><div style="display:flex;align-items:center;gap:7px"><div style="width:10px;height:10px;border-radius:50%;background:var(--map-blue);border:1.5px solid rgba(255,255,255,.15)"></div> Comparable (${comps.filter((c) => hasCoords(c.lat, c.lng)).length})</div>`;
    scene.appendChild(leg);

    // Watermark
    const wm = document.createElement("div");
    wm.className = "absolute bottom-5 left-0 right-0 text-center z-[810] pointer-events-none";
    wm.innerHTML = `<div style="font-size:14px;font-weight:600;letter-spacing:3px;color:rgba(0,0,0,.06)">NEWMARK</div><div style="font-size:8px;letter-spacing:2px;text-transform:uppercase;color:rgba(0,0,0,.04);margin-top:2px">Carte de Comparables</div>`;
    scene.appendChild(wm);

    return () => clearBubbles();
  }, [view, actif, comps, mapRef, onEditReference, onEditComp, clearBubbles, layoutTick]);

  return (
    <>
      <div
        ref={sceneRef}
        data-bubble-scene
        className={`fixed inset-0 z-[800] overflow-hidden pointer-events-none ${view === "bubbles" ? "block" : "hidden"}`}
      />
      {view === "bubbles" && (
        <button
          onClick={onExportPNG}
          className="fixed z-[900] px-5 py-2.5 border-none rounded-[10px] text-xs font-bold cursor-pointer bg-primary text-white shadow-[0_4px_20px_rgba(0,0,0,.15)] hover:-translate-y-0.5 transition-all"
          style={{ top: "calc(var(--bar-h) + 12px)", right: "20px" }}
        >
          📷 Exporter en PNG
        </button>
      )}
    </>
  );
}
