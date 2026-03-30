"use client";

import { hasCoords } from "@/lib/geocode";
import { fmtLoyer, fmtSurface } from "@/lib/format";
import type { Comparable, Reference } from "@/lib/types";

interface ExportTheme {
  background: string;
  primary: string;
  textSecondary: string;
  textTertiary: string;
  mapGreen: string;
  mapGreen10: string;
  mapBlue: string;
  mapBlue10: string;
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

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
) {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return [];

  const lines: string[] = [];
  let current = words[0];
  for (let index = 1; index < words.length; index += 1) {
    const next = `${current} ${words[index]}`;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    lines.push(current);
    current = words[index];
    if (lines.length === maxLines - 1) break;
  }

  if (lines.length < maxLines) {
    const usedWords = lines.join(" ").split(" ").filter(Boolean).length;
    const remaining = words.slice(usedWords);
    lines.push(ellipsizeText(ctx, (remaining.length ? remaining : [current]).join(" "), maxWidth));
  }

  return lines.slice(0, maxLines);
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

function drawCenteredTextLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  maxWidth: number
) {
  drawTextLine(ctx, text, centerX, y, maxWidth, "center");
}

function drawCenteredWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  wrapText(ctx, text, maxWidth, maxLines).forEach((line, index) => {
    drawCenteredTextLine(ctx, line, centerX, startY + index * lineHeight, maxWidth);
  });
}

function drawLetterSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing = 0
) {
  if (!text) return;
  if (!letterSpacing) {
    ctx.fillText(text, x, y);
    return;
  }

  let cursorX = x;
  for (const char of text) {
    ctx.fillText(char, cursorX, y);
    cursorX += ctx.measureText(char).width + letterSpacing;
  }
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
    primary: getCssVar(styles, "--primary", "#1a1a1a"),
    textSecondary: getCssVar(styles, "--text-secondary", "#6b7689"),
    textTertiary: getCssVar(styles, "--text-tertiary", "#8590a5"),
    mapGreen: getCssVar(styles, "--map-green", "#2d8c5a"),
    mapGreen10: getCssVar(styles, "--map-green-10", "rgba(45, 140, 90, 0.1)"),
    mapBlue: getCssVar(styles, "--map-blue", "#0062ae"),
    mapBlue10: getCssVar(styles, "--map-blue-10", "rgba(0, 98, 174, 0.1)"),
  };
}

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

function drawSceneMessage(ctx: CanvasRenderingContext2D, width: number, height: number, message: string) {
  ctx.fillStyle = "#6b7689";
  ctx.font = '400 14px "DM Sans", system-ui, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(message, width / 2, height / 2);
}

function drawCardShell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  borderColor: string,
  glowColor: string,
  shadowBlur = borderColor === glowColor ? 40 : 28
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

function drawCenteredBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  font: string,
  background: string,
  color: string,
  paddingX: number,
  height: number,
  maxWidth: number
) {
  ctx.font = font;
  const textWidth = Math.min(Math.ceil(ctx.measureText(text).width), maxWidth - paddingX * 2);
  const badgeWidth = textWidth + paddingX * 2;
  fillRoundedRect(ctx, centerX - badgeWidth / 2, y, badgeWidth, height, height / 2, background);
  ctx.fillStyle = color;
  drawCenteredTextLine(ctx, text, centerX, y + (height <= 16 ? 3 : 4), badgeWidth - paddingX * 2);
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

function buildCanvasFont(styles: CSSStyleDeclaration) {
  return buildCanvasFontWithSize(styles);
}

function buildCanvasFontWithSize(styles: CSSStyleDeclaration, fontSizeOverride?: number) {
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
  options?: {
    maxLines?: number;
    forceSingleLine?: boolean;
    verticalAlign?: "top" | "middle";
    safeInsetY?: number;
    letterSpacingOverride?: number;
    fitToWidth?: boolean;
  }
) {
  const normalizedText = rawText.replace(/\s+/g, " ").trim();
  if (!normalizedText) return;

  const text = applyTextTransform(normalizedText, styles.textTransform || "none");
  const paddingLeft = Number.parseFloat(styles.paddingLeft || "0") || 0;
  const paddingRight = Number.parseFloat(styles.paddingRight || "0") || 0;
  const paddingTop = Number.parseFloat(styles.paddingTop || "0") || 0;
  const paddingBottom = Number.parseFloat(styles.paddingBottom || "0") || 0;
  const maxWidth = Math.max(0, rect.width - paddingLeft - paddingRight);
  if (maxWidth <= 0) return;

  const align = textAlignFromStyles(styles);
  const fontSize = Number.parseFloat(styles.fontSize || "12") || 12;
  const lineHeight = Number.parseFloat(styles.lineHeight || "") || fontSize * 1.2;
  const letterSpacing =
    options?.letterSpacingOverride ?? (Number.parseFloat(styles.letterSpacing || "0") || 0);
  const domLineClamp =
    Number.parseInt(
      (styles as CSSStyleDeclaration & { webkitLineClamp?: string }).webkitLineClamp || "0",
      10
    ) || 1;
  const lineClamp = options?.forceSingleLine ? 1 : (options?.maxLines ?? domLineClamp);
  const verticalAlign = options?.verticalAlign ?? (lineClamp === 1 ? "middle" : "top");
  const safeInsetY = options?.safeInsetY ?? (lineClamp === 1 ? 1 : 0);
  const fitToWidth = options?.fitToWidth ?? false;

  ctx.save();
  ctx.fillStyle = styles.color || "#000000";
  let activeFontSize = fontSize;
  ctx.font = buildCanvasFont(styles);
  if (fitToWidth && lineClamp === 1) {
    let measuredWidth = measureTextWidth(ctx, text, letterSpacing);
    const minFontSize = Math.max(6, fontSize * 0.78);
    while (measuredWidth > maxWidth && activeFontSize > minFontSize) {
      activeFontSize = Math.max(minFontSize, activeFontSize - 0.25);
      ctx.font = buildCanvasFontWithSize(styles, activeFontSize);
      measuredWidth = measureTextWidth(ctx, text, letterSpacing);
    }
  }
  ctx.textBaseline = "top";
  ctx.textAlign = align;

  const startX =
    align === "center"
      ? rect.left + rect.width / 2
      : align === "right"
        ? rect.left + rect.width - paddingRight
        : rect.left + paddingLeft;

  const lines = lineClamp > 1
    ? wrapText(ctx, text, maxWidth, lineClamp)
    : [fitToWidth ? text : ellipsizeText(ctx, text, maxWidth)];
  const singleLineMetrics = ctx.measureText(lines[0] ?? "");
  const singleLineHeight =
    singleLineMetrics.actualBoundingBoxAscent + singleLineMetrics.actualBoundingBoxDescent || fontSize;
  const availableHeight = Math.max(0, rect.height - paddingTop - paddingBottom - safeInsetY * 2);
  const startY =
    verticalAlign === "middle" && lineClamp === 1
      ? rect.top + paddingTop + safeInsetY + Math.max(0, (availableHeight - singleLineHeight) / 2)
      : rect.top + paddingTop + safeInsetY;

  lines.forEach((line, index) => {
    const y = startY + index * lineHeight;
    let x = startX;
    if (letterSpacing && align === "center") {
      const measuredWidth = measureTextWidth(ctx, line, letterSpacing);
      x = rect.left + (rect.width - measuredWidth) / 2;
      drawLetterSpacedText(ctx, line, x, y, letterSpacing);
      return;
    }
    if (letterSpacing && align === "right") {
      const measuredWidth = measureTextWidth(ctx, line, letterSpacing);
      x = rect.left + rect.width - paddingRight - measuredWidth;
      drawLetterSpacedText(ctx, line, x, y, letterSpacing);
      return;
    }
    if (letterSpacing) {
      drawLetterSpacedText(ctx, line, x, y, letterSpacing);
      return;
    }
    ctx.fillText(line, x, y);
  });

  ctx.restore();
}

function getElementRectRelativeToScene(element: Element, sceneRect: DOMRect) {
  const rect = element.getBoundingClientRect();
  return new DOMRect(
    rect.left - sceneRect.left,
    rect.top - sceneRect.top,
    rect.width,
    rect.height
  );
}

function drawStyledElementBox(
  ctx: CanvasRenderingContext2D,
  rect: DOMRect,
  styles: CSSStyleDeclaration
) {
  const background = styles.backgroundColor;
  const borderWidth = Number.parseFloat(styles.borderTopWidth || "0") || 0;
  const borderColor = styles.borderTopColor || "transparent";
  const radius = parseRadius(styles.borderTopLeftRadius || "8");

  if (isTransparentColor(background) && (!borderWidth || isTransparentColor(borderColor))) return;
  fillRoundedRect(
    ctx,
    rect.left,
    rect.top,
    rect.width,
    rect.height,
    radius,
    isTransparentColor(background) ? "rgba(0,0,0,0)" : background,
    !borderWidth || isTransparentColor(borderColor) ? undefined : borderColor,
    borderWidth
  );
}

function drawReferenceCard(
  ctx: CanvasRenderingContext2D,
  theme: ExportTheme,
  rect: DOMRect,
  reference: Reference
) {
  const x = rect.left;
  const y = rect.top;
  const width = rect.width;
  const height = rect.height;
  const centerX = x + width / 2;

  drawCardShell(ctx, x, y, width, height, theme.mapGreen, theme.mapGreen10);
  drawCenteredBadge(
    ctx,
    "★ RÉFÉRENCE",
    centerX,
    y + 10,
    '700 8px "DM Sans", system-ui, sans-serif',
    theme.mapGreen,
    "#ffffff",
    12,
    18,
    width - 24
  );

  ctx.fillStyle = theme.primary;
  ctx.font = '700 14px "DM Sans", system-ui, sans-serif';
  drawCenteredWrappedText(ctx, reference.nom || reference.adresse, centerX, y + 40, width * 0.82, 16, 2);

  if (reference.adresse && reference.nom !== reference.adresse) {
    ctx.fillStyle = theme.textSecondary;
    ctx.font = '400 9px "DM Sans", system-ui, sans-serif';
    drawCenteredWrappedText(ctx, reference.adresse, centerX, y + 76, width * 0.78, 12, 2);
  }
}

function drawComparableCard(
  ctx: CanvasRenderingContext2D,
  theme: ExportTheme,
  rect: DOMRect,
  comparable: Comparable
) {
  const x = rect.left;
  const y = rect.top;
  const width = rect.width;
  const height = rect.height;
  const centerX = x + width / 2;

  drawCardShell(ctx, x, y, width, height, theme.mapBlue, theme.mapBlue10);
  drawCenteredBadge(
    ctx,
    "COMPARABLE",
    centerX,
    y + 8,
    '700 7px "DM Sans", system-ui, sans-serif',
    theme.mapBlue,
    "#ffffff",
    10,
    16,
    width - 24
  );

  ctx.fillStyle = theme.primary;
  ctx.font = '700 12px "DM Sans", system-ui, sans-serif';
  drawCenteredWrappedText(ctx, comparable.preneur, centerX, y + 31, width * 0.82, 14, 2);

  const rows: Array<[string, string]> = [
    ["Surface", fmtSurface(comparable.surface)],
    ["Loyer/m²", fmtLoyer(comparable.loyer)],
  ];

  const rowStartX = x + width * 0.11;
  const rowRightX = x + width * 0.89;
  let rowY = y + 68;
  rows.forEach(([label, value]) => {
    ctx.fillStyle = theme.textTertiary;
    ctx.font = '400 9px "DM Sans", system-ui, sans-serif';
    drawTextLine(ctx, label, rowStartX, rowY, width * 0.28);
    ctx.fillStyle = theme.primary;
    ctx.font = '700 9px "DM Sans", system-ui, sans-serif';
    drawTextLine(ctx, value, rowRightX, rowY, width * 0.34, "right");
    rowY += 13;
  });

  const footer = [comparable.date, comparable.etat].filter(Boolean).join(" · ");
  if (footer) {
    ctx.fillStyle = theme.textTertiary;
    ctx.font = 'italic 400 8px "DM Sans", system-ui, sans-serif';
    drawCenteredTextLine(ctx, footer, centerX, y + height - 18, width * 0.84);
  }
}

function drawCardShellFromLayout(
  ctx: CanvasRenderingContext2D,
  sceneRect: DOMRect,
  card: HTMLElement
) {
  const rect = getElementRectRelativeToScene(card, sceneRect);
  const styles = getComputedStyle(card);
  const borderColor = styles.borderTopColor || "#0062ae";
  const glowColor = borderColor;
  const shadowBlur = parseShadowBlur(styles.boxShadow);

  drawCardShell(ctx, rect.left, rect.top, rect.width, rect.height, borderColor, glowColor, shadowBlur);

  return { rect };
}

function drawReferenceCardFromLayout(
  ctx: CanvasRenderingContext2D,
  sceneRect: DOMRect,
  card: HTMLElement,
  reference: Reference
) {
  drawCardShellFromLayout(ctx, sceneRect, card);

  const badge = card.querySelector<HTMLElement>(":scope > .cmp-ref-badge");
  if (badge) {
    const badgeRect = getElementRectRelativeToScene(badge, sceneRect);
    const badgeStyles = getComputedStyle(badge);
    drawStyledElementBox(ctx, badgeRect, badgeStyles);
    drawTextBlock(ctx, "★ RÉFÉRENCE", badgeRect, badgeStyles, {
      forceSingleLine: true,
      verticalAlign: "middle",
      fitToWidth: true,
    });
  }

  const name = card.querySelector<HTMLElement>(":scope > .cmp-ref-name");
  if (name) {
    const nameRect = getElementRectRelativeToScene(name, sceneRect);
    const nameStyles = getComputedStyle(name);
    drawTextBlock(ctx, reference.nom || reference.adresse || "", nameRect, nameStyles, { maxLines: 2 });
  }

  const address = card.querySelector<HTMLElement>(":scope > .cmp-ref-address");
  if (address) {
    const addressRect = getElementRectRelativeToScene(address, sceneRect);
    const addressStyles = getComputedStyle(address);
    drawTextBlock(ctx, reference.adresse || "", addressRect, addressStyles, { maxLines: 2 });
  }
}

function drawComparableCardFromLayout(
  ctx: CanvasRenderingContext2D,
  sceneRect: DOMRect,
  card: HTMLElement,
  comparable: Comparable
) {
  drawCardShellFromLayout(ctx, sceneRect, card);

  const badge = card.querySelector<HTMLElement>(":scope > .cmp-card-badge");
  if (badge) {
    const badgeRect = getElementRectRelativeToScene(badge, sceneRect);
    const badgeStyles = getComputedStyle(badge);
    drawStyledElementBox(ctx, badgeRect, badgeStyles);
    drawTextBlock(ctx, "COMPARABLE", badgeRect, badgeStyles, {
      forceSingleLine: true,
      verticalAlign: "middle",
      fitToWidth: true,
    });
  }

  const name = card.querySelector<HTMLElement>(":scope > .cmp-card-name");
  if (name) {
    const nameRect = getElementRectRelativeToScene(name, sceneRect);
    const nameStyles = getComputedStyle(name);
    drawTextBlock(ctx, comparable.preneur || "", nameRect, nameStyles, { maxLines: 2 });
  }

  const rows: Array<{ label: string; value: string }> = [
    { label: "Surface", value: fmtSurface(comparable.surface) },
    { label: "Loyer/m²", value: fmtLoyer(comparable.loyer) },
  ];

  const rowEls = Array.from(card.querySelectorAll<HTMLElement>(":scope > .cmp-card-row"));
  rowEls.forEach((row, index) => {
    const rowData = rows[index];
    if (!rowData) return;

    const label = row.querySelector<HTMLElement>(".cmp-card-label");
    if (label) {
      const labelRect = getElementRectRelativeToScene(label, sceneRect);
      const labelStyles = getComputedStyle(label);
      drawTextBlock(ctx, rowData.label, labelRect, labelStyles, { forceSingleLine: true });
    }

    const value = row.querySelector<HTMLElement>(".cmp-card-value");
    if (value) {
      const valueRect = getElementRectRelativeToScene(value, sceneRect);
      const valueStyles = getComputedStyle(value);
      drawTextBlock(ctx, rowData.value, valueRect, valueStyles, {
        forceSingleLine: true,
        fitToWidth: true,
      });
    }
  });

  const footer = card.querySelector<HTMLElement>(":scope > .cmp-card-footer");
  if (footer) {
    const footerRect = getElementRectRelativeToScene(footer, sceneRect);
    const footerStyles = getComputedStyle(footer);
    const footerText = [comparable.date, comparable.etat].filter(Boolean).join(" · ");
    drawTextBlock(ctx, footerText, footerRect, footerStyles, {
      forceSingleLine: true,
      fitToWidth: true,
    });
  }
}

export function renderComparablesBubbleOverlayCanvas({
  scene,
  actif,
  comps,
  scale,
}: {
  scene: HTMLElement;
  actif: Reference | null;
  comps: Comparable[];
  scale: number;
}) {
  const sceneRect = scene.getBoundingClientRect();
  const { canvas, ctx } = createScaledCanvas(sceneRect.width, sceneRect.height, scale);
  const theme = getExportTheme();
  const items: Array<{ reference?: Reference; comparable?: Comparable }> = [];

  if (actif && hasCoords(actif.lat, actif.lng)) items.push({ reference: actif });
  comps.forEach((comp) => {
    if (hasCoords(comp.lat, comp.lng)) items.push({ comparable: comp });
  });

  drawSceneSvgOverlay(ctx, scene);

  const cards = Array.from(scene.querySelectorAll<HTMLElement>("[data-bubble-card]"));
  if (!cards.length) {
    const message = scene.innerText.replace(/\s+/g, " ").trim();
    if (message) drawSceneMessage(ctx, sceneRect.width, sceneRect.height, message);
  }
  cards.forEach((card, index) => {
    const item = items[index];
    if (!item) return;

    if (item.reference) {
      if (card.querySelector(".cmp-ref-badge")) {
        drawReferenceCardFromLayout(ctx, sceneRect, card, item.reference);
        return;
      }
      const rect = card.getBoundingClientRect();
      const relativeRect = new DOMRect(
        rect.left - sceneRect.left,
        rect.top - sceneRect.top,
        rect.width,
        rect.height
      );
      drawReferenceCard(ctx, theme, relativeRect, item.reference);
      return;
    }

    if (item.comparable) {
      if (card.querySelector(".cmp-card-badge")) {
        drawComparableCardFromLayout(ctx, sceneRect, card, item.comparable);
        return;
      }
      const rect = card.getBoundingClientRect();
      const relativeRect = new DOMRect(
        rect.left - sceneRect.left,
        rect.top - sceneRect.top,
        rect.width,
        rect.height
      );
      drawComparableCard(ctx, theme, relativeRect, item.comparable);
    }
  });

  const legendY = sceneRect.height - 46;
  ctx.fillStyle = theme.textSecondary;
  ctx.font = '400 10px "DM Sans", system-ui, sans-serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  ctx.beginPath();
  ctx.arc(34, legendY, 5, 0, Math.PI * 2);
  ctx.fillStyle = theme.mapGreen;
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,.4)";
  ctx.fillText("Adresse de reference", 48, legendY);

  ctx.beginPath();
  ctx.arc(34, legendY + 16, 5, 0, Math.PI * 2);
  ctx.fillStyle = theme.mapBlue;
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,.4)";
  ctx.fillText(`Comparable (${comps.filter((comp) => hasCoords(comp.lat, comp.lng)).length})`, 48, legendY + 16);

  ctx.fillStyle = "rgba(0,0,0,.06)";
  ctx.font = '600 14px "DM Sans", system-ui, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("NEWMARK", sceneRect.width / 2, sceneRect.height - 36);
  ctx.fillStyle = "rgba(0,0,0,.04)";
  ctx.font = '400 8px "DM Sans", system-ui, sans-serif';
  ctx.fillText("CARTE DE COMPARABLES", sceneRect.width / 2, sceneRect.height - 18);

  return canvas;
}

export async function waitForExportFonts() {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.all([
      document.fonts.load('400 8px "DM Sans"'),
      document.fonts.load('400 9px "DM Sans"'),
      document.fonts.load('400 10px "DM Sans"'),
      document.fonts.load('700 7px "DM Sans"'),
      document.fonts.load('700 8px "DM Sans"'),
      document.fonts.load('700 9px "DM Sans"'),
      document.fonts.load('700 12px "DM Sans"'),
      document.fonts.load('700 14px "DM Sans"'),
    ]);
    await document.fonts.ready;
  } catch {
    // Continue when font readiness is unavailable.
  }
}
