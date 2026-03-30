"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  AreaChart,
  LabelList,
} from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart-container";
import { formatNumber } from "@/utils/format";
import type { MonthlyDataPoint } from "@/types/kpi";

interface ChartLineProps {
  title: string;
  data: MonthlyDataPoint[];
  color?: string;
  suffix?: string;
  filled?: boolean;
}

function CustomTooltip({
  active,
  payload,
  suffix,
}: {
  active?: boolean;
  payload?: { value: number; payload: MonthlyDataPoint }[];
  suffix?: string;
}) {
  if (!active || !payload?.[0]) return null;
  const { label, value } = payload[0].payload;
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-[var(--shadow-lg)]">
      <p className="text-xs font-semibold text-foreground">{label}</p>
      <p className="text-sm text-accent font-bold">
        {formatNumber(value)}
        {suffix ? ` ${suffix}` : ""}
      </p>
    </div>
  );
}

function renderLabel(suffix?: string) {
  return function CustomLabel(props: {
    x?: number;
    y?: number;
    value?: number;
  }) {
    const { x, y, value } = props;
    if (x == null || y == null || value == null) return null;
    return (
      <text
        x={x}
        y={y - 12}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="var(--foreground)"
      >
        {formatNumber(value)}
        {suffix ?? ""}
      </text>
    );
  };
}

export function ChartLine({
  title,
  data,
  color = "#0066cc",
  suffix,
  filled,
}: ChartLineProps) {
  const gradientId = `gradient-${color.replace("#", "")}`;
  const Label = renderLabel(suffix);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <ChartContainer height={300}>
        {(w, h) =>
          filled ? (
            <AreaChart
              data={data}
              width={w}
              height={h}
              margin={{ left: 8, right: 24, top: 24, bottom: 4 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                angle={-35}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                tickFormatter={(v) => formatNumber(v)}
              />
              <Tooltip content={<CustomTooltip suffix={suffix} />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={{ r: 4, fill: color, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              >
                <LabelList content={<Label />} />
              </Area>
            </AreaChart>
          ) : (
            <LineChart
              data={data}
              width={w}
              height={h}
              margin={{ left: 8, right: 24, top: 24, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                angle={-35}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                tickFormatter={(v) => formatNumber(v)}
              />
              <Tooltip content={<CustomTooltip suffix={suffix} />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={{ r: 4, fill: color, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              >
                <LabelList content={<Label />} />
              </Line>
            </LineChart>
          )
        }
      </ChartContainer>
    </Card>
  );
}
