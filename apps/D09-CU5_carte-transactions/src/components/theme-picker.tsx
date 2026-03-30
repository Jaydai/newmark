"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Palette } from "lucide-react";

interface Channel {
  key: string;
  label: string;
  defaultColor: string;
}

const CHANNELS: Channel[] = [
  { key: "--map-green", label: "Secondaire", defaultColor: "#2d8c5a" },
  { key: "--map-blue", label: "Transactions", defaultColor: "#0062ae" },
  { key: "--primary", label: "UI / Boutons", defaultColor: "#000000" },
];

const STORAGE_KEY = "newmark-theme-colors";

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function darken(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex);
  const f = 1 - amount;
  return "#" + [r, g, b].map((c) => Math.round(c * f).toString(16).padStart(2, "0")).join("");
}

function applyChannel(key: string, hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const root = document.documentElement;
  root.style.setProperty(key, hex);
  root.style.setProperty(key + "-hover", darken(hex, 0.15));
  root.style.setProperty(key + "-10", `rgba(${r},${g},${b},.1)`);
  root.style.setProperty(key + "-08", `rgba(${r},${g},${b},.08)`);
  root.style.setProperty(key + "-04", `rgba(${r},${g},${b},.04)`);
  root.style.setProperty(key + "-25", `rgba(${r},${g},${b},.25)`);
}

export default function ThemePicker({ onThemeChange }: { onThemeChange?: () => void }) {
  const [open, setOpen] = useState(false);
  const [colors, setColors] = useState<Record<string, string>>({});
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved: Record<string, string> = raw ? JSON.parse(raw) : {};
      const initial: Record<string, string> = {};
      CHANNELS.forEach((ch) => {
        const hex = saved[ch.key] || ch.defaultColor;
        initial[ch.key] = hex;
        applyChannel(ch.key, hex);
      });
      setColors(initial);
    } catch {
      const initial: Record<string, string> = {};
      CHANNELS.forEach((ch) => {
        initial[ch.key] = ch.defaultColor;
        applyChannel(ch.key, ch.defaultColor);
      });
      setColors(initial);
    }
  }, []);

  const handleColorChange = useCallback(
    (key: string, hex: string) => {
      setColors((prev) => {
        const next = { ...prev, [key]: hex };
        applyChannel(key, hex);
        try {
          const toSave: Record<string, string> = {};
          for (const ch of CHANNELS) {
            if (next[ch.key] && next[ch.key] !== ch.defaultColor)
              toSave[ch.key] = next[ch.key];
          }
          if (Object.keys(toSave).length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        } catch {}
        onThemeChange?.();
        return next;
      });
    },
    [onThemeChange]
  );

  const handleReset = () => {
    CHANNELS.forEach((ch) => applyChannel(ch.key, ch.defaultColor));
    const initial: Record<string, string> = {};
    CHANNELS.forEach((ch) => { initial[ch.key] = ch.defaultColor; });
    setColors(initial);
    localStorage.removeItem(STORAGE_KEY);
    onThemeChange?.();
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="bg-transparent border-[1.5px] border-border-input rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary hover:border-black/40 hover:text-foreground transition-colors"
        title="Changer les couleurs"
      >
        <Palette className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Couleurs</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 z-[2500] mt-2 w-[min(280px,calc(100vw-1rem))] rounded-xl bg-white p-4 shadow-[0_12px_48px_rgba(0,0,0,.18),0_0_0_1px_rgba(0,0,0,.06)] sm:min-w-[220px] sm:w-auto">
          <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-3">
            Couleurs
          </div>
          {CHANNELS.map((ch) => (
            <div key={ch.key} className="flex items-center gap-2.5 mb-2.5 last:mb-0">
              <div
                className="w-8 h-8 rounded-lg border-2 border-black/[.08] shrink-0 relative overflow-hidden cursor-pointer"
                style={{ background: colors[ch.key] || ch.defaultColor }}
              >
                <input
                  type="color"
                  value={colors[ch.key] || ch.defaultColor}
                  onChange={(e) => handleColorChange(ch.key, e.target.value)}
                  className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] cursor-pointer opacity-0"
                />
              </div>
              <span className="text-xs font-semibold flex-1">{ch.label}</span>
              <span className="text-[10px] font-mono text-text-tertiary min-w-[62px] text-right">
                {colors[ch.key] || ch.defaultColor}
              </span>
            </div>
          ))}
          <button
            onClick={handleReset}
            className="mt-2.5 w-full py-1.5 border-[1.5px] border-border-input rounded-lg bg-transparent text-[10px] font-semibold text-text-secondary cursor-pointer hover:border-black/40 hover:text-foreground transition-colors"
          >
            Couleurs par défaut
          </button>
        </div>
      )}
    </div>
  );
}
