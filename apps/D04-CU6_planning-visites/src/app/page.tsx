"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Map as LeafletMap } from "leaflet";
import { AuthGuard } from "@/components/auth/auth-guard";
import type { RouteSegment, Visit, ViewMode } from "@/lib/types";
import { reverseGeocode } from "@/lib/geocode";
import { useVisitsStore } from "@/hooks/use-visits-store";
import TitleBar from "@/components/title-bar";
import Sidebar from "@/components/sidebar";
import MapContainerWrapper from "@/components/map/map-container";
import VisitForm from "@/components/visit-form";
import ThemePicker from "@/components/theme-picker";
import TransitControls from "@/components/transit-controls";
import BubbleScene from "@/components/bubble-scene";
import { ExportToast, ExportToastRef } from "@/components/export-toast";
import ImportDialog from "@/components/import-dialog";
import {
  downloadCanvasAsPng,
  drawLeafletCanvasOverlayToCanvas,
  drawLeafletMarkersToCanvas,
  drawLeafletTooltipsToCanvas,
  rasterizeLeafletSvgOverlay,
  renderLeafletTilesToCanvas,
} from "@/lib/leaflet-export";
import { formatDuration } from "@/lib/time-utils";

interface ExportTheme {
  background: string;
  border: string;
  borderInput: string;
  surfaceAlt: string;
  primary: string;
  textSecondary: string;
  textTertiary: string;
  textFaint: string;
  mapGreen: string;
  mapGreen10: string;
  mapBlue: string;
  mapBlue08: string;
  mapBlueHover: string;
}

interface SidebarExportMetrics {
  labelX: number;
  labelY: number;
  labelText: string;
  labelColor: string;
  labelFont: string;
  labelLetterSpacing: number;
  labelTransform: string;
  inputX: number;
  inputY: number;
  inputWidth: number;
  inputHeight: number;
  inputBorderRadius: number;
  inputBorderWidth: number;
  inputBorderColor: string;
  inputBackground: string;
  inputColor: string;
  inputFont: string;
}

function createScaledCanvas(width: number, height: number, scale: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas export indisponible");
  ctx.scale(scale, scale);
  return { canvas, ctx };
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
  lineWidth = 1
) {
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function parsePx(value: string | null | undefined, fallback = 0): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildCanvasFont(styles: CSSStyleDeclaration): string {
  const fontStyle = styles.fontStyle || "normal";
  const fontWeight = styles.fontWeight || "400";
  const fontSize = styles.fontSize || "12px";
  const fontFamily = styles.fontFamily || '"DM Sans", system-ui, sans-serif';
  return `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`;
}

function applyTextTransform(text: string, textTransform: string) {
  switch (textTransform) {
    case "uppercase":
      return text.toLocaleUpperCase("fr-FR");
    case "lowercase":
      return text.toLocaleLowerCase("fr-FR");
    case "capitalize":
      return text.replace(/\b(\p{L})/gu, (match) => match.toLocaleUpperCase("fr-FR"));
    default:
      return text;
  }
}

function drawLetterSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing = 0
) {
  let cursorX = x;
  for (const char of text) {
    ctx.fillText(char, cursorX, y);
    cursorX += ctx.measureText(char).width + letterSpacing;
  }
}

function ellipsizeText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}…`;
}

function drawTextLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  align: CanvasTextAlign = "left"
) {
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  const rendered = ellipsizeText(ctx, text, maxWidth);
  ctx.fillText(rendered, x, y);
}

function drawCenteredTextLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  maxWidth: number
) {
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const rendered = ellipsizeText(ctx, text, maxWidth);
  ctx.fillText(rendered, centerX, y);
}

function parseDashArray(value: string) {
  if (!value || value === "none") return [];
  return value
    .split(/[ ,]+/)
    .map((part) => Number.parseFloat(part))
    .filter((part) => Number.isFinite(part) && part > 0);
}

function getCssVar(styles: CSSStyleDeclaration, name: string, fallback: string) {
  const value = styles.getPropertyValue(name).trim();
  return value || fallback;
}

function getExportTheme(): ExportTheme {
  const styles = getComputedStyle(document.documentElement);
  return {
    background: getCssVar(styles, "--background", "#ffffff"),
    border: getCssVar(styles, "--border", "#e5e5e5"),
    borderInput: getCssVar(styles, "--border-input", "#dde1e8"),
    surfaceAlt: getCssVar(styles, "--surface-alt", "#f0f2f5"),
    primary: getCssVar(styles, "--primary", "#1a1a1a"),
    textSecondary: getCssVar(styles, "--text-secondary", "#6b7689"),
    textTertiary: getCssVar(styles, "--text-tertiary", "#8590a5"),
    textFaint: getCssVar(styles, "--text-faint", "#aab2c0"),
    mapGreen: getCssVar(styles, "--map-green", "#2d8c5a"),
    mapGreen10: getCssVar(styles, "--map-green-10", "rgba(45, 140, 90, 0.1)"),
    mapBlue: getCssVar(styles, "--map-blue", "#0062ae"),
    mapBlue08: getCssVar(styles, "--map-blue-08", "rgba(0, 98, 174, 0.08)"),
    mapBlueHover: getCssVar(styles, "--map-blue-hover", "#004d8a"),
  };
}

function readSidebarExportMetrics(sidebarEl: HTMLElement | null): SidebarExportMetrics | null {
  if (!sidebarEl) return null;

  const label = sidebarEl.querySelector("label");
  const input = sidebarEl.querySelector<HTMLInputElement>('input[type="time"]');
  if (!(label instanceof HTMLElement) || !(input instanceof HTMLElement)) return null;

  const sidebarRect = sidebarEl.getBoundingClientRect();
  const labelRect = label.getBoundingClientRect();
  const inputRect = input.getBoundingClientRect();
  const labelStyles = getComputedStyle(label);
  const inputStyles = getComputedStyle(input);

  return {
    labelX: labelRect.left - sidebarRect.left,
    labelY: labelRect.top - sidebarRect.top,
    labelText: label.textContent?.trim() ?? "Départ",
    labelColor: labelStyles.color || "#6b7689",
    labelFont: buildCanvasFont(labelStyles),
    labelLetterSpacing: parsePx(labelStyles.letterSpacing),
    labelTransform: labelStyles.textTransform || "none",
    inputX: inputRect.left - sidebarRect.left,
    inputY: inputRect.top - sidebarRect.top,
    inputWidth: inputRect.width,
    inputHeight: inputRect.height,
    inputBorderRadius: parsePx(inputStyles.borderTopLeftRadius, 5),
    inputBorderWidth: parsePx(inputStyles.borderTopWidth, 1.5),
    inputBorderColor: inputStyles.borderTopColor || "#dde1e8",
    inputBackground: inputStyles.backgroundColor || "#ffffff",
    inputColor: inputStyles.color || "#1a1a1a",
    inputFont: buildCanvasFont(inputStyles),
  };
}

function renderSidebarExportCanvas({
  visits,
  routes,
  startTime,
  routesPending,
  theme,
  sidebarMetrics,
  width,
  height,
  scale,
}: {
  visits: Visit[];
  routes: (RouteSegment | null)[];
  startTime: string;
  routesPending: boolean;
  theme: ExportTheme;
  sidebarMetrics?: SidebarExportMetrics | null;
  width: number;
  height: number;
  scale: number;
}) {
  const { canvas, ctx } = createScaledCanvas(width, height, scale);
  const totalVisitMin = visits.reduce((sum, visit) => sum + visit.duration, 0);
  const totalTravelMin = routes.reduce((sum, route) => sum + (route ? route.duration : 0), 0);

  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = theme.border;
  ctx.fillRect(width - 1, 0, 1, height);

  const sidebarPaddingX = 14;
  let y = 10;

  if (sidebarMetrics) {
    const labelText = applyTextTransform(sidebarMetrics.labelText, sidebarMetrics.labelTransform);
    ctx.fillStyle = sidebarMetrics.labelColor;
    ctx.font = sidebarMetrics.labelFont;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    drawLetterSpacedText(
      ctx,
      labelText,
      sidebarMetrics.labelX,
      sidebarMetrics.labelY,
      sidebarMetrics.labelLetterSpacing
    );

    fillRoundedRect(
      ctx,
      sidebarMetrics.inputX,
      sidebarMetrics.inputY,
      sidebarMetrics.inputWidth,
      sidebarMetrics.inputHeight,
      sidebarMetrics.inputBorderRadius,
      sidebarMetrics.inputBackground,
      sidebarMetrics.inputBorderColor,
      sidebarMetrics.inputBorderWidth
    );
    ctx.fillStyle = sidebarMetrics.inputColor;
    ctx.font = sidebarMetrics.inputFont;
    drawTextLine(
      ctx,
      startTime || "--:--",
      sidebarMetrics.inputX + 6,
      sidebarMetrics.inputY + 4,
      Math.max(0, sidebarMetrics.inputWidth - 12)
    );

    y = Math.round(Math.max(sidebarMetrics.labelY + 10, sidebarMetrics.inputY + sidebarMetrics.inputHeight) + 12);
  } else {
    ctx.fillStyle = theme.textSecondary;
    ctx.font = '600 9px "DM Sans", system-ui, sans-serif';
    drawLetterSpacedText(ctx, "DÉPART", sidebarPaddingX, y + 1, 0.8);

    ctx.font = '600 11px "DM Sans", system-ui, sans-serif';
    const timeX = sidebarPaddingX + 45;
    fillRoundedRect(ctx, timeX, y, 50, 22, 5, theme.background, theme.borderInput, 1.5);
    ctx.fillStyle = theme.primary;
    drawTextLine(ctx, startTime || "--:--", timeX + 6, y + 5, 40);

    y += 34;
  }
  if (visits.length > 0) {
    const kpis = [
      { label: "VISITES", value: String(visits.length) },
      { label: "SUR PLACE", value: formatDuration(totalVisitMin) },
      { label: "TRAJET", value: formatDuration(totalTravelMin) },
    ];
    let kpiX = sidebarPaddingX;
    for (const kpi of kpis) {
      fillRoundedRect(ctx, kpiX, y, 68, 40, 8, theme.surfaceAlt, theme.border);
      ctx.fillStyle = theme.textTertiary;
      ctx.font = '700 7px "DM Sans", system-ui, sans-serif';
      drawTextLine(ctx, kpi.label, kpiX + 8, y + 8, 52);
      ctx.fillStyle = theme.primary;
      ctx.font = '700 11px "DM Sans", system-ui, sans-serif';
      drawTextLine(ctx, kpi.value, kpiX + 8, y + 19, 52);
      kpiX += 74;
    }
    y += 52;
  }

  ctx.fillStyle = theme.border;
  ctx.fillRect(0, y, width, 1);
  y += 12;

  if (!visits.length) {
    ctx.fillStyle = theme.textFaint;
    ctx.font = '400 11px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Aucune visite.", width / 2, y + 18);
    ctx.fillText("Cliquez sur la carte ou utilisez le bouton + pour ajouter des points.", width / 2, y + 34);
    return canvas;
  }

  const cardX = sidebarPaddingX;
  const cardWidth = width - sidebarPaddingX * 2;
  const cardHeight = 78;
  const routeHeight = 30;
  const routeBadgeX = cardX + 28;
  const routeLineX = cardX + 18;

  visits.forEach((visit, index) => {
    fillRoundedRect(ctx, cardX, y, cardWidth, cardHeight, 8, theme.background, theme.border, 1.5);

    ctx.fillStyle = theme.mapGreen;
    ctx.beginPath();
    ctx.arc(cardX + 24, y + 24, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = '700 11px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(index + 1), cardX + 24, y + 24);

    const infoX = cardX + 44;
    const actionX = cardX + cardWidth - 48;
    ctx.fillStyle = theme.primary;
    ctx.font = '700 12px "DM Sans", system-ui, sans-serif';
    drawTextLine(ctx, visit.name, infoX, y + 12, actionX - infoX - 6, "left");

    ctx.fillStyle = theme.textTertiary;
    ctx.font = '400 10px "DM Sans", system-ui, sans-serif';
    drawTextLine(ctx, visit.address, infoX, y + 28, actionX - infoX - 6, "left");

    ctx.fillStyle = "#cccccc";
    ctx.font = '600 12px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("▲", actionX, y + 11);
    ctx.fillText("▼", actionX + 16, y + 11);
    ctx.font = '400 16px "DM Sans", system-ui, sans-serif';
    ctx.fillText("×", actionX + 32, y + 8);

    const chipsY = y + 48;
    let chipX = infoX;
    const drawChip = (text: string, bg: string, color: string, minWidth = 0) => {
      ctx.font = '600 9px "DM Sans", system-ui, sans-serif';
      const textWidth = Math.ceil(ctx.measureText(text).width);
      const chipWidth = Math.max(minWidth, textWidth + 16);
      fillRoundedRect(ctx, chipX, chipsY, chipWidth, 18, 6, bg);
      ctx.fillStyle = color;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(text, chipX + 8, chipsY + 5);
      chipX += chipWidth + 6;
    };

    if (visit.arrival) drawChip(visit.arrival, theme.mapGreen10, theme.mapGreen);
    if (visit.departure) drawChip(visit.departure, theme.mapBlue08, theme.mapBlue);
    drawChip(`${visit.duration} min`, theme.surfaceAlt, theme.textSecondary, 50);

    y += cardHeight;
    if (index < visits.length - 1) {
      ctx.strokeStyle = "rgba(0,0,0,.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(routeLineX, y - 2);
      ctx.lineTo(routeLineX, y + routeHeight - 6);
      ctx.stroke();

      const route = routes[index];
      const routeText = routesPending && !route
        ? "Calcul…"
        : route
          ? `↓ ${route.duration} min · ${route.distance} km`
          : "↓ ---";
      const routeBg = route ? theme.mapBlue08 : theme.surfaceAlt;
      const routeBorder = route ? theme.mapBlue08 : theme.border;
      const routeColor = route ? theme.mapBlueHover : routesPending ? "#bbbbbb" : theme.textSecondary;
      ctx.font = '700 8.5px "DM Sans", system-ui, sans-serif';
      const routeWidth = Math.ceil(ctx.measureText(routeText).width) + 18;
      fillRoundedRect(ctx, routeBadgeX, y + 4, routeWidth, 18, 9, routeBg, routeBorder);
      ctx.fillStyle = routeColor;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(routeText, routeBadgeX + 9, y + 9);
      y += routeHeight;
    }
    y += 8;
  });

  return canvas;
}

function renderBubbleOverlayCanvas({
  scene,
  visits,
  theme,
  scale,
}: {
  scene: HTMLElement;
  visits: Visit[];
  theme: ExportTheme;
  scale: number;
}) {
  const sceneRect = scene.getBoundingClientRect();
  const width = Math.round(sceneRect.width);
  const height = Math.round(sceneRect.height);
  const { canvas, ctx } = createScaledCanvas(width, height, scale);

  const svgEl = scene.querySelector<SVGSVGElement>("svg");
  if (svgEl) {
    svgEl.querySelectorAll<SVGLineElement>("line").forEach((line) => {
      const style = getComputedStyle(line);
      const x1 = Number.parseFloat(line.getAttribute("x1") ?? "0");
      const y1 = Number.parseFloat(line.getAttribute("y1") ?? "0");
      const x2 = Number.parseFloat(line.getAttribute("x2") ?? "0");
      const y2 = Number.parseFloat(line.getAttribute("y2") ?? "0");
      ctx.save();
      ctx.strokeStyle = style.stroke || "#000000";
      ctx.lineWidth = Number.parseFloat(style.strokeWidth || "1");
      ctx.setLineDash(parseDashArray(style.strokeDasharray));
      ctx.lineCap = style.strokeLinecap as CanvasLineCap;
      ctx.globalAlpha = Number.parseFloat(style.opacity || "1") || 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    });

    svgEl.querySelectorAll<SVGCircleElement>("circle").forEach((circle) => {
      const style = getComputedStyle(circle);
      const x = Number.parseFloat(circle.getAttribute("cx") ?? "0");
      const y = Number.parseFloat(circle.getAttribute("cy") ?? "0");
      const r = Number.parseFloat(circle.getAttribute("r") ?? "0");
      ctx.save();
      ctx.globalAlpha = Number.parseFloat(style.opacity || "1") || 1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      if (style.fill && style.fill !== "none") {
        ctx.fillStyle = style.fill;
        ctx.fill();
      }
      if (style.stroke && style.stroke !== "none") {
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = Number.parseFloat(style.strokeWidth || "1");
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  const bubbleCards = Array.from(scene.querySelectorAll<HTMLElement>("[data-bubble-card]"));
  bubbleCards.forEach((card, index) => {
    const visit = visits[index];
    if (!visit) return;
    const rect = card.getBoundingClientRect();
    const x = rect.left - sceneRect.left;
    const y = rect.top - sceneRect.top;
    const w = rect.width;
    const h = rect.height;
    const centerX = x + w / 2;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.12)";
    ctx.shadowBlur = 28;
    fillRoundedRect(ctx, x, y, w, h, 8, theme.background, theme.mapGreen, 2);
    ctx.restore();

    ctx.fillStyle = theme.mapGreen;
    ctx.beginPath();
    ctx.arc(centerX, y + 21, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = '700 10px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(index + 1), centerX, y + 21);

    ctx.fillStyle = theme.primary;
    ctx.font = '700 12px "DM Sans", system-ui, sans-serif';
    drawCenteredTextLine(ctx, visit.name, centerX, y + 39, w - 28);

    ctx.fillStyle = theme.textTertiary;
    ctx.font = '400 8px "DM Sans", system-ui, sans-serif';
    drawCenteredTextLine(ctx, visit.address, centerX, y + 56, w - 36);

    const pills: Array<{ text: string; bg: string; color: string }> = [];
    if (visit.arrival) pills.push({ text: visit.arrival, bg: theme.mapGreen10, color: theme.mapGreen });
    if (visit.departure) pills.push({ text: visit.departure, bg: theme.mapBlue08, color: theme.mapBlue });

    ctx.font = '600 9px "DM Sans", system-ui, sans-serif';
    const pillWidths = pills.map((pill) => Math.ceil(ctx.measureText(pill.text).width) + 16);
    const totalPillWidth = pillWidths.reduce((sum, pillWidth) => sum + pillWidth, 0) + Math.max(0, pills.length - 1) * 6;
    let pillX = centerX - totalPillWidth / 2;
    pills.forEach((pill, pillIndex) => {
      const pillWidth = pillWidths[pillIndex];
      fillRoundedRect(ctx, pillX, y + 79, pillWidth, 17, 5, pill.bg);
      ctx.fillStyle = pill.color;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(pill.text, pillX + 8, y + 84);
      pillX += pillWidth + 6;
    });

    ctx.fillStyle = theme.textTertiary;
    ctx.font = '400 8px "DM Sans", system-ui, sans-serif';
    drawCenteredTextLine(ctx, `${visit.duration} min de visite`, centerX, y + h - 20, w - 24);
  });

  ctx.fillStyle = "rgba(0,0,0,.06)";
  ctx.font = '600 14px "DM Sans", system-ui, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("NEWMARK", width / 2, height - 36);
  ctx.fillStyle = "rgba(0,0,0,.04)";
  ctx.font = '400 8px "DM Sans", system-ui, sans-serif';
  ctx.fillText("PLANNING DE VISITES", width / 2, height - 18);

  return canvas;
}

async function waitForFontsForExport() {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.all([
      document.fonts.load('400 8px "DM Sans"'),
      document.fonts.load('400 10px "DM Sans"'),
      document.fonts.load('600 9px "DM Sans"'),
      document.fonts.load('600 11px "DM Sans"'),
      document.fonts.load('700 8px "DM Sans"'),
      document.fonts.load('700 10px "DM Sans"'),
      document.fonts.load('700 12px "DM Sans"'),
    ]);
    await document.fonts.ready;
  } catch {
    // Continue even if the browser cannot expose font readiness.
  }
}

export default function Home() {
  const store = useVisitsStore();
  const mapRef = useRef<LeafletMap | null>(null);
  const toastRef = useRef<ExportToastRef>(null);
  const exportCheckRanRef = useRef(false);
  const exportStateRef = useRef({
    visits: store.visits,
    routes: store.routes,
    startTime: store.startTime,
    routesPending: store.routesPending,
  });

  const [view, setView] = useState<ViewMode>("map");
  const [themeVersion, setThemeVersion] = useState(0);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editIdx, setEditIdx] = useState(-1);
  const [geocoding, setGeocoding] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingMapClick, setPendingMapClick] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);

  useEffect(() => {
    exportStateRef.current = {
      visits: store.visits,
      routes: store.routes,
      startTime: store.startTime,
      routesPending: store.routesPending,
    };
  }, [store.routes, store.routesPending, store.startTime, store.visits]);

  // Fit all when first loaded
  useEffect(() => {
    if (store.visits.length > 0) {
      const timer = setTimeout(() => setFitTrigger((t) => t + 1), 800);
      return () => clearTimeout(timer);
    }
  }, [store.visits.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewChange = useCallback(
    (v: ViewMode) => {
      setView(v);
      if (v === "bubbles") {
        setFitTrigger((t) => t + 1);
        setTimeout(() => mapRef.current?.invalidateSize(), 450);
      } else {
        setTimeout(() => mapRef.current?.invalidateSize(), 400);
      }
    },
    []
  );

  const openAddForm = useCallback(() => {
    setEditIdx(-1);
    setPendingMapClick(null);
    setPanelOpen(true);
  }, []);

  const openEditForm = useCallback((idx: number) => {
    setEditIdx(idx);
    setPendingMapClick(null);
    setPanelOpen(true);
  }, []);

  const handleSave = useCallback(
    (visit: Visit) => {
      if (editIdx >= 0) {
        store.updateVisit(editIdx, visit);
      } else {
        store.addVisit(visit);
        setFitTrigger((t) => t + 1);
      }
      setPanelOpen(false);
      setEditIdx(-1);
    },
    [editIdx, store]
  );

  const handleDelete = useCallback(
    (idx: number) => {
      const removed = store.deleteVisit(idx);
      toastRef.current?.showUndo(`${removed.name} supprimé`, () => {
        store.undoDelete(idx, removed);
      });
    },
    [store]
  );

  const handleImport = useCallback(
    (visits: import("@/lib/types").Visit[]) => {
      visits.forEach((v) => store.addVisit(v));
      setFitTrigger((t) => t + 1);
    },
    [store]
  );

  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      if (view !== "map") return;

      setGeocoding(true);
      let addr: string | null = null;
      try {
        addr = await reverseGeocode(lat, lng);
      } catch { /* ignore */ } finally {
        setGeocoding(false);
      }

      const shortAddr = addr
        ? addr.split(",").slice(0, 3).join(",").trim()
        : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

      // Add visit and open edit form
      const newVisit: Visit = {
        name: `Visite ${store.visits.length + 1}`,
        address: shortAddr,
        lat,
        lng,
        duration: 30,
      };
      store.addVisit(newVisit);
      setFitTrigger((t) => t + 1);

      // Open edit form for the newly added visit
      setEditIdx(store.visits.length); // will be the last item
      setPendingMapClick({ lat, lng, address: shortAddr });
      setPanelOpen(true);
    },
    [view, store]
  );

  const waitForExportData = useCallback(async () => {
    const isReady = (state: typeof exportStateRef.current) => {
      const expectedRoutes = Math.max(state.visits.length - 1, 0);
      const visitsReady =
        state.visits.length === 0 || state.visits.every((visit) => visit.lat != null && visit.lng != null);
      return !state.routesPending && state.routes.length >= expectedRoutes && visitsReady;
    };

    const started = Date.now();
    while (Date.now() - started < 5000) {
      const snapshot = exportStateRef.current;
      if (isReady(snapshot)) return snapshot;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    return exportStateRef.current;
  }, []);

  const handleExportPNG = useCallback(async () => {
    if (!toastRef.current) return;
    toastRef.current.show("Préparation…");
    document.body.dataset.exportStatus = "running";
    delete document.body.dataset.exportFilename;
    delete document.body.dataset.exportMessage;

    try {
      const mapEl = mapRef.current?.getContainer();
      if (!mapEl) throw new Error("Carte introuvable");

      const scene = document.querySelector<HTMLElement>("[data-bubble-scene]");
      const sidebar = document.querySelector<HTMLElement>("[data-sidebar]");
      const scale = 2;
      toastRef.current.show("Synchronisation des données…");
      const exportSnapshot = await waitForExportData();
      await waitForFontsForExport();
      const exportTheme = getExportTheme();

      toastRef.current.show("Rendu des tuiles…");
      const mapCanvas = await renderLeafletTilesToCanvas(mapEl, scale);
      const mapCtx = mapCanvas.getContext("2d");
      if (!mapCtx) throw new Error("Canvas export indisponible");

      const svgOverlay = await rasterizeLeafletSvgOverlay(mapEl);
      if (svgOverlay) {
        mapCtx.drawImage(svgOverlay.img, svgOverlay.x, svgOverlay.y, svgOverlay.w, svgOverlay.h);
      }
      drawLeafletCanvasOverlayToCanvas(mapCtx, mapEl);
      drawLeafletMarkersToCanvas(mapCtx, mapEl);
      const sidebarMetrics = readSidebarExportMetrics(sidebar);
      await drawLeafletTooltipsToCanvas(mapCtx, mapEl);

      const filename = `Newmark_Visites_${new Date().toISOString().slice(0, 10)}.png`;

      if (view === "bubbles") {
        if (!scene || !sidebar) throw new Error("Vue bulles indisponible");

        const sceneRect = scene.getBoundingClientRect();
        const sidebarRect = sidebar.getBoundingClientRect();
        const exportWidth = Math.round(sceneRect.width);
        const exportHeight = Math.round(sceneRect.height);
        const sidebarWidth = Math.round(sidebarRect.width);
        const bubbleCards = Array.from(scene.querySelectorAll<HTMLElement>("[data-bubble-card]"));
        const cardState = bubbleCards.map((card) => ({
          card,
          animation: card.style.animation,
          opacity: card.style.opacity,
        }));

        toastRef.current.show("Rendu des bulles…");
        bubbleCards.forEach((card) => {
          card.style.animation = "none";
          card.style.opacity = "1";
        });
        let sidebarCanvas: HTMLCanvasElement | null = null;
        let bubbleCanvas: HTMLCanvasElement | null = null;
        try {
          await new Promise((resolve) => setTimeout(resolve, 50));

          try {
            sidebarCanvas = renderSidebarExportCanvas({
              visits: exportSnapshot.visits,
              routes: exportSnapshot.routes,
              startTime: exportSnapshot.startTime,
              routesPending: exportSnapshot.routesPending,
              theme: exportTheme,
              sidebarMetrics,
              width: Math.round(sidebarRect.width),
              height: exportHeight,
              scale,
            });
          } catch (error) {
            throw new Error(
              `Sidebar capture failed: ${error instanceof Error ? error.message : "unknown error"}`
            );
          }

          try {
            bubbleCanvas = renderBubbleOverlayCanvas({
              scene,
              visits: exportSnapshot.visits,
              theme: exportTheme,
              scale,
            });
          } catch (error) {
            throw new Error(
              `Bubble capture failed: ${error instanceof Error ? error.message : "unknown error"}`
            );
          }
        } finally {
          cardState.forEach(({ card, animation, opacity }) => {
            card.style.animation = animation;
            card.style.opacity = opacity;
          });
        }
        if (!sidebarCanvas || !bubbleCanvas) {
          throw new Error("Export PNG impossible");
        }

        const output = document.createElement("canvas");
        output.width = (sidebarWidth + exportWidth) * scale;
        output.height = exportHeight * scale;
        const outputCtx = output.getContext("2d");
        if (!outputCtx) throw new Error("Canvas export indisponible");

        outputCtx.fillStyle = "#ffffff";
        outputCtx.fillRect(0, 0, output.width, output.height);
        outputCtx.drawImage(sidebarCanvas, 0, 0);
        outputCtx.drawImage(
          mapCanvas,
          0,
          0,
          mapCanvas.width,
          mapCanvas.height,
          sidebarWidth * scale,
          0,
          exportWidth * scale,
          exportHeight * scale
        );
        outputCtx.drawImage(bubbleCanvas, sidebarWidth * scale, 0);

        await downloadCanvasAsPng(output, filename);
      } else {
        const mapRect = mapEl.getBoundingClientRect();
        const sidebarWidth = sidebar ? Math.round(sidebar.getBoundingClientRect().width) : 0;
        const output = document.createElement("canvas");
        output.width = Math.round((sidebarWidth + mapRect.width) * scale);
        output.height = Math.round(mapRect.height * scale);
        const outputCtx = output.getContext("2d");
        if (!outputCtx) throw new Error("Canvas export indisponible");

        outputCtx.fillStyle = "#ffffff";
        outputCtx.fillRect(0, 0, output.width, output.height);

        if (sidebar) {
          const sidebarRect = sidebar.getBoundingClientRect();
          const sidebarCanvas = renderSidebarExportCanvas({
            visits: exportSnapshot.visits,
            routes: exportSnapshot.routes,
            startTime: exportSnapshot.startTime,
            routesPending: exportSnapshot.routesPending,
            theme: exportTheme,
            sidebarMetrics,
            width: Math.round(sidebarRect.width),
            height: Math.round(mapRect.height),
            scale,
          });
          outputCtx.drawImage(sidebarCanvas, 0, 0);
        }

        outputCtx.drawImage(mapCanvas, sidebarWidth * scale, 0);
        await downloadCanvasAsPng(output, filename);
      }

      toastRef.current.show("✓ Image exportée !");
      document.body.dataset.exportStatus = "ok";
      document.body.dataset.exportFilename = filename;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur d'export";
      toastRef.current.show(`✕ ${message}`);
      document.body.dataset.exportStatus = "error";
      document.body.dataset.exportMessage = message;
    }
  }, [view, waitForExportData]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("__codex_export_check") !== "1") return;
    if (exportCheckRanRef.current) return;
    if (!store.visits.length) return;

    if (view !== "bubbles") {
      handleViewChange("bubbles");
      return;
    }

    if (!mapRef.current?.getContainer()) return;

    exportCheckRanRef.current = true;
    window.setTimeout(() => {
      void handleExportPNG();
    }, 1200);
  }, [handleExportPNG, handleViewChange, store.visits.length, view]);

  const editVisit = editIdx >= 0 ? store.visits[editIdx] : undefined;

  return (
    <AuthGuard>
      <TitleBar
        visits={store.visits}
        routes={store.routes}
        view={view}
        onViewChange={handleViewChange}
        themePickerSlot={<ThemePicker onThemeChange={() => setThemeVersion((value) => value + 1)} />}
      />

      <Sidebar
        visits={store.visits}
        routes={store.routes}
        startTime={store.startTime}
        routesPending={store.routesPending}
        onStartTimeChange={store.updateStartTime}
        onEditVisit={openEditForm}
        onDeleteVisit={handleDelete}
        onMoveVisit={store.moveVisit}
        onReorderVisit={store.reorderVisit}
        onDurationChange={store.updateDuration}
        onOptimizeOrder={store.optimizeOrder}
        onAddVisit={openAddForm}
      />

      <div id="__map_el">
        <MapContainerWrapper
          visits={store.visits}
          routes={store.routes}
          fitTrigger={fitTrigger}
          onEditVisit={openEditForm}
          onMapClick={handleMapClick}
          panelOpen={panelOpen}
          mapRef={mapRef}
          sidebarVisible={true}
          themeVersion={themeVersion}
        />
      </div>

      <TransitControls mapRef={mapRef} view={view} />

      {/* Loading indicators */}
      {(store.routesPending || geocoding) && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[950] flex items-center gap-2.5 bg-white/95 backdrop-blur-sm border border-border rounded-full px-4 py-2 shadow-lg animate-[fadeInUp_.25s_ease-out]">
          <div
            className="w-3.5 h-3.5 rounded-full border-2 border-[var(--map-green)] border-t-transparent"
            style={{ animation: "spin .6s linear infinite" }}
          />
          <span className="text-[11px] font-semibold text-text-secondary">
            {geocoding ? "Localisation de l'adresse…" : "Mise à jour des itinéraires…"}
          </span>
        </div>
      )}

      {/* Map click hint */}
      {view === "map" && !geocoding && (
        <div className="fixed bottom-6 right-5 z-[900] bg-white border border-border rounded-[var(--radius)] px-4 py-2.5 shadow-sm text-[10px] text-black/65 flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full bg-[var(--map-green)]"
            style={{ animation: "mchPulse 2s infinite" }}
          />
          Cliquez sur la carte pour ajouter un point
        </div>
      )}

      {/* Action buttons */}
      {(view === "bubbles" || view === "map") && (
        <div className="fixed top-[calc(var(--bar-h)+12px)] right-5 z-[900] flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="px-5 py-2.5 border-none rounded-[10px] text-xs font-bold cursor-pointer bg-white text-primary border border-border shadow-[0_4px_20px_rgba(0,0,0,.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(0,0,0,.12)]"
          >
            Importer Excel
          </button>
          <button
            onClick={handleExportPNG}
            data-export-button
            className="px-5 py-2.5 border-none rounded-[10px] text-xs font-bold cursor-pointer bg-primary text-white shadow-[0_4px_20px_rgba(0,0,0,.15)] transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-[0_6px_24px_rgba(0,0,0,.2)]"
          >
            Exporter en PNG
          </button>
        </div>
      )}

      <BubbleScene
        visits={store.visits}
        mapRef={mapRef}
        onEditVisit={openEditForm}
        visible={view === "bubbles"}
        fitTrigger={fitTrigger}
      />

      <VisitForm
        open={panelOpen}
        visit={editVisit}
        onClose={() => {
          setPanelOpen(false);
          setEditIdx(-1);
          setPendingMapClick(null);
        }}
        onSave={handleSave}
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
