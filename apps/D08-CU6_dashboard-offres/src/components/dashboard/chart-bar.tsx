"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart-container";
import { CHART_COLORS, formatNumber } from "@/utils/format";
import type { Distribution } from "@/types/kpi";

interface ChartBarProps {
  title: string;
  data: Distribution[];
  maxItems?: number;
  layout?: "vertical" | "horizontal";
  suffix?: string;
}

function CustomTooltip({
  active,
  payload,
  suffix,
}: {
  active?: boolean;
  payload?: { value: number; payload: Distribution }[];
  suffix?: string;
}) {
  if (!active || !payload?.[0]) return null;
  const { name, value } = payload[0].payload;
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-[var(--shadow-lg)]">
      <p className="text-xs font-semibold text-foreground">{name}</p>
      <p className="text-sm text-accent font-bold">
        {formatNumber(value)}{suffix ? ` ${suffix}` : ""}
      </p>
    </div>
  );
}

export function ChartBar({ title, data, maxItems = 12, layout = "vertical", suffix }: ChartBarProps) {
  const chartData = data.slice(0, maxItems);

  if (layout === "horizontal") {
    const chartHeight = Math.max(300, chartData.length * 36);
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <ChartContainer height={chartHeight}>
          {(w, h) => (
            <BarChart data={chartData} layout="vertical" width={w} height={h} margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} tickFormatter={(v) => formatNumber(v)} />
              <YAxis
                type="category"
                dataKey="name"
                width={180}
                tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                tickFormatter={(v: string) => (v.length > 28 ? v.slice(0, 27) + "\u2026" : v)}
              />
              <Tooltip content={<CustomTooltip suffix={suffix} />} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24} label={{ position: "right", fontSize: 11, fontWeight: 600, fill: "var(--foreground)", formatter: ((v: number) => formatNumber(v) + (suffix ? ` ${suffix}` : "")) as never }}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ChartContainer>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <ChartContainer height={288}>
        {(w, h) => (
          <BarChart data={chartData} width={w} height={h} margin={{ left: 0, right: 8, top: 20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
              angle={-35}
              textAnchor="end"
              height={80}
              tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 17) + "\u2026" : v)}
            />
            <YAxis tick={{ fontSize: 11, fill: "var(--text-secondary)" }} tickFormatter={(v) => formatNumber(v)} />
            <Tooltip content={<CustomTooltip suffix={suffix} />} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40} label={{ position: "top", fontSize: 10, fontWeight: 600, fill: "var(--foreground)", formatter: ((v: number) => formatNumber(v)) as never }}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ChartContainer>
    </Card>
  );
}
