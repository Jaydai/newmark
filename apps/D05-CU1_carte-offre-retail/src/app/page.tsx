"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import type { Map as LeafletMap } from "leaflet";
import { useMsal } from "@azure/msal-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import OrMapContainer from "@/components/map/or-map-container";
import ORTitleBar from "@/components/offre-retail/title-bar";
import ORSidebar from "@/components/offre-retail/sidebar";
import OrBubbleScene from "@/components/offre-retail/bubble-scene";
import OffreRetailForm from "@/components/offre-retail/offre-retail-form";
import DetailPanel from "@/components/offre-retail/detail-panel";
import AnalyticsPanel from "@/components/offre-retail/analytics-panel";
import GeocodeOverlay from "@/components/offre-retail/geocode-overlay";
import ImportDialog from "@/components/offre-retail/import-dialog";
import ThemePicker from "@/components/theme-picker";
import { ExportToast, ExportToastRef } from "@/components/export-toast";
import { useOffreRetailStore } from "@/hooks/use-offre-retail-store";
import { findAndDownloadFile } from "@/lib/graph-client";
import { parseOffreRetailBuffer } from "@/lib/parse-offre-retail-xlsx";
import {
  downloadCanvasAsPng,
  drawLeafletCanvasOverlayToCanvas,
  drawLeafletMarkersToCanvas,
  drawLeafletTooltipsToCanvas,
  rasterizeLeafletSvgOverlay,
  renderLeafletTilesToCanvas,
  waitForExportFonts,
} from "@/lib/leaflet-export";
import type { OffreRetail, ViewMode } from "@/lib/types";
import { hasCoords } from "@/lib/geocode";

const DEFAULT_FILE_NAME = "Retail - listing des transactions.xlsx";

export default function OffreRetailPage() {
  const store = useOffreRetailStore();
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  const [view, setView] = useState<ViewMode>("map");
  const [fitTrigger, setFitTrigger] = useState(1);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [geocodeOpen, setGeocodeOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<OffreRetail | null>(null);
  const [editItem, setEditItem] = useState<OffreRetail | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);
  const toastRef = useRef<ExportToastRef>(null);

  const sidebarW = view === "map" ? 320 : 0;
  const analyticsW = analyticsOpen ? 620 : 0;

  const ungeocodedCount = useMemo(() => {
    return store.filtered.filter((item) => !hasCoords(item.lat, item.lng)).length;
  }, [store.filtered]);

  const handleSelect = useCallback((item: OffreRetail) => {
    setSelectedItem(item);
    setDetailOpen(true);
  }, []);

  const handleEdit = useCallback(() => {
    setEditItem(selectedItem);
    setDetailOpen(false);
    setFormOpen(true);
  }, [selectedItem]);

  const handleDelete = useCallback(() => {
    if (!selectedItem) return;
    const name = selectedItem.enseigne || selectedItem.ref || "Offre";
    store.deleteItem(selectedItem.id);
    setDetailOpen(false);
    setSelectedItem(null);
    toastRef.current?.show(`${name} supprimé`);
  }, [selectedItem, store]);

  const handleAdd = useCallback(() => {
    setEditItem(null);
    setFormOpen(true);
  }, []);

  const handleSave = useCallback((item: Omit<OffreRetail, "id" | "visible">) => {
    store.addItem(item);
    setFitTrigger((n) => n + 1);
  }, [store]);

  const handleUpdate = useCallback((id: string, patch: Partial<OffreRetail>) => {
    store.updateItem(id, patch);
  }, [store]);

  const handleGeocoded = useCallback((id: string, lat: number, lng: number) => {
    store.updateGeoCache(id, lat, lng);
  }, [store]);

  const handleGeocode = useCallback(() => {
    setGeocoding(true);
    setGeocodeOpen(true);
  }, []);

  const handleImport = useCallback((items: OffreRetail[], spRef: { driveId: string; fileId: string; fileName: string }) => {
    store.setSpFileRef(spRef);
    const result = store.importItems(items);
    if (result.added > 0) setFitTrigger((n) => n + 1);
    if (result.added === 0 && result.ignored > 0) {
      toastRef.current?.show(`${result.ignored} déjà présentes`);
    } else if (result.ignored > 0) {
      toastRef.current?.show(`${result.added} importées, ${result.ignored} ignorées`);
    } else {
      toastRef.current?.show(`${result.added} offres importées`);
    }
    return result;
  }, [store]);

  const handleRefresh = useCallback(async () => {
    if (!account) return;
    await store.refresh(instance, account);
    setFitTrigger((n) => n + 1);
    if (!store.refreshError) {
      toastRef.current?.show("Données rafraîchies");
    } else {
      toastRef.current?.show("Erreur de rafraîchissement");
    }
  }, [store, instance, account]);

  const handleGeocodeClose = useCallback(() => {
    setGeocodeOpen(false);
    setGeocoding(false);
    setFitTrigger((n) => n + 1);
  }, []);

  useEffect(() => {
    if (store.items.length > 0) {
      setFitTrigger((n) => n + 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.items.length > 0]);

  // Auto-load default SharePoint file on first visit (no data yet)
  const autoLoadAttempted = useRef(false);
  const [autoLoading, setAutoLoading] = useState(false);

  useEffect(() => {
    if (autoLoadAttempted.current) return;
    if (!store.isInitialized) return;   // wait for localStorage hydration
    if (!account || !instance) return;
    if (store.items.length > 0) return; // already have data

    autoLoadAttempted.current = true;
    setAutoLoading(true);

    (async () => {
      try {
        const result = await findAndDownloadFile(instance, account, DEFAULT_FILE_NAME);
        if (!result) {
          console.warn("[AutoLoad] Fichier par défaut introuvable");
          return;
        }
        const parsed = await parseOffreRetailBuffer(result.buffer);
        if (parsed.length > 0) {
          store.setSpFileRef({
            driveId: result.driveId,
            fileId: result.fileId,
            fileName: result.fileName,
          });
          store.replaceImportedItems(parsed);
          setFitTrigger((n) => n + 1);
          toastRef.current?.show(`${parsed.length} offres chargées`);
        }
      } catch (e) {
        console.error("[AutoLoad] Échec du chargement par défaut :", e);
        toastRef.current?.show("Importez un fichier manuellement");
      } finally {
        setAutoLoading(false);
      }
    })();
  }, [store.isInitialized, account, instance, store]);

  const handleExportPNG = useCallback(async () => {
    const analyticsWasOpen = analyticsOpen;
    toastRef.current?.show("Préparation…");

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

      const filename = `Newmark_Offre_Retail_${new Date().toISOString().slice(0, 10)}.png`;
      await downloadCanvasAsPng(tileCanvas, filename);
      toastRef.current?.show("✓ Image exportée !");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur";
      toastRef.current?.show(`✕ ${message}`);
    } finally {
      if (analyticsWasOpen) {
        setAnalyticsOpen(true);
      }
    }
  }, [analyticsOpen]);

  return (
    <AuthGuard>
      <ORTitleBar
        view={view}
        onViewChange={setView}
        analyticsOpen={analyticsOpen}
        onToggleAnalytics={() => setAnalyticsOpen((p) => !p)}
        themePickerSlot={<ThemePicker />}
      />

      {store.refreshError && (
        <div
          className="fixed z-[980] px-3.5 py-2.5 rounded-[10px] text-xs font-semibold shadow-[0_8px_24px_rgba(0,0,0,.12)] bg-danger-bg text-danger"
          style={{
            top: "calc(var(--bar-h) + 12px)",
            left: `calc(${sidebarW}px + 16px)`,
            right: `${analyticsW + 96}px`,
          }}
        >
          {store.refreshError}
        </div>
      )}

      {view === "map" && (
        <ORSidebar
          items={store.items}
          filtered={store.filtered}
          addressCounts={store.addressCounts}
          addressFilters={store.addressFilters}
          onAddressToggle={store.toggleAddressFilter}
          onAddressFiltersClear={store.clearAddressFilters}
          onToggleVisible={store.toggleVisible}
          onShowAll={() => store.setAllVisible(true)}
          onHideAll={() => store.setAllVisible(false)}
          onSelect={handleSelect}
          onDelete={(id) => { store.deleteItem(id); toastRef.current?.show("Offre supprimée"); }}
          onAdd={handleAdd}
          onImport={() => setImportOpen(true)}
          onGeocode={handleGeocode}
          ungeocodedCount={ungeocodedCount}
          geocoding={geocoding}
          onRefresh={handleRefresh}
          isRefreshing={store.isRefreshing}
          lastUpdated={store.lastUpdated}
          hasSpFileRef={store.spFileRef != null}
        />
      )}

      {autoLoading && (
        <div
          className="fixed z-[990] flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-xs font-semibold bg-white shadow-[0_8px_24px_rgba(0,0,0,.12)]"
          style={{
            top: "calc(var(--bar-h) + 12px)",
            left: `calc(${sidebarW}px + 16px)`,
          }}
        >
          <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          Chargement des données…
        </div>
      )}

      <div id="leaflet-map">
        <OrMapContainer
          data={store.filtered}
          fitTrigger={fitTrigger}
          onSelect={handleSelect}
          mapRef={mapRef}
          sidebarWidth={sidebarW}
          analyticsWidth={analyticsW}
        />
      </div>

      <OrBubbleScene
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

      <OffreRetailForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditItem(null); }}
        current={editItem}
        onSave={handleSave}
        onUpdate={handleUpdate}
      />

      <DetailPanel
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedItem(null); }}
        item={selectedItem}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <GeocodeOverlay
        open={geocodeOpen}
        onClose={handleGeocodeClose}
        items={store.filtered}
        onGeocoded={handleGeocoded}
      />

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
        instance={instance}
        account={account ?? null}
      />

      <ExportToast ref={toastRef} />
    </AuthGuard>
  );
}
