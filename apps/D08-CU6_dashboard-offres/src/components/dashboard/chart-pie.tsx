"use client";

import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart-container";
import { CHART_COLORS, formatNumber } from "@/utils/format";
import type { Distribution } from "@/types/kpi";

interface ChartPieProps {
  title: string;
  data: Distribution[];
  maxItems?: number;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value: number; payload: Distribution & { percent: number } }[];
}) {
  if (!active || !payload?.[0]) return null;
  const item = payload[0].payload;
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-[var(--shadow-lg)]">
      <p className="text-xs font-semibold text-foreground">{item.name}</p>
      <p className="text-sm text-accent font-bold">{formatNumber(item.value)}</p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderLegend(props: any) {
  const { payload } = props as { payload?: readonly { value: string; color: string }[] };
  if (!payload) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2 px-2">
      {payload.map((entry, i) => (
        <span key={i} className="flex items-center gap-1.5 text-xs text-text-secondary">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          {entry.value.length > 24 ? entry.value.slice(0, 23) + "\u2026" : entry.value}
        </span>
      ))}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function renderLabel(props: any) {
  const { cx, cy, midAngle, outerRadius, value, percent } = props as {
    cx: number;
    cy: number;
    midAngle: number;
    outerRadius: number;
    value: number;
    percent: number;
  };
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 22;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  // Skip tiny slices
  if (percent < 0.03) return null;

  return (
    <text
      x={x}
      y={y}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
      fill="var(--foreground)"
    >
      {formatNumber(value)} ({Math.round(percent * 100)}%)
    </text>
  );
}

export function ChartPie({ title, data, maxItems = 8 }: ChartPieProps) {
  // Group smaller items into "Autres"
  const sorted = [...data].sort((a, b) => b.value - a.value);
  let chartData: Distribution[];
  if (sorted.length > maxItems) {
    const top = sorted.slice(0, maxItems - 1);
    const rest = sorted.slice(maxItems - 1);
    const otherValue = rest.reduce((s, d) => s + d.value, 0);
    chartData = [...top, { name: "Autres", value: otherValue }];
  } else {
    chartData = sorted;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <ChartContainer height={310}>
        {(w, h) => (
          <PieChart width={w} height={h}>
            <Pie
              data={chartData}
              cx="50%"
              cy="42%"
              innerRadius={50}
              outerRadius={85}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              stroke="none"
              label={renderLabel}
              labelLine={false}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={renderLegend} />
          </PieChart>
        )}
      </ChartContainer>
    </Card>
  );
}
