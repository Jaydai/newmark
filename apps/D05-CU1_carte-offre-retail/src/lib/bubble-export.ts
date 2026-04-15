"use client";

import { hasCoords } from "@/lib/geocode";
import { fmtEuro, fmtLoyer, fmtSurface } from "@/lib/format";
import type { OffreRetail } from "@/lib/types";

/* ── helpers ───────────────────────────────────────── */

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
  if (stroke && lineWidth > 0) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function ellipsizeText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let value = text.trim();
  while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}…`;
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
  ctx.fillText(ellipsizeText(ctx, text, maxWidth), centerX, y);
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
  ctx.fillText(ellipsizeText(ctx, text, maxWidth), x, y);
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

interface ExportTheme {
  background: string;
  border: string;
  surfaceAlt: string;
  primary: string;
  textSecondary: string;
  textTertiary: string;
  mapBlue: string;
  mapBlue08: string;
}

function getExportTheme(): ExportTheme {
  const styles = getComputedStyle(document.documentElement);
  return {
    background: getCssVar(styles, "--background", "#ffffff"),
    border: getCssVar(styles, "--border", "#e5e5e5"),
    surfaceAlt: getCssVar(styles, "--surface-alt", "#f0f2f5"),
    primary: getCssVar(styles, "--primary", "#1a1a1a"),
    textSecondary: getCssVar(styles, "--text-secondary", "#6b7689"),
    textTertiary: getCssVar(styles, "--text-tertiary", "#8590a5"),
    mapBlue: getCssVar(styles, "--map-blue", "#0062ae"),
    mapBlue08: getCssVar(styles, "--map-blue-08", "rgba(0, 98, 174, 0.08)"),
  };
}

/* ── SVG connector lines ──────────────────────────── */

function drawSceneSvgOverlay(ctx: CanvasRenderingContext2D, scene: HTMLElement) {
  const svgEl = scene.querySelector<SVGSVGElement>("svg");
  if (!svgEl) return;

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

/* ── DOM-based card reading helpers ───────────────── */

function getElementRectRelativeToScene(element: Element, sceneRect: DOMRect) {
  const rect = element.getBoundingClientRect();
  return new DOMRect(
    rect.left - sceneRect.left,
    rect.top - sceneRect.top,
    rect.width,
    rect.height
  );
}

function parseShadowBlur(boxShadow: string) {
  const match = boxShadow.match(/0(?:px)?\s+(\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px/i);
  if (!match) return 28;
  return Number.parseFloat(match[2]) || 28;
}

function parseRadius(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 8;
}

function isTransparentColor(value: string) {
  return !value || value === "transparent" || value === "rgba(0, 0, 0, 0)" || value === "rgba(0,0,0,0)";
}

function buildCanvasFont(styles: CSSStyleDeclaration, fontSizeOverride?: number) {
  const fontStyle = styles.fontStyle || "normal";
  const fontWeight = styles.fontWeight || "400";
  const fontSize = fontSizeOverride != null ? `${fontSizeOverride}px` : (styles.fontSize || "12px");
  const fontFamily = styles.fontFamily || '"DM Sans", system-ui, sans-serif';
  return `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`;
}

function measureTextWidth(ctx: CanvasRenderingContext2D, text: string, letterSpacing = 0) {
  if (!text) return 0;
  if (!letterSpacing) return ctx.measureText(text).width;
  return Array.from(text).reduce((sum, char) => sum + ctx.measureText(char).width, 0) +
    Math.max(0, text.length - 1) * letterSpacing;
}

function drawLetterSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing = 0
) {
  if (!text) return;
  if (!letterSpacing) { ctx.fillText(text, x, y); return; }
  let cursorX = x;
  for (const char of text) {
    ctx.fillText(char, cursorX, y);
    cursorX += ctx.measureText(char).width + letterSpacing;
  }
}

function applyTextTransform(text: string, textTransform: string) {
  switch (textTransform) {
    case "uppercase": return text.toLocaleUpperCase("fr-FR");
    case "lowercase": return text.toLocaleLowerCase("fr-FR");
    case "capitalize": return text.replace(/\b(\p{L})/gu, (m) => m.toLocaleUpperCase("fr-FR"));
    default: return text;
  }
}

function textAlignFromStyles(styles: CSSStyleDeclaration): CanvasTextAlign {
  if (styles.textAlign === "center") return "center";
  if (styles.textAlign === "right" || styles.textAlign === "end") return "right";
  return "left";
}

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  rawText: string,
  rect: DOMRect,
  styles: CSSStyleDeclaration,
  options?: { forceSingleLine?: boolean; fitToWidth?: boolean }
) {
  const normalizedText = rawText.replace(/\s+/g, " ").trim();
  if (!normalizedText) return;

  const text = applyTextTransform(normalizedText, styles.textTransform || "none");
  const paddingLeft = Number.parseFloat(styles.paddingLeft || "0") || 0;
  const paddingRight = Number.parseFloat(styles.paddingRight || "0") || 0;
  const paddingTop = Number.parseFloat(styles.paddingTop || "0") || 0;
  const maxWidth = Math.max(0, rect.width - paddingLeft - paddingRight);
  if (maxWidth <= 0) return;

  const align = textAlignFromStyles(styles);
  const fontSize = Number.parseFloat(styles.fontSize || "12") || 12;
  const letterSpacing = Number.parseFloat(styles.letterSpacing || "0") || 0;
  const fitToWidth = options?.fitToWidth ?? false;

  ctx.save();
  ctx.fillStyle = styles.color || "#000000";
  let activeFontSize = fontSize;
  ctx.font = buildCanvasFont(styles);
  if (fitToWidth) {
    let measuredWidth = measureTextWidth(ctx, text, letterSpacing);
    const minFontSize = Math.max(6, fontSize * 0.78);
    while (measuredWidth > maxWidth && activeFontSize > minFontSize) {
      activeFontSize = Math.max(minFontSize, activeFontSize - 0.25);
      ctx.font = buildCanvasFont(styles, activeFontSize);
      measuredWidth = measureTextWidth(ctx, text, letterSpacing);
    }
  }
  ctx.textBaseline = "top";
  ctx.textAlign = align;

  const startX =
    align === "center" ? rect.left + rect.width / 2
      : align === "right" ? rect.left + rect.width - paddingRight
        : rect.left + paddingLeft;

  const finalText = fitToWidth ? text : ellipsizeText(ctx, text, maxWidth);
  const metrics = ctx.measureText(finalText);
  const lineH = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || fontSize;
  const availableH = Math.max(0, rect.height - paddingTop * 2);
  const y = rect.top + paddingTop + Math.max(0, (availableH - lineH) / 2);

  if (letterSpacing && align === "center") {
    const mw = measureTextWidth(ctx, finalText, letterSpacing);
    drawLetterSpacedText(ctx, finalText, rect.left + (rect.width - mw) / 2, y, letterSpacing);
  } else if (letterSpacing) {
    drawLetterSpacedText(ctx, finalText, startX, y, letterSpacing);
  } else {
    ctx.fillText(finalText, startX, y);
  }

  ctx.restore();
}

function drawStyledElementBox(ctx: CanvasRenderingContext2D, rect: DOMRect, styles: CSSStyleDeclaration) {
  const background = styles.backgroundColor;
  const borderWidth = Number.parseFloat(styles.borderTopWidth || "0") || 0;
  const borderColor = styles.borderTopColor || "transparent";
  const radius = parseRadius(styles.borderTopLeftRadius || "8");
  if (isTransparentColor(background) && (!borderWidth || isTransparentColor(borderColor))) return;
  fillRoundedRect(
    ctx, rect.left, rect.top, rect.width, rect.height, radius,
    isTransparentColor(background) ? "rgba(0,0,0,0)" : background,
    !borderWidth || isTransparentColor(borderColor) ? undefined : borderColor,
    borderWidth
  );
}

/* ── Card shell ───────────────────────────────────── */

function drawCardShell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, width: number, height: number,
  borderColor: string, glowColor: string, shadowBlur: number
) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.12)";
  ctx.shadowBlur = shadowBlur;
  fillRoundedRect(ctx, x, y, width, height, 8, "#ffffff");
  ctx.restore();
  fillRoundedRect(ctx, x, y, width, height, 8, "#ffffff", borderColor, 2);
  ctx.save();
  roundedRectPath(ctx, x, y, width, height, 8);
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawCardShellFromLayout(ctx: CanvasRenderingContext2D, sceneRect: DOMRect, card: HTMLElement) {
  const rect = getElementRectRelativeToScene(card, sceneRect);
  const styles = getComputedStyle(card);
  const borderColor = styles.borderTopColor || "#0062ae";
  const shadowBlur = parseShadowBlur(styles.boxShadow);
  drawCardShell(ctx, rect.left, rect.top, rect.width, rect.height, borderColor, borderColor, shadowBlur);
}

/* ── Draw a single card from DOM layout ───────────── */

function drawOrCardFromLayout(
  ctx: CanvasRenderingContext2D,
  sceneRect: DOMRect,
  card: HTMLElement,
  item: OffreRetail
) {
  drawCardShellFromLayout(ctx, sceneRect, card);

  const badge = card.querySelector<HTMLElement>(":scope > .or-bub-badge");
  if (badge) {
    const badgeRect = getElementRectRelativeToScene(badge, sceneRect);
    const badgeStyles = getComputedStyle(badge);
    drawStyledElementBox(ctx, badgeRect, badgeStyles);
    drawTextBlock(ctx, "OFFRE RETAIL", badgeRect, badgeStyles, { forceSingleLine: true, fitToWidth: true });
  }

  const name = card.querySelector<HTMLElement>(":scope > .or-bub-name");
  if (name) {
    const nameRect = getElementRectRelativeToScene(name, sceneRect);
    const nameStyles = getComputedStyle(name);
    drawTextBlock(ctx, item.enseigne || item.ref || "-", nameRect, nameStyles, { forceSingleLine: true });
  }

  const area = card.querySelector<HTMLElement>(":scope > .or-bub-area");
  if (area) {
    const areaRect = getElementRectRelativeToScene(area, sceneRect);
    const areaStyles = getComputedStyle(area);
    drawTextBlock(ctx, item.adresse || "", areaRect, areaStyles, { forceSingleLine: true });
  }

  const rows: Array<{ label: string; value: string }> = [
    { label: "Surface", value: fmtSurface(item.surface) },
    { label: "Loyer", value: fmtEuro(item.loyer) },
    { label: "€/m²", value: fmtLoyer(item.loyerM2) },
  ];

  const rowEls = Array.from(card.querySelectorAll<HTMLElement>(":scope > .or-bub-row"));
  rowEls.forEach((row, index) => {
    const rowData = rows[index];
    if (!rowData) return;

    const label = row.querySelector<HTMLElement>(".or-bub-label");
    if (label) {
      const labelRect = getElementRectRelativeToScene(label, sceneRect);
      const labelStyles = getComputedStyle(label);
      drawTextBlock(ctx, rowData.label, labelRect, labelStyles, { forceSingleLine: true });
    }

    const value = row.querySelector<HTMLElement>(".or-bub-value");
    if (value) {
      const valueRect = getElementRectRelativeToScene(value, sceneRect);
      const valueStyles = getComputedStyle(value);
      drawTextBlock(ctx, rowData.value, valueRect, valueStyles, { forceSingleLine: true, fitToWidth: true });
    }
  });
}

/* ── Fallback card rendering (no DOM layout) ──────── */

function drawOrCard(
  ctx: CanvasRenderingContext2D,
  theme: ExportTheme,
  card: DOMRect,
  item: OffreRetail,
  count: number
) {
  const x = card.left;
  const y = card.top;
  const width = card.width;
  const height = card.height;
  const centerX = x + width / 2;
  const compact = count > 30;
  const medium = count > 15;
  const nameFont = compact ? '700 8px "DM Sans", system-ui, sans-serif' : medium ? '700 9px "DM Sans", system-ui, sans-serif' : '700 10px "DM Sans", system-ui, sans-serif';
  const rowFont = compact ? '400 7px "DM Sans", system-ui, sans-serif' : '400 8px "DM Sans", system-ui, sans-serif';
  const rowValueFont = compact ? '700 7px "DM Sans", system-ui, sans-serif' : '700 8px "DM Sans", system-ui, sans-serif';

  drawCardShell(ctx, x, y, width, height, theme.mapBlue, theme.mapBlue08, 28);

  // badge
  ctx.font = '700 6px "DM Sans", system-ui, sans-serif';
  const badgeText = "OFFRE RETAIL";
  const badgeWidth = Math.min(Math.ceil(ctx.measureText(badgeText).width) + 16, width - 20);
  fillRoundedRect(ctx, centerX - badgeWidth / 2, y + 7, badgeWidth, 14, 7, theme.mapBlue);
  ctx.fillStyle = "#ffffff";
  drawCenteredTextLine(ctx, badgeText, centerX, y + 10, badgeWidth - 8);

  // name
  ctx.fillStyle = theme.primary;
  ctx.font = nameFont;
  drawCenteredTextLine(ctx, item.enseigne || item.ref || "-", centerX, y + 25, width * 0.86);

  // area
  if (item.adresse) {
    ctx.fillStyle = theme.textSecondary;
    ctx.font = '400 7px "DM Sans", system-ui, sans-serif';
    drawCenteredTextLine(ctx, item.adresse, centerX, y + 39, width * 0.86);
  }

  // rows
  const rows: Array<[string, string]> = [
    ["Surface", fmtSurface(item.surface)],
    ["Loyer", fmtEuro(item.loyer)],
    ["€/m²", fmtLoyer(item.loyerM2)],
  ];

  const rowStartX = x + width * 0.075;
  const rowRightX = x + width * 0.925;
  let rowY = y + 53;
  rows.forEach(([label, value]) => {
    ctx.fillStyle = theme.textSecondary;
    ctx.font = rowFont;
    drawTextLine(ctx, label, rowStartX, rowY, width * 0.3);
    ctx.fillStyle = theme.primary;
    ctx.font = rowValueFont;
    drawTextLine(ctx, value, rowRightX, rowY, width * 0.44, "right");
    rowY += compact ? 10 : 12;
  });
}

/* ── Data selection ───────────────────────────────── */

const MAX_BUBBLE_CARDS = 25;

function bubbleScore(item: OffreRetail): number {
  return (item.loyer ?? 0) + (item.surface ?? 0) * 10;
}

export function getOffreRetailForBubbleExport(
  items: OffreRetail[],
  map: import("leaflet").Map
) {
  const geocoded = items.filter((item) => hasCoords(item.lat, item.lng));
  const bounds = map.getBounds();
  const inView = geocoded.filter((item) => bounds.contains([item.lat!, item.lng!]));
  if (inView.length <= MAX_BUBBLE_CARDS) return { shown: inView, total: inView.length };

  return {
    shown: [...inView].sort((a, b) => bubbleScore(b) - bubbleScore(a)).slice(0, MAX_BUBBLE_CARDS),
    total: inView.length,
  };
}

/* ── Main export function ─────────────────────────── */

export function renderOrBubbleOverlayCanvas({
  scene,
  items,
  overflowCount,
  scale,
}: {
  scene: HTMLElement;
  items: OffreRetail[];
  overflowCount: number;
  scale: number;
}) {
  const sceneRect = scene.getBoundingClientRect();
  const { canvas, ctx } = createScaledCanvas(sceneRect.width, sceneRect.height, scale);
  const theme = getExportTheme();

  drawSceneSvgOverlay(ctx, scene);

  const cards = Array.from(scene.querySelectorAll<HTMLElement>("[data-or-bubble-card]"));
  if (!cards.length) {
    const message = scene.innerText.replace(/\s+/g, " ").trim();
    if (message) {
      ctx.fillStyle = "#6b7689";
      ctx.font = '400 14px "DM Sans", system-ui, sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(message, sceneRect.width / 2, sceneRect.height / 2);
    }
  }
  cards.forEach((card, index) => {
    const item = items[index];
    if (!item) return;
    if (card.querySelector(".or-bub-badge")) {
      drawOrCardFromLayout(ctx, sceneRect, card, item);
      return;
    }
    const rect = card.getBoundingClientRect();
    drawOrCard(
      ctx, theme,
      new DOMRect(rect.left - sceneRect.left, rect.top - sceneRect.top, rect.width, rect.height),
      item, cards.length
    );
  });

  if (overflowCount > 0) {
    ctx.font = '600 11px "DM Sans", system-ui, sans-serif';
    const badgeText = `+${overflowCount} autre${overflowCount > 1 ? "s" : ""} dans cette vue`;
    const badgeWidth = Math.ceil(ctx.measureText(badgeText).width) + 28;
    const badgeX = sceneRect.width / 2 - badgeWidth / 2;
    const badgeY = sceneRect.height - 44;
    fillRoundedRect(ctx, badgeX, badgeY, badgeWidth, 28, 14, "rgba(0,0,0,.65)");
    ctx.fillStyle = "#ffffff";
    drawCenteredTextLine(ctx, badgeText, sceneRect.width / 2, badgeY + 7, badgeWidth - 20);
  }

  ctx.fillStyle = "rgba(0,0,0,.06)";
  ctx.font = '600 14px "DM Sans", system-ui, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("NEWMARK", sceneRect.width / 2, sceneRect.height - 36);
  ctx.fillStyle = "rgba(0,0,0,.04)";
  ctx.font = '400 8px "DM Sans", system-ui, sans-serif';
  ctx.fillText("OFFRE RETAIL", sceneRect.width / 2, sceneRect.height - 18);

  return canvas;
}

export async function waitForExportFonts() {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.all([
      document.fonts.load('400 7px "DM Sans"'),
      document.fonts.load('400 8px "DM Sans"'),
      document.fonts.load('400 9px "DM Sans"'),
      document.fonts.load('600 6px "DM Sans"'),
      document.fonts.load('600 11px "DM Sans"'),
      document.fonts.load('700 6px "DM Sans"'),
      document.fonts.load('700 7px "DM Sans"'),
      document.fonts.load('700 8px "DM Sans"'),
      document.fonts.load('700 9px "DM Sans"'),
      document.fonts.load('700 10px "DM Sans"'),
      document.fonts.load('700 12px "DM Sans"'),
      document.fonts.load('700 14px "DM Sans"'),
    ]);
    await document.fonts.ready;
  } catch {
    // Continue when font readiness is unavailable.
  }
}
