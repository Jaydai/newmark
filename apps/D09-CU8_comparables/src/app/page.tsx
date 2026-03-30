"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import { AuthGuard } from "@/components/auth/auth-guard";
import MapContainerWrapper from "@/components/map/map-container";
import TitleBar from "@/components/title-bar";
import Legend from "@/components/legend";
import MapStateCard from "@/components/map-state-card";
import ActionButtons from "@/components/action-buttons";
import ThemePicker from "@/components/theme-picker";
import BubbleScene from "@/components/bubble-scene";
import ReferenceForm from "@/components/reference-form";
import ComparableForm from "@/components/comparable-form";
import ImportPanel from "@/components/import-panel";
import { ExportToast, ExportToastRef } from "@/components/export-toast";
import { useComparablesStore } from "@/hooks/use-comparables-store";
import {
  renderComparablesBubbleOverlayCanvas,
  waitForExportFonts,
} from "@/lib/bubble-export";
import {
  drawLeafletCanvasOverlayToCanvas,
  drawLeafletMarkersToCanvas,
  drawLeafletTooltipsToCanvas,
  rasterizeLeafletSvgOverlay,
  renderLeafletTilesToCanvas,
} from "@/lib/leaflet-export";
import type { Reference, Comparable, ViewMode } from "@/lib/types";
import { hasCoords } from "@/lib/geocode";

const TransitControls = dynamic(() => import("@/components/transit-controls"), {
  ssr: false,
});

export default function ComparablesPage() {
  const store = useComparablesStore();
  const [view, setView] = useState<ViewMode>("map");
  const [fitTrigger, setFitTrigger] = useState(0);
  const initialFitDoneRef = useRef(false);

  // Panel states
  const [refFormOpen, setRefFormOpen] = useState(false);
  const [compFormOpen, setCompFormOpen] = useState(false);
  const [compEditIdx, setCompEditIdx] = useState(-1);
  const [importOpen, setImportOpen] = useState(false);

  const mapRef = useRef<LeafletMap | null>(null);
  const toastRef = useRef<ExportToastRef>(null);
  const exportCheckRanRef = useRef(false);

  const handleSaveRef = useCallback(
    (ref: Reference) => {
      store.setActif(ref);
      setFitTrigger((n) => n + 1);
    },
    [store]
  );

  const handleSaveComp = useCallback(
    (comp: Comparable, idx: number) => {
      if (idx >= 0) {
        store.updateComp(idx, comp);
        setFitTrigger((n) => n + 1);
      } else {
        store.addComp(comp);
        setFitTrigger((n) => n + 1);
      }
    },
    [store]
  );

  const handleDeleteComp = useCallback(
    (idx: number) => {
      const removed = store.comps[idx];
      store.deleteComp(idx);
      setFitTrigger((n) => n + 1);
      toastRef.current?.showUndo(`${removed?.preneur || "Comparable"} supprimé`, () => {
        if (!removed) return;
        store.insertComp(idx, removed);
        setFitTrigger((n) => n + 1);
      });
    },
    [store]
  );

  const handleEditComp = useCallback((idx: number) => {
    setCompEditIdx(idx);
    setCompFormOpen(true);
  }, []);

  const handleEditRef = useCallback(() => {
    setRefFormOpen(true);
  }, []);

  const handleOpenComp = useCallback(() => {
    setCompEditIdx(-1);
    setCompFormOpen(true);
  }, []);

  const handleImportComplete = useCallback(
    (
      actif: { nom: string; adresse: string; lat: number; lng: number } | null,
      comps: Comparable[]
    ) => {
      if (actif) store.setActif(actif);
      store.setComps(comps);
      setFitTrigger((n) => n + 1);
    },
    [store]
  );

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
      const isBubbleView = view === "bubbles";
      await waitForExportFonts();

      const mapRect = mapEl.getBoundingClientRect();
      const cvs = await renderLeafletTilesToCanvas(mapEl, S);
      const ctx = cvs.getContext("2d");
      if (!ctx) throw new Error("Canvas introuvable");
      drawLeafletCanvasOverlayToCanvas(ctx, mapEl);
      const svgOverlay = await rasterizeLeafletSvgOverlay(mapEl);
      if (svgOverlay) {
        ctx.drawImage(svgOverlay.img, svgOverlay.x, svgOverlay.y, svgOverlay.w, svgOverlay.h);
      }
      drawLeafletMarkersToCanvas(ctx, mapEl);
      await drawLeafletTooltipsToCanvas(ctx, mapEl);

      const fname = store.actif?.nom?.replace(/[^a-zA-Z0-9\u00c0-\u024f]/g, "_") || "newmark_comparables";
      const filename = `Newmark_${fname}_${new Date().toISOString().slice(0, 10)}.png`;

      if (!isBubbleView) {
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
        toastRef.current?.show("✓ Image exportée !");
      } else {
        toastRef.current?.show("Rendu des bulles…");
        const scene = document.querySelector<HTMLElement>("[data-bubble-scene]");
        if (!scene) throw new Error("Scène des bulles introuvable");

        const sceneRect = scene.getBoundingClientRect();
        const cropTop = Math.max(0, Math.round(mapRect.top - sceneRect.top));
        const exportWidth = Math.round(sceneRect.width);
        const exportHeight = Math.max(1, Math.round(sceneRect.height - cropTop));
        const cards = Array.from(scene.querySelectorAll<HTMLElement>("[data-bubble-card]"));
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
          bubbleCvs = renderComparablesBubbleOverlayCanvas({
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

        const outCvs = document.createElement("canvas");
        outCvs.width = exportWidth * S;
        outCvs.height = exportHeight * S;
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
          Math.round((mapRect.left - sceneRect.left) * S),
          0,
          Math.round(mapRect.width * S),
          Math.round(mapRect.height * S)
        );
        outCtx.drawImage(
          bubbleCvs,
          0,
          cropTop * S,
          exportWidth * S,
          exportHeight * S,
          0,
          0,
          exportWidth * S,
          exportHeight * S
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
        toastRef.current?.show("✓ Image exportée !");
      }
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
      console.error("Export error:", e);
    }
  }, [view, store.actif, store.comps]);

  const handleThemeChange = useCallback(() => {
    // Force re-render of markers by bumping fit trigger
    setFitTrigger((n) => n + 1);
  }, []);

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
      <TitleBar
        actif={store.actif}
        comps={store.comps}
        view={view}
        onViewChange={setView}
        themePickerSlot={<ThemePicker onThemeChange={handleThemeChange} />}
      />

      <div id="leaflet-map">
        <MapContainerWrapper
          actif={store.actif}
          comps={store.comps}
          fitTrigger={fitTrigger}
          onEditReference={handleEditRef}
          onEditComp={handleEditComp}
          onDeleteComp={handleDeleteComp}
          mapRef={mapRef}
        />
      </div>

      {view === "map" && (
        <>
          <Legend />
          <MapStateCard
            actif={store.actif}
            comps={store.comps}
            onOpenReference={handleEditRef}
            onOpenImport={() => setImportOpen(true)}
            onOpenComp={handleOpenComp}
          />
          <TransitControls mapRef={mapRef} view={view} />
        </>
      )}

      <ActionButtons
        view={view}
        onOpenReference={handleEditRef}
        onOpenImport={() => setImportOpen(true)}
        onOpenComp={handleOpenComp}
      />

      <BubbleScene
        view={view}
        actif={store.actif}
        comps={store.comps}
        mapRef={mapRef}
        onEditReference={handleEditRef}
        onEditComp={handleEditComp}
        onExportPNG={handleExportPNG}
      />

      <ReferenceForm
        open={refFormOpen}
        onClose={() => setRefFormOpen(false)}
        current={store.actif}
        onSave={handleSaveRef}
      />

      <ComparableForm
        open={compFormOpen}
        onClose={() => {
          setCompFormOpen(false);
          setCompEditIdx(-1);
        }}
        current={compEditIdx >= 0 ? store.comps[compEditIdx] : null}
        editIdx={compEditIdx}
        onSave={handleSaveComp}
      />

      <ImportPanel
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImportComplete={handleImportComplete}
      />

      <ExportToast ref={toastRef} />
    </AuthGuard>
  );
}
