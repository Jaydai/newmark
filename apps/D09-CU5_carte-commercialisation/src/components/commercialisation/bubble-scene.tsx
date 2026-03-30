"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { Asset, Comparable, ViewMode } from "@/lib/types";
import { hasCoords } from "@/lib/geocode";

function esc(value: string) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

interface BubbleSceneProps {
  view: ViewMode;
  actif: Asset | null;
  comps: Comparable[];
  mapRef: React.MutableRefObject<LeafletMap | null>;
  onEditAsset: () => void;
  onEditComp: (idx: number) => void;
  onExportPNG: () => void;
}

export default function BubbleScene({
  view,
  actif,
  comps,
  mapRef,
  onEditAsset,
  onEditComp,
  onExportPNG,
}: BubbleSceneProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const handlersRef = useRef<Array<() => void>>([]);
  const resizeRef = useRef<(() => void) | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);

  const clearBubbles = useCallback(() => {
    const map = mapRef.current;
    if (map) {
      handlersRef.current.forEach((handler) => map.off("move zoom viewreset resize", handler));
    }
    handlersRef.current = [];
    if (sceneRef.current) sceneRef.current.innerHTML = "";
    if (resizeRef.current) {
      window.removeEventListener("resize", resizeRef.current);
      resizeRef.current = null;
    }
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
    const mapInstance = map;

    window.setTimeout(() => mapInstance.invalidateSize(), 100);
    clearBubbles();

    const scene = sceneRef.current;
    if (!scene) return;

    const svgNs = "http://www.w3.org/2000/svg";
    const W = window.innerWidth;
    const H = window.innerHeight;
    const T = 56;
    const assetW = 220;
    const assetH = 160;
    const compW = 180;
    const compH = 140;

    const items: Array<{ data: Asset | Comparable; isAsset: boolean; idx: number }> = [];
    if (actif && hasCoords(actif.lat, actif.lng)) items.push({ data: actif, isAsset: true, idx: -1 });
    comps.forEach((comp, index) => {
      if (hasCoords(comp.lat, comp.lng)) items.push({ data: comp, isAsset: false, idx: index });
    });

    if (!items.length) {
      scene.innerHTML =
        '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font-size:14px;color:var(--c-text-muted);pointer-events:auto"><div>Aucune donnee geolocalisee.</div></div>';
      return;
    }

    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("class", "bub-svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    scene.appendChild(svg);
    const rootStyles = getComputedStyle(document.documentElement);
    const assetColor = rootStyles.getPropertyValue("--c-green").trim() || "#2d8c5a";
    const compColor = rootStyles.getPropertyValue("--c-blue").trim() || "#0062ae";

    const n = items.length;
    const radii = items.map((item) => (item.isAsset ? Math.max(assetW, assetH) / 2 : Math.max(compW, compH) / 2));
    const pad = 20;
    const edgeInsets = {
      top: 60,
      right: 40,
      bottom: 32,
      left: 28,
    };
    const Left = pad;
    const Right = W - pad;
    const Top = T + pad;
    const Bottom = H - pad;
    const usableW = Right - Left;
    const usableH = Bottom - Top;
    const perim = 2 * (usableW + usableH);

    function markerToScreen(lat: number, lng: number) {
      const mapEl = mapInstance.getContainer();
      const rect = mapEl.getBoundingClientRect();
      const point = mapInstance.latLngToContainerPoint([lat, lng]);
      return { x: rect.left + point.x, y: rect.top + point.y };
    }

    function xyToPerimD(px: number, py: number) {
      const cx = (Left + Right) / 2;
      const cy = (Top + Bottom) / 2;
      const dx = px - cx;
      const dy = py - cy;
      if (dx === 0 && dy === 0) return 0;
      const scaleX = Math.abs(dx) > 0 ? usableW / 2 / Math.abs(dx) : Number.POSITIVE_INFINITY;
      const scaleY = Math.abs(dy) > 0 ? usableH / 2 / Math.abs(dy) : Number.POSITIVE_INFINITY;
      const scale = Math.min(scaleX, scaleY);
      const ex = cx + dx * scale;
      const ey = cy + dy * scale;
      if (Math.abs(ey - Top) < 1) return ex - Left;
      if (Math.abs(ex - Right) < 1) return usableW + (ey - Top);
      if (Math.abs(ey - Bottom) < 1) return usableW + usableH + (Right - ex);
      return 2 * usableW + usableH + (Bottom - ey);
    }

    function perimDtoXY(distance: number) {
      let d = ((distance % perim) + perim) % perim;
      if (d <= usableW) return { x: Left + d, y: Top };
      if (d <= usableW + usableH) return { x: Right, y: Top + (d - usableW) };
      if (d <= 2 * usableW + usableH) return { x: Right - (d - usableW - usableH), y: Bottom };
      d -= 2 * usableW + usableH;
      return { x: Left, y: Bottom - d };
    }

    const markerScreens = items.map((item) => {
      const data = item.data as { lat: number; lng: number };
      return markerToScreen(data.lat, data.lng);
    });
    const perimDs = markerScreens.map((screen) => xyToPerimD(screen.x, screen.y));
    const sortedIndices = [...Array(n).keys()].sort((a, b) => perimDs[a] - perimDs[b]);
    const slotPerimDs = new Array<number>(n);
    sortedIndices.forEach((index) => {
      slotPerimDs[index] = perimDs[index];
    });

    const minGap = perim / (n * 0.8);
    for (let pass = 0; pass < 3; pass += 1) {
      for (let k = 0; k < sortedIndices.length - 1; k += 1) {
        const a = sortedIndices[k];
        const b = sortedIndices[k + 1];
        const gap = slotPerimDs[b] - slotPerimDs[a];
        if (gap < minGap) {
          const push = (minGap - gap) / 2;
          slotPerimDs[a] -= push;
          slotPerimDs[b] += push;
        }
      }
      if (sortedIndices.length > 1) {
        const a = sortedIndices[sortedIndices.length - 1];
        const b = sortedIndices[0];
        const gap = slotPerimDs[b] + perim - slotPerimDs[a];
        if (gap < minGap) {
          const push = (minGap - gap) / 2;
          slotPerimDs[a] -= push;
          slotPerimDs[b] += push;
        }
      }
      for (let index = 0; index < n; index += 1) {
        slotPerimDs[index] = ((slotPerimDs[index] % perim) + perim) % perim;
      }
    }

    const positions = items.map((_, index) => perimDtoXY(slotPerimDs[index]));

    for (let iter = 0; iter < 60; iter += 1) {
      for (let i = 0; i < n; i += 1) {
        let fx = 0;
        let fy = 0;
        for (let j = 0; j < n; j += 1) {
          if (i === j) continue;
          const dx = positions[i].x - positions[j].x;
          const dy = positions[i].y - positions[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minD = radii[i] + radii[j] + 16;
          if (dist < minD) {
            const force = (minD - dist) * 0.18;
            fx += (dx / dist) * force;
            fy += (dy / dist) * force;
          }
        }

        const slot = perimDtoXY(slotPerimDs[i]);
        fx += (slot.x - positions[i].x) * 0.06;
        fy += (slot.y - positions[i].y) * 0.06;

        positions[i].x += fx;
        positions[i].y += fy;

        const hw = items[i].isAsset ? assetW / 2 : compW / 2;
        const hh = items[i].isAsset ? assetH / 2 : compH / 2;
        positions[i].x = Math.max(
          hw + edgeInsets.left,
          Math.min(W - hw - edgeInsets.right, positions[i].x)
        );
        positions[i].y = Math.max(
          T + hh + edgeInsets.top,
          Math.min(H - hh - edgeInsets.bottom, positions[i].y)
        );
      }
    }

    const svgEls = items.map((item) => {
      const color = item.isAsset ? assetColor : compColor;
      const line = document.createElementNS(svgNs, "line");
      line.setAttribute("stroke", color);
      line.setAttribute("stroke-width", item.isAsset ? "2.5" : "2");
      line.setAttribute("stroke-dasharray", "6 4");
      line.setAttribute("opacity", item.isAsset ? "0.8" : "0.7");
      const dot = document.createElementNS(svgNs, "circle");
      dot.setAttribute("r", item.isAsset ? "5" : "4");
      dot.setAttribute("fill", color);
      dot.setAttribute("opacity", "0.85");
      const ring = document.createElementNS(svgNs, "circle");
      ring.setAttribute("r", item.isAsset ? "10" : "7");
      ring.setAttribute("fill", "none");
      ring.setAttribute("stroke", color);
      ring.setAttribute("stroke-width", "1.5");
      ring.setAttribute("opacity", "0.6");
      svg.appendChild(line);
      svg.appendChild(ring);
      svg.appendChild(dot);
      return { line, dot, ring };
    });

    function updateLines() {
      items.forEach((item, index) => {
        const data = item.data as { lat: number; lng: number };
        const vp = markerToScreen(data.lat, data.lng);
        const bubble = positions[index];
        svgEls[index].line.setAttribute("x1", String(vp.x));
        svgEls[index].line.setAttribute("y1", String(vp.y));
        svgEls[index].line.setAttribute("x2", String(bubble.x));
        svgEls[index].line.setAttribute("y2", String(bubble.y));
        svgEls[index].dot.setAttribute("cx", String(vp.x));
        svgEls[index].dot.setAttribute("cy", String(vp.y));
        svgEls[index].ring.setAttribute("cx", String(vp.x));
        svgEls[index].ring.setAttribute("cy", String(vp.y));
      });
    }

    updateLines();

    let linesRaf: number | null = null;
    const updateLinesThrottled = () => {
      if (linesRaf) return;
      linesRaf = requestAnimationFrame(() => {
        updateLines();
        linesRaf = null;
      });
    };
    mapInstance.on("move zoom viewreset resize", updateLinesThrottled);
    handlersRef.current.push(updateLinesThrottled);

    items.forEach((item, index) => {
      const width = item.isAsset ? assetW : compW;
      const height = item.isAsset ? assetH : compH;
      const element = document.createElement("div");
      element.dataset.bubbleCard = "true";
      element.className = `bub-card ${item.isAsset ? "is-asset" : "is-comp"}`;
      element.tabIndex = 0;
      element.setAttribute(
        "aria-label",
        item.isAsset
          ? `Modifier l'actif ${item.data.nom || "principal"}`
          : `Modifier le comparable ${item.data.nom || "sans nom"}`
      );
      element.setAttribute("role", "button");
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;
      element.style.left = `${positions[index].x - width / 2}px`;
      element.style.top = `${positions[index].y - height / 2}px`;
      element.style.animationDelay = `${index * 0.07}s`;

      element.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        if (item.isAsset) onEditAsset();
        else onEditComp(item.idx);
      });

      if (item.isAsset) {
        const asset = item.data as Asset;
        element.innerHTML =
          '<div class="bub-badge">★ ACTIF À COMMERCIALISER</div>' +
          `<div class="bub-name">${esc(asset.nom || "")}</div>` +
          `<div class="bub-addr">${esc(asset.adresse || "")}</div>` +
          '<div class="bub-kpi">' +
          `<div class="k"><div class="kv">${esc(asset.prix || "-")}</div><div class="kl">Prix</div></div>` +
          `<div class="k"><div class="kv">${esc(asset.surface || "-")}</div><div class="kl">Surface</div></div>` +
          `<div class="k"><div class="kv">${esc(asset.rendement || "-")}</div><div class="kl">Rdt</div></div>` +
          "</div>";
      } else {
        const comp = item.data as Comparable;
        element.innerHTML =
          '<div class="bub-badge">COMPARABLE</div>' +
          `<div class="bub-name">${esc(comp.nom || "")}</div>` +
          `<div class="bub-row"><span class="rl">Prix</span><span class="rv">${esc(comp.prix || "-")}</span></div>` +
          `<div class="bub-row"><span class="rl">Prix/m²</span><span class="rv">${esc(comp.prixM2 || "-")}</span></div>` +
          `<div class="bub-row"><span class="rl">Taux</span><span class="rv">${esc(comp.taux || "-")}</span></div>` +
          `<div class="bub-foot">${esc(comp.date || "")}${comp.acquereur ? ` · ${esc(comp.acquereur)}` : ""}</div>`;
      }

      element.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        element.setPointerCapture(event.pointerId);
        element.classList.add("dragging");

        const dragOffset = {
          x: event.clientX - positions[index].x,
          y: event.clientY - positions[index].y,
        };

        const onMove = (moveEvent: PointerEvent) => {
          positions[index].x = Math.max(
            width / 2 + edgeInsets.left,
            Math.min(W - width / 2 - edgeInsets.right, moveEvent.clientX - dragOffset.x)
          );
          positions[index].y = Math.max(
            T + height / 2 + edgeInsets.top,
            Math.min(H - height / 2 - edgeInsets.bottom, moveEvent.clientY - dragOffset.y)
          );
          element.style.left = `${positions[index].x - width / 2}px`;
          element.style.top = `${positions[index].y - height / 2}px`;
          updateLines();
        };

        const onUp = () => {
          element.classList.remove("dragging");
          element.removeEventListener("pointermove", onMove);
          element.removeEventListener("pointerup", onUp);
        };

        element.addEventListener("pointermove", onMove);
        element.addEventListener("pointerup", onUp);
      });

      scene.appendChild(element);
    });

    const legend = document.createElement("div");
    legend.className = "bub-legend";
    legend.innerHTML =
      '<div class="bl-item"><div class="bl-dot gold"></div> Actif a commercialiser</div>' +
      `<div class="bl-item"><div class="bl-dot teal"></div> Comparable vendu (${comps.length})</div>`;
    scene.appendChild(legend);

    const watermark = document.createElement("div");
    watermark.className = "bub-watermark";
    watermark.innerHTML =
      '<div class="wm-brand">NEW<span>MARK</span></div><div class="wm-sub">Carte de Commercialisation</div>';
    scene.appendChild(watermark);

    let resizeTimeout: number | null = null;
    const onResize = () => {
      if (resizeTimeout) window.clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => setLayoutTick((tick) => tick + 1), 200);
    };
    resizeRef.current = onResize;
    window.addEventListener("resize", onResize);

    return () => clearBubbles();
  }, [view, actif, comps, mapRef, onEditAsset, onEditComp, clearBubbles, layoutTick]);

  return (
    <>
      <div
        id="bubbleScene"
        ref={sceneRef}
        data-bubble-scene
        className={`fixed inset-0 z-[800] h-screen w-screen overflow-hidden pointer-events-none ${view === "bubbles" ? "is-visible" : ""}`}
      />
      {view === "bubbles" && (
        <button
          data-export-button
          onClick={onExportPNG}
          className="fixed right-3 bottom-20 z-[900] border-none rounded-[10px] bg-primary px-3.5 py-2 text-[11px] font-bold text-white shadow-[0_4px_20px_rgba(0,0,0,.15)] transition-all hover:-translate-y-0.5 sm:right-5 sm:bottom-auto sm:px-5 sm:py-2.5 sm:text-xs sm:top-[calc(var(--bar-h)+12px)]"
        >
          <span className="sm:hidden">Export PNG</span>
          <span className="hidden sm:inline">Exporter en PNG</span>
        </button>
      )}
    </>
  );
}
