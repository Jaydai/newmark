"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import { hasCoords } from "@/lib/geocode";
import { fmtEuro, fmtLoyer, fmtSurface } from "@/lib/format";
import type { OffreRetail } from "@/lib/types";

const MAX_BUBBLE_CARDS = 25;

type MapEventName = "move" | "zoom" | "viewreset" | "resize" | "moveend" | "zoomend";

function esc(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function bubbleScore(item: OffreRetail): number {
  return (item.loyer ?? 0) + (item.surface ?? 0) * 10;
}

interface OrBubbleSceneProps {
  active: boolean;
  visible: boolean;
  data: OffreRetail[];
  mapRef: React.MutableRefObject<LeafletMap | null>;
  onSelect: (item: OffreRetail) => void;
  sidebarWidth: number;
  analyticsWidth: number;
}

export default function OrBubbleScene({
  active,
  visible,
  data,
  mapRef,
  onSelect,
  sidebarWidth,
  analyticsWidth,
}: OrBubbleSceneProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const mapHandlersRef = useRef<Array<{ event: MapEventName; handler: () => void }>>([]);
  const savedPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const currentBubbleIdsRef = useRef("");
  const moveDebounceRef = useRef<number | null>(null);
  const resizeDebounceRef = useRef<number | null>(null);
  const lineRafRef = useRef<number | null>(null);
  const startupTimeoutRef = useRef<number | null>(null);
  const resizeListenerRef = useRef<(() => void) | null>(null);

  const clearBubbles = useCallback(() => {
    const map = mapRef.current;
    if (map) {
      mapHandlersRef.current.forEach(({ event, handler }) => map.off(event, handler));
    }
    mapHandlersRef.current = [];
    currentBubbleIdsRef.current = "";

    if (moveDebounceRef.current != null) window.clearTimeout(moveDebounceRef.current);
    if (resizeDebounceRef.current != null) window.clearTimeout(resizeDebounceRef.current);
    if (startupTimeoutRef.current != null) window.clearTimeout(startupTimeoutRef.current);
    if (lineRafRef.current != null) window.cancelAnimationFrame(lineRafRef.current);

    moveDebounceRef.current = null;
    resizeDebounceRef.current = null;
    startupTimeoutRef.current = null;
    lineRafRef.current = null;

    if (resizeListenerRef.current) {
      window.removeEventListener("resize", resizeListenerRef.current);
      resizeListenerRef.current = null;
    }

    if (sceneRef.current) sceneRef.current.innerHTML = "";
  }, [mapRef]);

  const getBubbleItems = useCallback((padRatio = 0) => {
    const map = mapRef.current;
    const geocoded = data.filter((item) => hasCoords(item.lat, item.lng));
    if (!map || !geocoded.length) return { shown: [] as OffreRetail[], total: 0 };

    const bounds = map.getBounds().pad(padRatio);
    const inView = geocoded.filter((item) => bounds.contains([item.lat!, item.lng!]));
    if (!inView.length) return { shown: [] as OffreRetail[], total: 0 };
    if (inView.length <= MAX_BUBBLE_CARDS) return { shown: inView, total: inView.length };

    const shown = [...inView]
      .sort((a, b) => bubbleScore(b) - bubbleScore(a))
      .slice(0, MAX_BUBBLE_CARDS);

    return { shown, total: inView.length };
  }, [data, mapRef]);

  useEffect(() => {
    if (!active) {
      clearBubbles();
      return;
    }

    let cancelled = false;

    const renderBubbles = () => {
      clearBubbles();
      if (cancelled) return;

      const map = mapRef.current;
      const scene = sceneRef.current;
      if (!map || !scene) return;

      const sceneRect = scene.getBoundingClientRect();
      const width = sceneRect.width;
      const height = sceneRect.height;
      const topOffset = 0;
      const geocoded = data.filter((item) => hasCoords(item.lat, item.lng));
      const { shown: visibleItems, total: totalInView } = getBubbleItems();

      if (!data.length) {
        scene.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--text-secondary);pointer-events:auto">Aucune offre à afficher.</div>';
        return;
      }

      if (!geocoded.length) {
        scene.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--text-secondary);pointer-events:auto">Aucune offre géolocalisée.</div>';
        return;
      }

      if (!visibleItems.length) {
        scene.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--text-secondary);pointer-events:auto">Aucune offre visible dans cette zone.</div>';
        return;
      }

      currentBubbleIdsRef.current = visibleItems.map((item) => item.id).join(",");

      const markerToScene = (item: OffreRetail) => {
        const mapEl = map.getContainer();
        const mapRect = mapEl.getBoundingClientRect();
        const point = map.latLngToContainerPoint([item.lat!, item.lng!]);
        return {
          x: mapRect.left + point.x - sceneRect.left,
          y: mapRect.top + point.y - sceneRect.top,
        };
      };

      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("class", "absolute inset-0 w-full h-full pointer-events-none");
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      scene.appendChild(svg);

      const count = visibleItems.length;
      let cardWidth = 160;
      let cardHeight = 115;
      if (count > 20) {
        cardWidth = 120;
        cardHeight = 85;
      } else if (count > 12) {
        cardWidth = 140;
        cardHeight = 100;
      }

      const radii = visibleItems.map(() => Math.max(cardWidth, cardHeight) / 2);
      const padding = 20;
      const left = padding;
      const right = width - padding;
      const top = topOffset + padding;
      const bottom = height - padding;
      const usableWidth = right - left;
      const usableHeight = bottom - top;
      const perimeter = 2 * (usableWidth + usableHeight);

      const xyToPerimeter = (x: number, y: number) => {
        const centerX = (left + right) / 2;
        const centerY = (top + bottom) / 2;
        const dx = x - centerX;
        const dy = y - centerY;
        if (dx === 0 && dy === 0) return 0;

        const scaleX = Math.abs(dx) > 0 ? usableWidth / 2 / Math.abs(dx) : Number.POSITIVE_INFINITY;
        const scaleY = Math.abs(dy) > 0 ? usableHeight / 2 / Math.abs(dy) : Number.POSITIVE_INFINITY;
        const scale = Math.min(scaleX, scaleY);
        const edgeX = centerX + dx * scale;
        const edgeY = centerY + dy * scale;

        if (Math.abs(edgeY - top) < 1) return edgeX - left;
        if (Math.abs(edgeX - right) < 1) return usableWidth + (edgeY - top);
        if (Math.abs(edgeY - bottom) < 1) return usableWidth + usableHeight + (right - edgeX);
        return 2 * usableWidth + usableHeight + (bottom - edgeY);
      };

      const perimeterToXY = (distance: number) => {
        const normalized = ((distance % perimeter) + perimeter) % perimeter;
        if (normalized <= usableWidth) return { x: left + normalized, y: top };
        if (normalized <= usableWidth + usableHeight) {
          return { x: right, y: top + (normalized - usableWidth) };
        }
        if (normalized <= 2 * usableWidth + usableHeight) {
          return { x: right - (normalized - usableWidth - usableHeight), y: bottom };
        }
        return { x: left, y: bottom - (normalized - 2 * usableWidth - usableHeight) };
      };

      const markerScreens = visibleItems.map((item) => markerToScene(item));
      const perimeterDistances = markerScreens.map((point) => xyToPerimeter(point.x, point.y));
      const sortedIndices = [...Array(count).keys()].sort((a, b) => perimeterDistances[a] - perimeterDistances[b]);
      const slotDistances = new Array<number>(count);
      sortedIndices.forEach((idx) => {
        slotDistances[idx] = perimeterDistances[idx];
      });

      const minGap = perimeter / (count * 0.8);
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i < sortedIndices.length - 1; i++) {
          const a = sortedIndices[i];
          const b = sortedIndices[i + 1];
          const gap = slotDistances[b] - slotDistances[a];
          if (gap < minGap) {
            const push = (minGap - gap) / 2;
            slotDistances[a] -= push;
            slotDistances[b] += push;
          }
        }

        if (sortedIndices.length > 1) {
          const first = sortedIndices[0];
          const last = sortedIndices[sortedIndices.length - 1];
          const wrapGap = slotDistances[first] + perimeter - slotDistances[last];
          if (wrapGap < minGap) {
            const push = (minGap - wrapGap) / 2;
            slotDistances[last] -= push;
            slotDistances[first] += push;
          }
        }

        for (let i = 0; i < count; i++) {
          slotDistances[i] = ((slotDistances[i] % perimeter) + perimeter) % perimeter;
        }
      }

      const positions = visibleItems.map((_, idx) => perimeterToXY(slotDistances[idx]));

      for (let iter = 0; iter < 60; iter++) {
        for (let i = 0; i < count; i++) {
          let forceX = 0;
          let forceY = 0;

          for (let j = 0; j < count; j++) {
            if (i === j) continue;
            const dx = positions[i].x - positions[j].x;
            const dy = positions[i].y - positions[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            const minDistance = radii[i] + radii[j] + 16;

            if (distance < minDistance) {
              const force = (minDistance - distance) * 0.18;
              forceX += (dx / distance) * force;
              forceY += (dy / distance) * force;
            }
          }

          const slot = perimeterToXY(slotDistances[i]);
          forceX += (slot.x - positions[i].x) * 0.06;
          forceY += (slot.y - positions[i].y) * 0.06;

          positions[i].x += forceX;
          positions[i].y += forceY;

          const halfWidth = cardWidth / 2;
          const halfHeight = cardHeight / 2;
          positions[i].x = Math.max(halfWidth + 6, Math.min(width - halfWidth - 6, positions[i].x));
          positions[i].y = Math.max(topOffset + halfHeight + 6, Math.min(height - halfHeight - 6, positions[i].y));
        }
      }

      visibleItems.forEach((item, idx) => {
        const saved = savedPositionsRef.current[item.id];
        if (saved) positions[idx] = { ...saved };
      });

      const svgElements = visibleItems.map(() => {
        const color = "var(--map-blue)";
        const line = document.createElementNS(svgNS, "line");
        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", "1.5");
        line.setAttribute("stroke-dasharray", "6 4");
        line.setAttribute("opacity", "0.4");

        const dot = document.createElementNS(svgNS, "circle");
        dot.setAttribute("r", "4");
        dot.setAttribute("fill", color);
        dot.setAttribute("opacity", "0.4");

        const ring = document.createElementNS(svgNS, "circle");
        ring.setAttribute("r", "7");
        ring.setAttribute("fill", "none");
        ring.setAttribute("stroke", color);
        ring.setAttribute("stroke-width", "1.5");
        ring.setAttribute("opacity", "0.4");

        svg.appendChild(line);
        svg.appendChild(ring);
        svg.appendChild(dot);

        return { line, dot, ring };
      });

      const updateLines = () => {
        visibleItems.forEach((item, idx) => {
          const point = markerToScene(item);
          const bubble = positions[idx];

          svgElements[idx].line.setAttribute("x1", String(point.x));
          svgElements[idx].line.setAttribute("y1", String(point.y));
          svgElements[idx].line.setAttribute("x2", String(bubble.x));
          svgElements[idx].line.setAttribute("y2", String(bubble.y));
          svgElements[idx].dot.setAttribute("cx", String(point.x));
          svgElements[idx].dot.setAttribute("cy", String(point.y));
          svgElements[idx].ring.setAttribute("cx", String(point.x));
          svgElements[idx].ring.setAttribute("cy", String(point.y));
        });
      };

      updateLines();

      const updateLinesThrottled = () => {
        if (lineRafRef.current != null) return;
        lineRafRef.current = window.requestAnimationFrame(() => {
          updateLines();
          lineRafRef.current = null;
        });
      };

      (["move", "zoom", "viewreset", "resize"] as const).forEach((event) => {
        map.on(event, updateLinesThrottled);
        mapHandlersRef.current.push({ event, handler: updateLinesThrottled });
      });

      const onMapShift = () => {
        if (moveDebounceRef.current != null) window.clearTimeout(moveDebounceRef.current);
        moveDebounceRef.current = window.setTimeout(() => {
          const nextIds = getBubbleItems(0.5).shown.map((item) => item.id).join(",");
          if (nextIds !== currentBubbleIdsRef.current) renderBubbles();
        }, 400);
      };

      map.on("moveend", onMapShift);
      map.on("zoomend", onMapShift);
      mapHandlersRef.current.push({ event: "moveend", handler: onMapShift });
      mapHandlersRef.current.push({ event: "zoomend", handler: onMapShift });

      visibleItems.forEach((item, idx) => {
        const bubble = document.createElement("div");
        bubble.dataset.orBubbleCard = "true";
        bubble.tabIndex = 0;
        bubble.setAttribute("role", "button");
        bubble.setAttribute("aria-label", `Ouvrir le détail de ${item.enseigne || item.ref || "cette offre"}`);
        bubble.style.cssText = `position:absolute;border-radius:var(--radius);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;cursor:grab;pointer-events:auto;overflow:hidden;width:${cardWidth}px;min-height:${cardHeight}px;left:${positions[idx].x - cardWidth / 2}px;top:${positions[idx].y - cardHeight / 2}px;opacity:0;animation:bubAppear .5s cubic-bezier(.34,1.56,.64,1) forwards;animation-delay:${idx * Math.min(0.07, 0.8 / count)}s;background:#ffffff;border:2px solid var(--map-blue);box-shadow:0 0 0 1px var(--map-blue-08),0 8px 28px rgba(0,0,0,.12);padding:6px 8px;font-family:"DM Sans",system-ui,sans-serif;user-select:none`;

        const compact = count > 30;
        const medium = count > 15;
        const nameSize = compact ? "8px" : medium ? "9px" : "10px";
        const rowSize = compact ? "7px" : "8px";

        bubble.innerHTML = [
          `<div class="or-bub-badge" style="background:var(--map-blue);color:#fff;font-size:6px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;padding:1px 6px;border-radius:20px;margin-bottom:2px;white-space:nowrap">OFFRE RETAIL</div>`,
          `<div class="or-bub-name" style="font-size:${nameSize};font-weight:700;color:var(--primary);line-height:1.15;margin-bottom:1px;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.enseigne || item.ref || "-")}</div>`,
          `<div class="or-bub-area" style="font-size:7px;color:var(--text-secondary);margin-bottom:2px;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.adresse || "")}</div>`,
          `<div class="or-bub-row" style="display:flex;justify-content:space-between;width:85%;font-size:${rowSize};padding:0"><span class="or-bub-label" style="color:var(--text-secondary)">Surface</span><span class="or-bub-value" style="font-weight:700;color:var(--primary)">${esc(fmtSurface(item.surface))}</span></div>`,
          `<div class="or-bub-row" style="display:flex;justify-content:space-between;width:85%;font-size:${rowSize};padding:0"><span class="or-bub-label" style="color:var(--text-secondary)">Loyer</span><span class="or-bub-value" style="font-weight:700;color:var(--primary)">${esc(fmtEuro(item.loyer))}</span></div>`,
          `<div class="or-bub-row" style="display:flex;justify-content:space-between;width:85%;font-size:${rowSize};padding:0"><span class="or-bub-label" style="color:var(--text-secondary)">&euro;/m&sup2;</span><span class="or-bub-value" style="font-weight:700;color:var(--primary)">${esc(fmtLoyer(item.loyerM2))}</span></div>`,
        ].join("");

        bubble.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onSelect(item);
        });

        bubble.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          bubble.setPointerCapture(event.pointerId);
          bubble.style.cursor = "grabbing";
          bubble.style.zIndex = "900";
          bubble.style.transform = "scale(1.05)";

          let dragged = false;
          const startX = event.clientX;
          const startY = event.clientY;
          const offsetX = event.clientX - positions[idx].x;
          const offsetY = event.clientY - positions[idx].y;

          const onMove = (moveEvent: PointerEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            if (Math.sqrt(dx * dx + dy * dy) > 5) dragged = true;

            positions[idx].x = Math.max(cardWidth / 2 + 6, Math.min(width - cardWidth / 2 - 6, moveEvent.clientX - offsetX));
            positions[idx].y = Math.max(cardHeight / 2 + 6, Math.min(height - cardHeight / 2 - 6, moveEvent.clientY - offsetY));

            bubble.style.left = `${positions[idx].x - cardWidth / 2}px`;
            bubble.style.top = `${positions[idx].y - cardHeight / 2}px`;
            updateLines();
          };

          const onUp = () => {
            bubble.style.cursor = "grab";
            bubble.style.zIndex = "";
            bubble.style.transform = "";
            bubble.removeEventListener("pointermove", onMove);
            bubble.removeEventListener("pointerup", onUp);

            if (dragged) {
              savedPositionsRef.current[item.id] = { ...positions[idx] };
            } else {
              onSelect(item);
            }
          };

          bubble.addEventListener("pointermove", onMove);
          bubble.addEventListener("pointerup", onUp);
        });

        scene.appendChild(bubble);
      });

      if (totalInView > MAX_BUBBLE_CARDS) {
        const badge = document.createElement("div");
        badge.style.cssText = "position:absolute;bottom:12px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.65);color:#fff;font-family:\"DM Sans\",system-ui,sans-serif;font-size:11px;font-weight:600;padding:5px 14px;border-radius:20px;pointer-events:none;white-space:nowrap;z-index:10";
        badge.textContent = `+${totalInView - MAX_BUBBLE_CARDS} autre${totalInView - MAX_BUBBLE_CARDS > 1 ? "s" : ""} dans cette vue`;
        scene.appendChild(badge);
      }

      const watermark = document.createElement("div");
      watermark.style.cssText = "position:absolute;bottom:20px;left:0;right:0;text-align:center;z-index:810;pointer-events:none";
      watermark.innerHTML = '<div style="font-size:14px;font-weight:600;letter-spacing:3px;color:rgba(0,0,0,.06)">NEWMARK</div><div style="font-size:8px;letter-spacing:2px;text-transform:uppercase;color:rgba(0,0,0,.04);margin-top:2px">Offre Retail</div>';
      scene.appendChild(watermark);

      const onResize = () => {
        if (resizeDebounceRef.current != null) window.clearTimeout(resizeDebounceRef.current);
        resizeDebounceRef.current = window.setTimeout(() => renderBubbles(), 200);
      };

      window.addEventListener("resize", onResize);
      resizeListenerRef.current = onResize;
    };

    const bootstrap = () => {
      if (cancelled) return;

      const map = mapRef.current;
      const scene = sceneRef.current;
      if (!map || !scene) {
        startupTimeoutRef.current = window.setTimeout(bootstrap, 80);
        return;
      }

      map.invalidateSize();
      renderBubbles();
    };

    startupTimeoutRef.current = window.setTimeout(bootstrap, 80);

    return () => {
      cancelled = true;
      clearBubbles();
    };
  }, [active, analyticsWidth, clearBubbles, data, getBubbleItems, mapRef, onSelect]);

  return (
    <div
      ref={sceneRef}
      data-or-bubble-scene
      className={active ? "fixed overflow-hidden pointer-events-none" : "hidden"}
      style={{
        top: "var(--bar-h)",
        left: `${sidebarWidth}px`,
        right: `${analyticsWidth}px`,
        bottom: 0,
        opacity: visible ? 1 : 0,
        zIndex: visible ? 800 : 0,
      }}
    />
  );
}
