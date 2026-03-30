"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import { AuthGuard } from "@/components/auth/auth-guard";
import MapContainerWrapper from "@/components/map/map-container";
import TitleBar from "@/components/commercialisation/title-bar";
import Legend from "@/components/commercialisation/legend";
import MapStateCard from "@/components/commercialisation/map-state-card";
import ActionButtons from "@/components/commercialisation/action-buttons";
import ThemePicker from "@/components/theme-picker";
import BubbleScene from "@/components/commercialisation/bubble-scene";
import AssetForm from "@/components/commercialisation/asset-form";
import ComparableForm from "@/components/commercialisation/comparable-form";
import { ExportToast, ExportToastRef } from "@/components/export-toast";
import { useCommercialisationStore } from "@/hooks/use-commercialisation-store";
import {
  renderCommercialisationBubbleOverlayCanvas,
  waitForExportFonts,
} from "@/lib/bubble-export";
import {
  drawLeafletCanvasOverlayToCanvas,
  drawLeafletMarkersToCanvas,
  drawLeafletTooltipsToCanvas,
  rasterizeLeafletSvgOverlay,
  renderLeafletTilesToCanvas,
} from "@/lib/leaflet-export";
import { hasCoords } from "@/lib/geocode";
import type { Asset, Comparable, ViewMode } from "@/lib/types";

const TransitControls = dynamic(
  () => import("@/components/commercialisation/transit-controls"),
  { ssr: false }
);

export default function CommercialisationPage() {
  const store = useCommercialisationStore();
  const [view, setView] = useState<ViewMode>("map");
  const [fitTrigger, setFitTrigger] = useState(1);
  const [assetFormOpen, setAssetFormOpen] = useState(false);
  const [compFormOpen, setCompFormOpen] = useState(false);
  const [compEditIdx, setCompEditIdx] = useState(-1);
  const mapRef = useRef<LeafletMap | null>(null);
  const toastRef = useRef<ExportToastRef>(null);
  const exportCheckRanRef = useRef(false);
  const initialFitDoneRef = useRef(false);

  const handleSaveAsset = useCallback((a: Asset) => {
    store.setActif(a);
    setFitTrigger((n) => n + 1);
  }, [store]);

  const handleSaveComp = useCallback((c: Comparable, idx: number) => {
    if (idx >= 0) {
      store.updateComp(idx, c);
    } else {
      store.addComp(c);
    }
    setFitTrigger((n) => n + 1);
  }, [store]);

  const handleDeleteComp = useCallback((idx: number) => {
    const removed = store.comps[idx];
    store.deleteComp(idx);
    setFitTrigger((n) => n + 1);
    toastRef.current?.showUndo(`${removed?.nom || "Comparable"} supprimé`, () => {
      if (!removed) return;
      store.insertComp(idx, removed);
      setFitTrigger((n) => n + 1);
    });
  }, [store]);

  const handleEditComp = useCallback((idx: number) => { setCompEditIdx(idx); setCompFormOpen(true); }, []);
  const handleEditAsset = useCallback(() => { setAssetFormOpen(true); }, []);
  const handleOpenComp = useCallback(() => { setCompEditIdx(-1); setCompFormOpen(true); }, []);

  const handleExportPNG = useCallback(async () => {
    const isExportCheck =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("__codex_export_check") === "1";

    toastRef.current?.show("Préparation…");
    if (typeof document !== "undefined") {
      document.body.dataset.exportStatus = "running";
      delete document.body.dataset.exportMessage;
    }

    try {
      const mapEl = document.querySelector(".leaflet-container") as HTMLElement;
      if (!mapEl) throw new Error("Carte introuvable");
      const S = 2;
      await waitForExportFonts();
      const mapRect = mapEl.getBoundingClientRect();
      const cvs = await renderLeafletTilesToCanvas(mapEl, S);
      const ctx = cvs.getContext("2d");
      if (!ctx) throw new Error("Canvas introuvable");
      const svgOverlay = await rasterizeLeafletSvgOverlay(mapEl);
      if (svgOverlay) {
        ctx.drawImage(svgOverlay.img, svgOverlay.x, svgOverlay.y, svgOverlay.w, svgOverlay.h);
      }
      drawLeafletCanvasOverlayToCanvas(ctx, mapEl);
      drawLeafletMarkersToCanvas(ctx, mapEl);
      await drawLeafletTooltipsToCanvas(ctx, mapEl);

      const filename = `Newmark_Commercialisation_${new Date().toISOString().slice(0, 10)}.png`;

      if (view === "bubbles") {
        toastRef.current?.show("Rendu des bulles…");
        const scene = document.querySelector<HTMLElement>("#bubbleScene");
        if (!scene) throw new Error("Scène des bulles introuvable");
        const W = window.innerWidth;
        const H = window.innerHeight;
        const cards = Array.from(scene.querySelectorAll<HTMLElement>(".bub-card"));
        const cardState = cards.map((card) => ({
          animation: card.style.animation,
          opacity: card.style.opacity,
        }));

        cards.forEach((card) => {
          card.style.animation = "none";
          card.style.opacity = "1";
        });

        let bubbleCvs: HTMLCanvasElement;
        try {
          await new Promise((resolve) => window.setTimeout(resolve, 50));
          bubbleCvs = renderCommercialisationBubbleOverlayCanvas({
            scene,
            actif: store.actif,
            comps: store.comps,
            scale: S,
          });
        } finally {
          cards.forEach((card, index) => {
            card.style.animation = cardState[index].animation;
            card.style.opacity = cardState[index].opacity;
          });
        }

        const barH = document.querySelector<HTMLElement>(".title-bar")?.offsetHeight ?? Math.round(mapRect.top);
        const outCvs = document.createElement("canvas");
        outCvs.width = W * S;
        outCvs.height = Math.max(1, H - barH) * S;
        const outCtx = outCvs.getContext("2d");
        if (!outCtx) throw new Error("Export impossible");
        outCtx.fillStyle = "#ffffff";
        outCtx.fillRect(0, 0, outCvs.width, outCvs.height);
        outCtx.drawImage(
          cvs,
          0,
          0,
          cvs.width,
          cvs.height,
          Math.round(mapRect.left * S),
          0,
          Math.round(mapRect.width * S),
          Math.round(mapRect.height * S)
        );
        outCtx.drawImage(
          bubbleCvs,
          0,
          barH * S,
          W * S,
          Math.max(1, H - barH) * S,
          0,
          0,
          W * S,
          Math.max(1, H - barH) * S
        );

        if (!isExportCheck) {
          const blob = await new Promise<Blob | null>((res) => outCvs.toBlob(res, "image/png"));
          if (!blob) throw new Error("Export failed");
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.download = filename;
          link.href = url;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
        }
      } else {
        if (!isExportCheck) {
          const blob = await new Promise<Blob | null>((res) => cvs.toBlob(res, "image/png"));
          if (!blob) throw new Error("Export failed");
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.download = filename;
          link.href = url;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
        }
      }
      toastRef.current?.show("✓ Image exportée !");
      if (typeof document !== "undefined") {
        document.body.dataset.exportStatus = "ok";
        document.body.dataset.exportFilename = filename;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur";
      toastRef.current?.show(`✕ ${message}`);
      if (typeof document !== "undefined") {
        document.body.dataset.exportStatus = "error";
        document.body.dataset.exportMessage = message;
      }
    }
  }, [store.actif, store.comps, view]);

  const handleThemeChange = useCallback(() => { setFitTrigger((n) => n + 1); }, []);

  useEffect(() => {
    const hasMappableData = Boolean(
      (store.actif && hasCoords(store.actif.lat, store.actif.lng)) ||
      store.comps.some((comp) => hasCoords(comp.lat, comp.lng))
    );
    if (!hasMappableData || initialFitDoneRef.current) return;

    initialFitDoneRef.current = true;
    const timer = window.setTimeout(() => {
      setFitTrigger((n) => n + 1);
    }, 150);

    return () => window.clearTimeout(timer);
  }, [store.actif, store.comps]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("__codex_export_check") !== "1") return;
    if (exportCheckRanRef.current) return;
    if (view !== "bubbles") {
      setView("bubbles");
      return;
    }

    const mapEl = document.querySelector<HTMLElement>(".leaflet-container");
    const scene = document.querySelector<HTMLElement>("[data-bubble-scene]");
    if (!mapEl || !scene) return;

    const sceneRect = scene.getBoundingClientRect();
    const mapRect = mapEl.getBoundingClientRect();
    const markerCenters = Array.from(
      document.querySelectorAll<HTMLElement>(".leaflet-marker-pane .leaflet-marker-icon")
    )
      .map((el) => {
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        return {
          x: rect.left + rect.width / 2 - sceneRect.left,
          y: rect.top + rect.height / 2 - sceneRect.top,
        };
      })
      .filter((value): value is { x: number; y: number } => Boolean(value));

    const dots = Array.from(scene.querySelectorAll<SVGCircleElement>("svg circle"))
      .filter((circle) => {
        const fill = circle.getAttribute("fill");
        return fill && fill !== "none";
      })
      .map((circle) => ({
        x: Number(circle.getAttribute("cx") || "0"),
        y: Number(circle.getAttribute("cy") || "0"),
      }));

    const nearestDistance = (point: { x: number; y: number }) => {
      if (!markerCenters.length) return null;
      return markerCenters.reduce((best, current) => {
        const dx = point.x - current.x;
        const dy = point.y - current.y;
        return Math.min(best, Math.sqrt(dx * dx + dy * dy));
      }, Number.POSITIVE_INFINITY);
    };

    const dotDistances = dots
      .map((point) => nearestDistance(point))
      .filter((value): value is number => value != null && Number.isFinite(value));

    const alignmentOk =
      Math.abs(sceneRect.left - mapRect.left) <= 1 &&
      Math.abs(sceneRect.right - mapRect.right) <= 1 &&
      Math.abs(sceneRect.bottom - mapRect.bottom) <= 1 &&
      dotDistances.every((value) => value <= 2.5);

    document.body.dataset.alignmentOk = alignmentOk ? "1" : "0";
    document.body.dataset.alignmentMaxDotDistance = dotDistances.length
      ? Math.max(...dotDistances).toFixed(2)
      : "";
    document.body.dataset.alignmentTopOffset = Math.round(mapRect.top - sceneRect.top).toString();

    exportCheckRanRef.current = true;
    window.setTimeout(() => {
      void handleExportPNG();
    }, 1200);
  }, [handleExportPNG, view]);

  return (
    <AuthGuard>
      <TitleBar actif={store.actif} comps={store.comps} view={view} onViewChange={setView} themePickerSlot={<ThemePicker onThemeChange={handleThemeChange} />} />
      <div id="leaflet-map">
        <MapContainerWrapper actif={store.actif} comps={store.comps} fitTrigger={fitTrigger} onEditAsset={handleEditAsset} onEditComp={handleEditComp} onDeleteComp={handleDeleteComp} mapRef={mapRef} />
      </div>
      {view === "map" && (
        <>
          <Legend />
          <MapStateCard actif={store.actif} comps={store.comps} onOpenAsset={handleEditAsset} onOpenComp={handleOpenComp} />
          <TransitControls mapRef={mapRef} view={view} />
        </>
      )}
      <ActionButtons view={view} hasAsset={!!store.actif} onOpenAsset={handleEditAsset} onOpenComp={handleOpenComp} />
      <BubbleScene view={view} actif={store.actif} comps={store.comps} mapRef={mapRef} onEditAsset={handleEditAsset} onEditComp={handleEditComp} onExportPNG={handleExportPNG} />
      <AssetForm open={assetFormOpen} onClose={() => setAssetFormOpen(false)} current={store.actif} onSave={handleSaveAsset} />
      <ComparableForm open={compFormOpen} onClose={() => { setCompFormOpen(false); setCompEditIdx(-1); }} current={compEditIdx >= 0 ? store.comps[compEditIdx] : null} editIdx={compEditIdx} onSave={handleSaveComp} />
      <ExportToast ref={toastRef} />
    </AuthGuard>
  );
}
