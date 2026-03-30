"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart-container";
import { formatNumber } from "@/utils/format";

interface ChartStackedBarProps {
  title: string;
  data: { sector: string; direct: number; confreres: number }[];
  maxItems?: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-[var(--shadow-lg)]">
      <p className="text-xs font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs" style={{ color: p.color }}>
          {p.name}: {formatNumber(p.value)}
        </p>
      ))}
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function ChartStackedBar({
  title,
  data,
  maxItems = 12,
}: ChartStackedBarProps) {
  const chartData = data.slice(0, maxItems).map((d) => ({
    name:
      d.sector.length > 28 ? d.sector.slice(0, 27) + "\u2026" : d.sector,
    Directes: d.direct,
    "Confrères": d.confreres,
  }));
  const chartHeight = Math.max(300, chartData.length * 36);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <ChartContainer height={chartHeight}>
        {(w, h) => (
          <BarChart
            data={chartData}
            layout="vertical"
            width={w}
            height={h}
            margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              tickFormatter={(v) => formatNumber(v)}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={180}
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="Directes"
              stackId="a"
              fill="#002855"
              maxBarSize={24}
            />
            <Bar
              dataKey="Confrères"
              stackId="a"
              fill="#0066cc"
              radius={[0, 4, 4, 0]}
              maxBarSize={24}
            />
          </BarChart>
        )}
      </ChartContainer>
    </Card>
  );
}
