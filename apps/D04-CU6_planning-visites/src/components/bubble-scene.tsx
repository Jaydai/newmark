"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { Visit } from "@/lib/types";
import { hasCoords } from "@/lib/geocode";

function esc(s: string) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

interface BubbleSceneProps {
  visits: Visit[];
  mapRef: React.MutableRefObject<LeafletMap | null>;
  onEditVisit: (idx: number) => void;
  visible: boolean;
  fitTrigger: number;
}

export default function BubbleScene({
  visits,
  mapRef,
  onEditVisit,
  visible,
  fitTrigger,
}: BubbleSceneProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const handlersRef = useRef<(() => void)[]>([]);
  const resizeRef = useRef<(() => void) | null>(null);

  const clearBubbles = useCallback(() => {
    const map = mapRef.current;
    if (map) {
      handlersRef.current.forEach((h) => map.off("move zoom viewreset resize", h));
    }
    handlersRef.current = [];
    if (sceneRef.current) sceneRef.current.innerHTML = "";
    if (resizeRef.current) {
      window.removeEventListener("resize", resizeRef.current);
      resizeRef.current = null;
    }
  }, [mapRef]);

  const renderBubbles = useCallback(() => {
    clearBubbles();
    const scene = sceneRef.current;
    const map = mapRef.current;
    if (!scene || !map || !visible) return;

    const sceneRect = scene.getBoundingClientRect();
    const W = sceneRect.width;
    const H = sceneRect.height;
    const n = visits.length;

    if (!n) {
      scene.innerHTML = `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font-size:14px;color:var(--text-tertiary);pointer-events:auto"><div>Aucune visite planifiée.</div></div>`;
      return;
    }

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "absolute inset-0 w-full h-full pointer-events-none");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    scene.appendChild(svg);

    const cardW = 190;
    const cardH = 120;
    const radii = visits.map(() => Math.max(cardW, cardH) / 2);

    const pad = 20;
    const Left = pad;
    const Right = W - pad;
    const Top = pad;
    const Bot = H - pad;
    const usableW = Right - Left;
    const usableH = Bot - Top;
    const perim = 2 * (usableW + usableH);

    function markerToScreen(latlng: [number, number]) {
      const mapEl = document.querySelector<HTMLElement>("[data-map-root]");
      if (!mapEl) return { x: W / 2, y: H / 2 };
      const rect = mapEl.getBoundingClientRect();
      const sr = scene!.getBoundingClientRect();
      const pt = map!.latLngToContainerPoint(latlng);
      return { x: rect.left + pt.x - sr.left, y: rect.top + pt.y - sr.top };
    }

    function markerFromDom(index: number) {
      const marker = Array.from(
        document.querySelectorAll<HTMLElement>(".leaflet-marker-pane .leaflet-marker-icon")
      ).find((el) => el.textContent?.trim() === String(index + 1));
      if (!marker) return null;

      const rect = marker.getBoundingClientRect();
      const sr = scene!.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2 - sr.left,
        y: rect.top + rect.height / 2 - sr.top,
      };
    }

    function xyToPerimD(px: number, py: number) {
      const cx = (Left + Right) / 2;
      const cy = (Top + Bot) / 2;
      const dx = px - cx;
      const dy = py - cy;
      if (dx === 0 && dy === 0) return 0;
      const scaleX = Math.abs(dx) > 0 ? usableW / 2 / Math.abs(dx) : Infinity;
      const scaleY = Math.abs(dy) > 0 ? usableH / 2 / Math.abs(dy) : Infinity;
      const s = Math.min(scaleX, scaleY);
      const ex = cx + dx * s;
      const ey = cy + dy * s;
      if (Math.abs(ey - Top) < 1) return ex - Left;
      if (Math.abs(ex - Right) < 1) return usableW + (ey - Top);
      if (Math.abs(ey - Bot) < 1) return usableW + usableH + (Right - ex);
      return 2 * usableW + usableH + (Bot - ey);
    }

    function perimDtoXY(d: number) {
      d = ((d % perim) + perim) % perim;
      if (d <= usableW) return { x: Left + d, y: Top };
      if (d <= usableW + usableH) return { x: Right, y: Top + (d - usableW) };
      if (d <= 2 * usableW + usableH) return { x: Right - (d - usableW - usableH), y: Bot };
      return { x: Left, y: Bot - (d - 2 * usableW - usableH) };
    }

    const markerScreens = visits.map((v, i) =>
      markerFromDom(i) ??
      (hasCoords(v.lat, v.lng)
        ? markerToScreen([Number(v.lat), Number(v.lng)])
        : { x: W / 2, y: H / 2 })
    );
    const perimDs = markerScreens.map((ms) => xyToPerimD(ms.x, ms.y));
    const sortedIndices = [...Array(n).keys()].sort((a, b) => perimDs[a] - perimDs[b]);
    const slotPerimDs = new Array(n);
    sortedIndices.forEach((idx) => { slotPerimDs[idx] = perimDs[idx]; });

    const minGap = perim / (n * 0.8);
    for (let pass = 0; pass < 3; pass++) {
      const order = [...sortedIndices];
      for (let k = 0; k < order.length - 1; k++) {
        const a = order[k];
        const b = order[k + 1];
        const gap = slotPerimDs[b] - slotPerimDs[a];
        if (gap < minGap) {
          const push = (minGap - gap) / 2;
          slotPerimDs[a] -= push;
          slotPerimDs[b] += push;
        }
      }
      if (order.length > 1) {
        const a = order[order.length - 1];
        const b = order[0];
        const gap = (slotPerimDs[b] + perim) - slotPerimDs[a];
        if (gap < minGap) {
          const push = (minGap - gap) / 2;
          slotPerimDs[a] -= push;
          slotPerimDs[b] += push;
        }
      }
      for (let i = 0; i < n; i++) {
        slotPerimDs[i] = ((slotPerimDs[i] % perim) + perim) % perim;
      }
    }

    const positions = visits.map((_, i) => perimDtoXY(slotPerimDs[i]));

    // Physics push
    for (let iter = 0; iter < 60; iter++) {
      for (let i = 0; i < n; i++) {
        let fx = 0;
        let fy = 0;
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const dx = positions[i].x - positions[j].x;
          const dy = positions[i].y - positions[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minD = radii[i] + radii[j] + 16;
          if (dist < minD) {
            const f = (minD - dist) * 0.18;
            fx += (dx / dist) * f;
            fy += (dy / dist) * f;
          }
        }
        const slot = perimDtoXY(slotPerimDs[i]);
        fx += (slot.x - positions[i].x) * 0.06;
        fy += (slot.y - positions[i].y) * 0.06;
        positions[i].x += fx;
        positions[i].y += fy;
        const hw = cardW / 2;
        const hh = cardH / 2;
        positions[i].x = Math.max(hw + 6, Math.min(W - hw - 6, positions[i].x));
        positions[i].y = Math.max(hh + 6, Math.min(H - hh - 6, positions[i].y));
      }
    }

    // SVG connector lines (marker → bubble)
    const svgEls = visits.map(() => {
      const col = "var(--map-green-25)";
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("stroke", col);
      line.setAttribute("stroke-width", "1.5");
      line.setAttribute("stroke-dasharray", "6 4");
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("r", "4");
      dot.setAttribute("fill", col);
      const ring = document.createElementNS(svgNS, "circle");
      ring.setAttribute("r", "7");
      ring.setAttribute("fill", "none");
      ring.setAttribute("stroke", col);
      ring.setAttribute("stroke-width", "1.5");
      ring.setAttribute("opacity", "0.4");
      svg.appendChild(line);
      svg.appendChild(ring);
      svg.appendChild(dot);
      return { line, dot, ring };
    });

    function updateLines() {
      visits.forEach((v, i) => {
        const vp =
          markerFromDom(i) ??
          (hasCoords(v.lat, v.lng)
            ? markerToScreen([Number(v.lat), Number(v.lng)])
            : { x: W / 2, y: H / 2 });
        const bub = positions[i];
        svgEls[i].line.setAttribute("x1", String(vp.x));
        svgEls[i].line.setAttribute("y1", String(vp.y));
        svgEls[i].line.setAttribute("x2", String(bub.x));
        svgEls[i].line.setAttribute("y2", String(bub.y));
        svgEls[i].dot.setAttribute("cx", String(vp.x));
        svgEls[i].dot.setAttribute("cy", String(vp.y));
        svgEls[i].ring.setAttribute("cx", String(vp.x));
        svgEls[i].ring.setAttribute("cy", String(vp.y));
      });
    }

    updateLines();
    let _raf: number | null = null;
    function updateLinesThrottled() {
      if (_raf) return;
      _raf = requestAnimationFrame(() => {
        updateLines();
        _raf = null;
      });
    }
    map.on("move zoom viewreset resize", updateLinesThrottled);
    handlersRef.current.push(updateLinesThrottled);

    // Create bubble cards
    visits.forEach((v, i) => {
      const el = document.createElement("div");
      el.className = "absolute rounded-[var(--radius)] flex flex-col items-center justify-center text-center cursor-grab pointer-events-auto bg-white border-2 border-[var(--map-green)] shadow-[0_0_0_1px_rgba(0,0,0,.05),0_8px_28px_rgba(0,0,0,.12)] select-none overflow-hidden";
      el.setAttribute("data-bubble-card", "true");
      el.style.width = cardW + "px";
      el.style.minHeight = cardH + "px";
      el.style.left = positions[i].x - cardW / 2 + "px";
      el.style.top = positions[i].y - cardH / 2 + "px";
      el.style.padding = "10px 14px";
      el.style.opacity = "0";
      el.style.animation = `bubAppear .5s cubic-bezier(.34,1.56,.64,1) ${i * 0.07}s forwards`;
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", `Modifier la visite ${v.name || "numéro " + (i + 1)}`);

      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEditVisit(i);
        }
      });

      el.innerHTML = `<div style="width:22px;height:22px;border-radius:50%;background:var(--map-green);color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-bottom:4px">${i + 1}</div><div style="font-size:12px;font-weight:700;color:var(--primary);line-height:1.15;margin-bottom:2px;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.name)}</div><div style="font-size:8px;color:var(--text-tertiary);margin-bottom:6px;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.address)}</div><div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">${v.arrival ? `<span style="font-size:9px;font-weight:600;padding:2px 8px;border-radius:5px;background:var(--map-green-10);color:var(--map-green)">${v.arrival}</span>` : ""}${v.departure ? `<span style="font-size:9px;font-weight:600;padding:2px 8px;border-radius:5px;background:var(--map-blue-08);color:var(--map-blue)">${v.departure}</span>` : ""}</div><div style="font-size:8px;color:var(--text-tertiary);margin-top:3px">${v.duration} min de visite</div>`;

      // Drag handling
      let dragOff: { x: number; y: number } | null = null;
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.setPointerCapture(e.pointerId);
        el.style.cursor = "grabbing";
        el.style.zIndex = "900";
        el.style.transform = "scale(1.05)";
        el.style.boxShadow = "0 16px 48px rgba(0,0,0,.35)";
        dragOff = { x: e.clientX - positions[i].x, y: e.clientY - positions[i].y };
        function onMove(ev: PointerEvent) {
          if (!dragOff) return;
          positions[i].x = Math.max(cardW / 2 + 6, Math.min(W - cardW / 2 - 6, ev.clientX - dragOff.x));
          positions[i].y = Math.max(cardH / 2 + 6, Math.min(H - cardH / 2 - 6, ev.clientY - dragOff.y));
          el.style.left = positions[i].x - cardW / 2 + "px";
          el.style.top = positions[i].y - cardH / 2 + "px";
          updateLines();
        }
        function onUp() {
          el.style.cursor = "grab";
          el.style.zIndex = "";
          el.style.transform = "";
          el.style.boxShadow = "";
          dragOff = null;
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerup", onUp);
        }
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerup", onUp);
      });

      scene.appendChild(el);
    });

    // Watermark
    const wm = document.createElement("div");
    wm.className = "absolute bottom-5 left-0 right-0 text-center z-[810] pointer-events-none";
    wm.innerHTML = `<div style="font-size:14px;font-weight:600;letter-spacing:3px;color:rgba(0,0,0,.06)">NEW<span>MARK</span></div><div style="font-size:8px;letter-spacing:2px;text-transform:uppercase;color:rgba(0,0,0,.04);margin-top:2px">Planning de Visites</div>`;
    scene.appendChild(wm);

    // Resize handler
    let _debounce: ReturnType<typeof setTimeout>;
    resizeRef.current = () => {
      clearTimeout(_debounce);
      _debounce = setTimeout(() => renderBubbles(), 200);
    };
    window.addEventListener("resize", resizeRef.current);
  }, [clearBubbles, mapRef, visits, onEditVisit, visible]);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => renderBubbles(), 450);
      return () => clearTimeout(timer);
    } else {
      clearBubbles();
    }
  }, [visible, fitTrigger, renderBubbles, clearBubbles]);

  return (
    <div
      ref={sceneRef}
      data-bubble-scene
      className="fixed overflow-hidden pointer-events-none"
      style={{
        display: visible ? "block" : "none",
        top: "var(--bar-h)",
        left: "var(--sidebar-w)",
        width: "calc(100vw - var(--sidebar-w))",
        height: "calc(100vh - var(--bar-h))",
        zIndex: 800,
      }}
    />
  );
}
