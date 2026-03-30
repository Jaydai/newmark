"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  directions,
  statusLabels,
  statusColors,
  typeLabels,
  type Direction,
  type Status,
} from "@/data/use-cases";

function StatusBadge({ status }: { status: Status }) {
  const c = statusColors[status];
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}
    >
      {statusLabels[status]}
    </span>
  );
}

function DirectionAccordion({ dir }: { dir: Direction }) {
  const [open, setOpen] = useState(false);

  const deployed = dir.useCases.filter((cu) => cu.status === "deployed").length;
  const total = dir.useCases.length;

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-surface-hover/50 transition-colors"
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${dir.color} 12%, transparent)` }}
        >
          <dir.icon className="w-4.5 h-4.5" style={{ color: dir.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-text-tertiary">{dir.id}</span>
            <span className="text-sm font-semibold text-foreground">{dir.name}</span>
          </div>
          <div className="text-[11px] text-text-secondary mt-0.5">
            {deployed}/{total} deployes — {total} cas d'usage
          </div>
        </div>

        {/* Progress mini-bar */}
        <div className="w-20 h-1.5 bg-surface-alt rounded-full overflow-hidden shrink-0">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(deployed / total) * 100}%`,
              background: dir.color,
            }}
          />
        </div>

        <ChevronDown
          className={`w-4 h-4 text-text-tertiary shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-border">
          {dir.useCases.map((cu) => (
            <div
              key={cu.id}
              className="flex items-center gap-3 px-5 py-3 border-b border-border/50 last:border-b-0"
            >
              <span className="text-[10px] font-bold text-text-tertiary w-8 shrink-0">
                {cu.id}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">
                  {cu.name}
                </div>
                <div className="text-[11px] text-text-secondary truncate">
                  {cu.description}
                </div>
              </div>
              <span className="text-[10px] font-medium text-text-tertiary px-1.5 py-0.5 rounded bg-surface-alt shrink-0">
                {typeLabels[cu.type]}
              </span>
              <StatusBadge status={cu.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Directions() {
  // Stats
  const allCUs = directions.flatMap((d) => d.useCases);
  const counts: Record<Status, number> = {
    deployed: 0,
    in_progress: 0,
    planned: 0,
    blocked: 0,
    not_feasible: 0,
  };
  allCUs.forEach((cu) => counts[cu.status]++);

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <h2 className="text-xl font-bold text-foreground mb-1">Tous les cas d'usage</h2>
      <p className="text-sm text-text-secondary mb-6">
        8 directions, 52 cas d'usage — cliquez pour voir le detail
      </p>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        {(
          [
            { status: "deployed" as Status, label: "Deployes" },
            { status: "in_progress" as Status, label: "En cours" },
            { status: "planned" as Status, label: "A faire" },
            { status: "blocked" as Status, label: "En attente" },
            { status: "not_feasible" as Status, label: "Non realisables" },
          ] as const
        ).map((s) => (
          <div key={s.status} className="bg-white rounded-lg border border-border p-3 text-center">
            <div
              className="text-2xl font-bold"
              style={{ color: statusColors[s.status].text }}
            >
              {counts[s.status]}
            </div>
            <div className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium mt-0.5">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="flex h-2.5 rounded-full overflow-hidden mb-8 bg-surface-alt">
        {["deployed", "in_progress", "planned", "blocked", "not_feasible"].map((s) => {
          const pct = (counts[s as Status] / allCUs.length) * 100;
          if (pct === 0) return null;
          const colors: Record<string, string> = {
            deployed: "#22c55e",
            in_progress: "#eab308",
            planned: "#94a3b8",
            blocked: "#ef4444",
            not_feasible: "#d1d5db",
          };
          return (
            <div
              key={s}
              className="h-full transition-all"
              style={{ width: `${pct}%`, background: colors[s] }}
              title={`${statusLabels[s as Status]}: ${counts[s as Status]}`}
            />
          );
        })}
      </div>

      {/* Accordions */}
      <div className="space-y-3">
        {directions.map((dir) => (
          <DirectionAccordion key={dir.id} dir={dir} />
        ))}
      </div>
    </section>
  );
}
