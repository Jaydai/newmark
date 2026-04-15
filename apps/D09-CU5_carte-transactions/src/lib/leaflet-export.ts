function parseTranslate(transform: string): { x: number; y: number } {
  if (!transform) return { x: 0, y: 0 };

  const translate3d = transform.match(/translate3d\(\s*(-?[\d.e+-]+)px,\s*(-?[\d.e+-]+)px/i);
  if (translate3d) {
    return { x: Number.parseFloat(translate3d[1]), y: Number.parseFloat(translate3d[2]) };
  }

  const translate = transform.match(/translate\(\s*(-?[\d.e+-]+)px(?:,\s*(-?[\d.e+-]+)px)?/i);
  if (translate) {
    return {
      x: Number.parseFloat(translate[1]),
      y: Number.parseFloat(translate[2] ?? "0"),
    };
  }

  return { x: 0, y: 0 };
}

function parsePx(value: string | null | undefined, fallback = 0): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function buildCanvasFont(styles: CSSStyleDeclaration): string {
  const fontStyle = styles.fontStyle || "normal";
  const fontWeight = styles.fontWeight || "400";
  const fontSize = styles.fontSize || "12px";
  const fontFamily = styles.fontFamily || '"DM Sans", system-ui, sans-serif';
  return `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`;
}

function getTextNodeRect(node: ChildNode): DOMRect | null {
  if (node.nodeType !== Node.TEXT_NODE) return null;
  const text = node.textContent ?? "";
  if (!text.trim()) return null;

  const range = document.createRange();
  range.selectNodeContents(node);
  const rect = range.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0 ? rect : null;
}

function getTranslateOffset(el: HTMLElement, stopAt: HTMLElement): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let current: HTMLElement | null = el;

  while (current && current !== stopAt) {
    const translate = parseTranslate(current.style.transform);
    x += translate.x + (Number.parseFloat(current.style.left || "0") || 0);
    y += translate.y + (Number.parseFloat(current.style.top || "0") || 0);
    current = current.parentElement;
  }

  return { x, y };
}

export async function renderLeafletTilesToCanvas(mapEl: HTMLElement, scale = 2): Promise<HTMLCanvasElement> {
  const rect = mapEl.getBoundingClientRect();
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(rect.width * scale);
  canvas.height = Math.round(rect.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  ctx.scale(scale, scale);
  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(0, 0, rect.width, rect.height);

  const tiles = Array.from(mapEl.querySelectorAll<HTMLImageElement>("img.leaflet-tile"));

  await Promise.all(tiles.map(async (tile) => {
    if (!tile.complete || !tile.naturalWidth) return;

    const pos = getTranslateOffset(tile, mapEl);
    const width = tile.offsetWidth || 256;
    const height = tile.offsetHeight || 256;

    try {
      const response = await fetch(tile.src, { mode: "cors", cache: "no-store" });
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      ctx.drawImage(bitmap, pos.x, pos.y, width, height);
    } catch {
      try {
        ctx.drawImage(tile, pos.x, pos.y, width, height);
      } catch {
        // Ignore tainted or unavailable tiles and keep exporting remaining layers.
      }
    }
  }));

  return canvas;
}

export function drawLeafletMarkersToCanvas(ctx: CanvasRenderingContext2D, mapEl: HTMLElement): void {
  const mapRect = mapEl.getBoundingClientRect();
  const markers = Array.from(mapEl.querySelectorAll<HTMLElement>(".leaflet-marker-pane .leaflet-marker-icon"));

  markers.forEach((marker) => {
    const rect = marker.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const centerX = rect.left + rect.width / 2 - mapRect.left;
    const centerY = rect.top + rect.height / 2 - mapRect.top;
    const radius = Math.min(rect.width, rect.height) / 2;

    const outer = marker.firstElementChild instanceof HTMLElement ? marker.firstElementChild : marker;
    const outerStyles = getComputedStyle(outer);
    const background = outerStyles.backgroundColor || "#0062ae";
    const border = outerStyles.borderColor || "#ffffff";
    const lineWidth = Number.parseFloat(outerStyles.borderWidth || "0") || 3;

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = background;
    ctx.fill();

    if (lineWidth > 0) {
      ctx.strokeStyle = border;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }

    const inner = outer.firstElementChild instanceof HTMLElement ? outer.firstElementChild : null;
    if (inner) {
      const innerStyles = getComputedStyle(inner);
      const innerRadius = (Number.parseFloat(innerStyles.width || "0") || radius * 0.6) / 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
      ctx.fillStyle = innerStyles.backgroundColor || "#ffffff";
      ctx.fill();
    }

    ctx.restore();
  });
}

export function drawLeafletCanvasOverlayToCanvas(ctx: CanvasRenderingContext2D, mapEl: HTMLElement): void {
  const overlayCanvases = Array.from(
    mapEl.querySelectorAll<HTMLCanvasElement>(".leaflet-overlay-pane canvas")
  );
  if (!overlayCanvases.length) return;

  overlayCanvases.forEach((overlayCanvas) => {
    const offset = getTranslateOffset(overlayCanvas, mapEl);
    try {
      ctx.drawImage(
        overlayCanvas,
        offset.x,
        offset.y,
        overlayCanvas.offsetWidth,
        overlayCanvas.offsetHeight
      );
    } catch {
      // Best-effort only.
    }
  });
}

export async function rasterizeLeafletSvgOverlay(
  mapEl: HTMLElement
): Promise<{ img: HTMLImageElement | HTMLCanvasElement; x: number; y: number; w: number; h: number } | null> {
  const overlaySvgs = Array.from(
    mapEl.querySelectorAll<SVGSVGElement>(".leaflet-overlay-pane svg")
  ).filter((svg) => svg.childElementCount > 0);
  if (!overlaySvgs.length) return null;

  const mapRect = mapEl.getBoundingClientRect();

  async function rasterizeSingleSvg(
    overlaySvg: SVGSVGElement
  ): Promise<{ img: HTMLImageElement; x: number; y: number; w: number; h: number }> {
    const rect = overlaySvg.getBoundingClientRect();
    const clone = overlaySvg.cloneNode(true);
    if (!(clone instanceof SVGSVGElement)) {
      throw new Error("SVG overlay clone failed");
    }

    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.style.transform = "none";

    const svg = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("SVG overlay export failed"));
        img.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }

    return {
      img,
      x: rect.left - mapRect.left,
      y: rect.top - mapRect.top,
      w: rect.width,
      h: rect.height,
    };
  }

  if (overlaySvgs.length === 1) {
    return rasterizeSingleSvg(overlaySvgs[0]);
  }

  const composed = document.createElement("canvas");
  composed.width = Math.max(1, Math.round(mapRect.width));
  composed.height = Math.max(1, Math.round(mapRect.height));
  const composedCtx = composed.getContext("2d");
  if (!composedCtx) return null;

  for (const overlaySvg of overlaySvgs) {
    const rendered = await rasterizeSingleSvg(overlaySvg);
    composedCtx.drawImage(rendered.img, rendered.x, rendered.y, rendered.w, rendered.h);
  }

  return {
    img: composed,
    x: 0,
    y: 0,
    w: composed.width,
    h: composed.height,
  };
}

export async function drawLeafletTooltipsToCanvas(
  ctx: CanvasRenderingContext2D,
  mapEl: HTMLElement
): Promise<void> {
  const tooltipPane = mapEl.querySelector<HTMLElement>(".leaflet-tooltip-pane");
  if (!tooltipPane || tooltipPane.childElementCount === 0) return;

  const mapRect = mapEl.getBoundingClientRect();
  const tooltips = Array.from(tooltipPane.querySelectorAll<HTMLElement>(".leaflet-tooltip"));

  tooltips.forEach((tooltip) => {
    const tooltipRect = tooltip.getBoundingClientRect();
    if (tooltipRect.width === 0 || tooltipRect.height === 0) return;

    const tooltipStyles = getComputedStyle(tooltip);
    if (tooltipStyles.display === "none" || tooltipStyles.visibility === "hidden") return;

    const x = tooltipRect.left - mapRect.left;
    const y = tooltipRect.top - mapRect.top;
    const width = tooltipRect.width;
    const height = tooltipRect.height;
    const radius = parsePx(tooltipStyles.borderTopLeftRadius, 4);
    const borderWidth = parsePx(tooltipStyles.borderTopWidth, 1);
    const opacity = Number.parseFloat(tooltipStyles.opacity || "1");
    const tooltipFontSize = parsePx(tooltipStyles.fontSize, 9);

    ctx.save();
    ctx.globalAlpha = Number.isFinite(opacity) ? opacity : 1;

    if (tooltipStyles.boxShadow && tooltipStyles.boxShadow !== "none") {
      ctx.shadowColor = "rgba(0, 0, 0, 0.08)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;
      fillRoundedRect(
        ctx,
        x,
        y,
        width,
        height,
        radius,
        tooltipStyles.backgroundColor || "rgba(255,255,255,0.92)"
      );
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }

    fillRoundedRect(
      ctx,
      x,
      y,
      width,
      height,
      radius,
      tooltipStyles.backgroundColor || "rgba(255,255,255,0.92)",
      tooltipStyles.borderTopColor || "rgba(0,0,0,0.08)",
      borderWidth
    );

    Array.from(tooltip.childNodes).forEach((node) => {
      const textRect = getTextNodeRect(node);
      if (textRect) {
        const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
        if (!text) return;

        ctx.save();
        ctx.font = buildCanvasFont(tooltipStyles);
        ctx.fillStyle = tooltipStyles.color || "#1a1a1a";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const textY = textRect.top - mapRect.top + Math.max(0, (textRect.height - tooltipFontSize) / 2);
        ctx.fillText(text, textRect.left - mapRect.left, textY);
        ctx.restore();
        return;
      }

      if (!(node instanceof HTMLElement) || !node.classList.contains("tt-badge")) return;

      const badgeRect = node.getBoundingClientRect();
      if (badgeRect.width === 0 || badgeRect.height === 0) return;

      const badgeStyles = getComputedStyle(node);
      const badgeX = badgeRect.left - mapRect.left;
      const badgeY = badgeRect.top - mapRect.top;
      const badgeRadius = parsePx(badgeStyles.borderTopLeftRadius, 7);

      ctx.save();
      fillRoundedRect(
        ctx,
        badgeX,
        badgeY,
        badgeRect.width,
        badgeRect.height,
        badgeRadius,
        badgeStyles.backgroundColor || "#003ca6"
      );
      ctx.font = buildCanvasFont(badgeStyles);
      ctx.fillStyle = badgeStyles.color || "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.textContent?.trim() ?? "", badgeX + badgeRect.width / 2, badgeY + badgeRect.height / 2);
      ctx.restore();
    });

    ctx.restore();
  });
}

export async function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Export PNG impossible");

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
