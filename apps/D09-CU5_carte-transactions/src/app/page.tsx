"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import type { Map as LeafletMap } from "leaflet";
import { AuthGuard } from "@/components/auth/auth-guard";
import TxMapContainer from "@/components/map/tx-map-container";
import TxTitleBar from "@/components/transactions/title-bar";
import TxSidebar from "@/components/transactions/sidebar";
import TxBubbleScene from "@/components/transactions/bubble-scene";
import TransactionForm from "@/components/transactions/transaction-form";
import DetailPanel from "@/components/transactions/detail-panel";
import AnalyticsPanel from "@/components/transactions/analytics-panel";
import GeocodeOverlay from "@/components/transactions/geocode-overlay";
import ImportDialog from "@/components/transactions/import-dialog";
import ThemePicker from "@/components/theme-picker";
import { ExportToast, ExportToastRef } from "@/components/export-toast";
import { useTransactionsStore } from "@/hooks/use-transactions-store";
import {
  getTransactionsForBubbleExport,
  renderTransactionsBubbleOverlayCanvas,
  waitForExportFonts,
} from "@/lib/bubble-export";
import {
  downloadCanvasAsPng,
  drawLeafletCanvasOverlayToCanvas,
  drawLeafletMarkersToCanvas,
  drawLeafletTooltipsToCanvas,
  rasterizeLeafletSvgOverlay,
  renderLeafletTilesToCanvas,
} from "@/lib/leaflet-export";
import type { Transaction, ViewMode } from "@/lib/types";
import { hasCoords } from "@/lib/geocode";

export default function TransactionsPage() {
  const store = useTransactionsStore();
  const [view, setView] = useState<ViewMode>("map");
  const [fitTrigger, setFitTrigger] = useState(1);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [geocodeOpen, setGeocodeOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);
  const toastRef = useRef<ExportToastRef>(null);
  const lastHashRef = useRef("");
  const exportCheckRanRef = useRef(false);

  const sidebarW = view === "map" ? 320 : 0;
  const analyticsW = analyticsOpen ? 620 : 0;

  const ungeocodedCount = useMemo(() => {
    return store.filtered.filter((tx) => !hasCoords(tx.lat, tx.lng)).length;
  }, [store.filtered]);

  const handleSelect = useCallback((tx: Transaction) => {
    setSelectedTx(tx);
    setDetailOpen(true);
  }, []);

  const handleEdit = useCallback(() => {
    setEditTx(selectedTx);
    setDetailOpen(false);
    setFormOpen(true);
  }, [selectedTx]);

  const handleDelete = useCallback(() => {
    if (!selectedTx) return;
    const name = selectedTx.newTenant || selectedTx.enseigne || "Transaction";
    store.deleteTransaction(selectedTx.id);
    setDetailOpen(false);
    setSelectedTx(null);
    toastRef.current?.show(`${name} supprimé`);
  }, [selectedTx, store]);

  const handleAdd = useCallback(() => {
    setEditTx(null);
    setFormOpen(true);
  }, []);

  const handleSave = useCallback((tx: Omit<Transaction, "id" | "visible">) => {
    store.addTransaction(tx);
    setFitTrigger((n) => n + 1);
  }, [store]);

  const handleUpdate = useCallback((id: string, patch: Partial<Transaction>) => {
    store.updateTransaction(id, patch);
  }, [store]);

  const handleGeocoded = useCallback((id: string, lat: number, lng: number) => {
    store.updateGeoCache(id, lat, lng);
  }, [store]);

  const handleGeocode = useCallback(() => {
    setGeocoding(true);
    setGeocodeOpen(true);
  }, []);

  const handleImport = useCallback((txs: Transaction[]) => {
    const result = store.importTransactions(txs);
    if (result.added > 0) setFitTrigger((n) => n + 1);
    if (result.added === 0 && result.ignored > 0) {
      toastRef.current?.show(`${result.ignored} déjà présentes`);
    } else if (result.ignored > 0) {
      toastRef.current?.show(`${result.added} importées, ${result.ignored} ignorées`);
    } else {
      toastRef.current?.show(`${result.added} transactions importées`);
    }
    return result;
  }, [store]);

  const handleGeocodeClose = useCallback(() => {
    setGeocodeOpen(false);
    setGeocoding(false);
    setFitTrigger((n) => n + 1);
  }, []);

  const handleYearFrom = useCallback((v: string) => {
    store.setYearFrom(v);
    if (v && store.yearTo && Number(v) > Number(store.yearTo)) store.setYearTo(v);
  }, [store]);

  const handleYearTo = useCallback((v: string) => {
    store.setYearTo(v);
    if (v && store.yearFrom && Number(v) < Number(store.yearFrom)) store.setYearFrom(v);
  }, [store]);

  useEffect(() => {
    if (!store.hash || store.hash === lastHashRef.current) return;
    lastHashRef.current = store.hash;
    setFitTrigger((n) => n + 1);
  }, [store.hash]);

  const handleExportPNG = useCallback(async () => {
    const analyticsWasOpen = analyticsOpen;
    const isExportCheck =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("__codex_export_check") === "1";

    toastRef.current?.show("Préparation…");
    if (typeof document !== "undefined") {
      document.body.dataset.exportStatus = "running";
      delete document.body.dataset.exportMessage;
    }

    try {
      if (analyticsWasOpen) {
        setAnalyticsOpen(false);
        await new Promise((resolve) => window.setTimeout(resolve, 420));
      }

      const mapEl = document.querySelector<HTMLElement>("#leaflet-map .leaflet-container");
      if (!mapEl) throw new Error("Carte introuvable");

      toastRef.current?.show("Rendu des tuiles…");
      await waitForExportFonts();
      const tileCanvas = await renderLeafletTilesToCanvas(mapEl, 2);
      const tileCtx = tileCanvas.getContext("2d");
      if (!tileCtx) throw new Error("Canvas introuvable");

      const svgOverlay = await rasterizeLeafletSvgOverlay(mapEl);
      if (svgOverlay) {
        tileCtx.drawImage(svgOverlay.img, svgOverlay.x, svgOverlay.y, svgOverlay.w, svgOverlay.h);
      }
      drawLeafletCanvasOverlayToCanvas(tileCtx, mapEl);
      drawLeafletMarkersToCanvas(tileCtx, mapEl);
      await drawLeafletTooltipsToCanvas(tileCtx, mapEl);

      const mapRect = mapEl.getBoundingClientRect();
      const S = 2;
      const filename = `Newmark_Transactions_${new Date().toISOString().slice(0, 10)}.png`;

      if (view === "bubbles") {
        toastRef.current?.show("Rendu des bulles…");
        const scene = document.querySelector<HTMLElement>("[data-tx-bubble-scene]");
        if (!scene) throw new Error("Scène des bulles introuvable");
        const map = mapRef.current;
        if (!map) throw new Error("Carte introuvable");

        const sceneRect = scene.getBoundingClientRect();
        const exportWidth = Math.round(sceneRect.width);
        const exportHeight = Math.round(sceneRect.height);
        const cards = Array.from(scene.querySelectorAll<HTMLElement>("[data-tx-bubble-card]"));
        const cardState = cards.map((card) => ({
          animation: card.style.animation,
          opacity: card.style.opacity,
        }));

        cards.forEach((card) => {
          card.style.animation = "none";
          card.style.opacity = "1";
        });

        let bubbleCanvas: HTMLCanvasElement;
        try {
          await new Promise((resolve) => window.setTimeout(resolve, 50));
          const { shown, total } = getTransactionsForBubbleExport(store.filtered, map);
          bubbleCanvas = renderTransactionsBubbleOverlayCanvas({
            scene,
            transactions: shown,
            overflowCount: Math.max(0, total - shown.length),
            scale: S,
          });
        } finally {
          cards.forEach((card, index) => {
            card.style.animation = cardState[index].animation;
            card.style.opacity = cardState[index].opacity;
          });
        }

        const bubbleOutput = document.createElement("canvas");
        bubbleOutput.width = exportWidth * S;
        bubbleOutput.height = exportHeight * S;
        const bubbleOutputCtx = bubbleOutput.getContext("2d");
        if (!bubbleOutputCtx) throw new Error("Export bulles impossible");

        bubbleOutputCtx.fillStyle = "#ffffff";
        bubbleOutputCtx.fillRect(0, 0, bubbleOutput.width, bubbleOutput.height);
        bubbleOutputCtx.drawImage(
          tileCanvas,
          Math.max(0, Math.round((sceneRect.left - mapRect.left) * S)),
          Math.max(0, Math.round((sceneRect.top - mapRect.top) * S)),
          exportWidth * S,
          exportHeight * S,
          0,
          0,
          exportWidth * S,
          exportHeight * S
        );
        bubbleOutputCtx.drawImage(bubbleCanvas, 0, 0);

        if (!isExportCheck) {
          await downloadCanvasAsPng(bubbleOutput, filename);
        }
      } else {
        if (!isExportCheck) {
          await downloadCanvasAsPng(tileCanvas, filename);
        }
      }

      toastRef.current?.show("✓ Image exportée !");
      if (typeof document !== "undefined") {
        document.body.dataset.exportStatus = "ok";
        document.body.dataset.exportFilename = filename;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur";
      toastRef.current?.show(`✕ ${message}`);
      if (typeof document !== "undefined") {
        document.body.dataset.exportStatus = "error";
        document.body.dataset.exportMessage = message;
      }
    } finally {
      if (analyticsWasOpen) {
        setAnalyticsOpen(true);
      }
    }
  }, [analyticsOpen, store.filtered, view]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("__codex_export_check") !== "1") return;
    if (exportCheckRanRef.current) return;
    if (view !== "bubbles") {
      setView("bubbles");
      return;
    }

    const mapEl = document.querySelector<HTMLElement>("#leaflet-map .leaflet-container");
    const scene = document.querySelector<HTMLElement>("[data-tx-bubble-scene]");
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
        const radius = Number(circle.getAttribute("r") || "0");
        return fill && fill !== "none" && radius <= 5;
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
      Math.abs(sceneRect.top - mapRect.top) <= 1 &&
      Math.abs(sceneRect.right - mapRect.right) <= 1 &&
      Math.abs(sceneRect.bottom - mapRect.bottom) <= 1 &&
      dotDistances.every((value) => value <= 2.5);

    document.body.dataset.alignmentOk = alignmentOk ? "1" : "0";
    document.body.dataset.alignmentMaxDotDistance = dotDistances.length
      ? Math.max(...dotDistances).toFixed(2)
      : "";

    exportCheckRanRef.current = true;
    window.setTimeout(() => {
      void handleExportPNG();
    }, 1200);
  }, [handleExportPNG, view]);

  return (
    <AuthGuard>
      <TxTitleBar
        view={view}
        onViewChange={setView}
        yearFrom={store.yearFrom}
        yearTo={store.yearTo}
        onYearFromChange={handleYearFrom}
        onYearToChange={handleYearTo}
        allYears={store.allYears}
        analyticsOpen={analyticsOpen}
        onToggleAnalytics={() => setAnalyticsOpen((p) => !p)}
        themePickerSlot={<ThemePicker />}
      />

      {view === "map" && (
        <TxSidebar
          transactions={store.transactions}
          filtered={store.filtered}
          streetCounts={store.streetCounts}
          streetFilters={store.streetFilters}
          onStreetToggle={store.toggleStreetFilter}
          onStreetFiltersClear={store.clearStreetFilters}
          onToggleVisible={store.toggleVisible}
          onShowAll={() => store.setAllVisible(true)}
          onHideAll={() => store.setAllVisible(false)}
          onSelect={handleSelect}
          onDelete={(id) => { store.deleteTransaction(id); toastRef.current?.show("Transaction supprimée"); }}
          onAdd={handleAdd}
          onImport={() => setImportOpen(true)}
          onGeocode={handleGeocode}
          ungeocodedCount={ungeocodedCount}
          geocoding={geocoding}
        />
      )}

      <div id="leaflet-map">
        <TxMapContainer
          data={store.filtered}
          fitTrigger={fitTrigger}
          onSelect={handleSelect}
          mapRef={mapRef}
          sidebarWidth={sidebarW}
          analyticsWidth={analyticsW}
        />
      </div>

      <TxBubbleScene
        active={view === "bubbles"}
        visible={view === "bubbles"}
        data={store.filtered}
        mapRef={mapRef}
        onSelect={handleSelect}
        sidebarWidth={sidebarW}
        analyticsWidth={analyticsW}
      />

      <button
        data-export-button
        onClick={handleExportPNG}
        className="fixed z-[900] px-5 py-2.5 border-none rounded-[10px] text-xs font-bold cursor-pointer bg-primary text-white shadow-[0_4px_20px_rgba(0,0,0,.15)] hover:-translate-y-0.5 transition-all"
        style={{
          top: "calc(var(--bar-h) + 12px)",
          right: `${analyticsW + 20}px`,
        }}
      >
        📷 Exporter en PNG
      </button>

      <AnalyticsPanel
        open={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        data={store.filtered}
      />

      <TransactionForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTx(null); }}
        current={editTx}
        onSave={handleSave}
        onUpdate={handleUpdate}
      />

      <DetailPanel
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedTx(null); }}
        tx={selectedTx}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <GeocodeOverlay
        open={geocodeOpen}
        onClose={handleGeocodeClose}
        transactions={store.filtered}
        onGeocoded={handleGeocoded}
      />

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
      />

      <ExportToast ref={toastRef} />
    </AuthGuard>
  );
}
