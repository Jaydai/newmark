"use client";

import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  color?: "blue" | "green" | "amber" | "red" | "purple";
}

const colorMap = {
  blue: { bg: "bg-blue-50", text: "text-blue-600", icon: "text-blue-500" },
  green: { bg: "bg-emerald-50", text: "text-emerald-600", icon: "text-emerald-500" },
  amber: { bg: "bg-amber-50", text: "text-amber-600", icon: "text-amber-500" },
  red: { bg: "bg-red-50", text: "text-red-600", icon: "text-red-500" },
  purple: { bg: "bg-violet-50", text: "text-violet-600", icon: "text-violet-500" },
};

export function StatCard({ label, value, subtitle, icon: Icon, color = "blue" }: StatCardProps) {
  const colors = colorMap[color];

  return (
    <div
      className={clsx(
        "rounded-xl bg-surface border border-border p-5",
        "shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]",
        "transition-all duration-200"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{label}</p>
          <p className={clsx("text-2xl font-bold tracking-tight", colors.text)}>{value}</p>
          {subtitle && <p className="text-xs text-text-tertiary mt-1">{subtitle}</p>}
        </div>
        <div className={clsx("rounded-lg p-2.5 shrink-0 ml-3", colors.bg)}>
          <Icon className={clsx("w-5 h-5", colors.icon)} />
        </div>
      </div>
    </div>
  );
}
