"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { Transaction } from "@/lib/types";
import { X } from "lucide-react";

const PALETTE = [
  "#0062ae", "#4a90d9", "#7eb8e5", "#003d6b", "#0091d5",
  "#2d8c5a", "#e67e22", "#8e44ad", "#c0392b", "#16a085",
  "#f39c12", "#2c3e50", "#d35400", "#1abc9c", "#7f8c8d",
  "#e74c3c", "#3498db",
];

function fmt(v: number) { return Math.round(v).toLocaleString("fr-FR"); }

interface AnalyticsPanelProps {
  open: boolean;
  onClose: () => void;
  data: Transaction[];
}

export default function AnalyticsPanel({ open, onClose, data }: AnalyticsPanelProps) {
  const rentRef = useRef<SVGSVGElement>(null);
  const enseigneRef = useRef<SVGSVGElement>(null);
  const keyMoneyRef = useRef<SVGSVGElement>(null);
  const volumeRef = useRef<SVGSVGElement>(null);
  const surfaceRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!open || !data.length) return;
    const t = setTimeout(() => {
      renderRentChart(rentRef.current, data);
      renderEnseigneChart(enseigneRef.current, data);
      renderKeyMoneyChart(keyMoneyRef.current, data);
      renderVolumeChart(volumeRef.current, data);
      renderSurfaceChart(surfaceRef.current, data);
    }, 100);
    return () => clearTimeout(t);
  }, [open, data]);

  return (
    <div className={`fixed top-[var(--bar-h)] right-0 bottom-0 w-[620px] max-w-[90vw] bg-white border-l border-border shadow-[-8px_0_40px_rgba(0,0,0,.1)] z-[950] flex flex-col transition-transform duration-350 ease-[cubic-bezier(.4,0,.2,1)] ${open ? "translate-x-0" : "translate-x-full"}`}>
      <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
        <h2 className="text-sm font-bold">Analyse des Transactions</h2>
        <button onClick={onClose} className="text-text-tertiary hover:text-foreground transition-colors p-1 rounded-md hover:bg-surface-hover">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-8">
        <ChartSection title="Loyer/m² pondéré">
          <svg ref={rentRef} className="w-full" style={{ height: 220 }} />
        </ChartSection>

        <ChartSection title="Répartition par Enseigne">
          <svg ref={enseigneRef} className="w-full" style={{ height: 280 }} />
        </ChartSection>

        <ChartSection title="Droit au Bail">
          <svg ref={keyMoneyRef} className="w-full" style={{ height: 220 }} />
        </ChartSection>

        <ChartSection title="Volume de Transactions">
          <svg ref={volumeRef} className="w-full" style={{ height: 200 }} />
        </ChartSection>

        <ChartSection title="Distribution des Surfaces">
          <svg ref={surfaceRef} className="w-full" style={{ height: 220 }} />
        </ChartSection>
      </div>
    </div>
  );
}

function ChartSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}

/* ─── Chart rendering functions ─── */

function renderRentChart(el: SVGSVGElement | null, data: Transaction[]) {
  if (!el) return;
  const svg = d3.select(el);
  svg.selectAll("*").remove();
  const w = el.clientWidth, h = 220;
  const m = { top: 20, right: 16, bottom: 36, left: 50 };

  const withWeightedRent = data.filter((t) => t.rentSqmWeighted != null);
  if (!withWeightedRent.length) { svg.append("text").attr("x", w / 2).attr("y", h / 2).attr("text-anchor", "middle").attr("fill", "#999").attr("font-size", 11).text("Aucune donnée"); return; }

  const byYear = d3.rollup(withWeightedRent, (v) => d3.mean(v, (t) => t.rentSqmWeighted ?? 0)!, (t) => t.year || "?");
  const entries = [...byYear.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const x = d3.scaleBand().domain(entries.map((e) => e[0])).range([m.left, w - m.right]).padding(0.3);
  const y = d3.scaleLinear().domain([0, d3.max(entries, (e) => e[1])! * 1.15]).range([h - m.bottom, m.top]);

  svg.append("g").attr("transform", `translate(0,${h - m.bottom})`).call(d3.axisBottom(x).tickSize(0)).selectAll("text").attr("font-size", 9);
  svg.append("g").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickFormat((d) => fmt(d as number))).selectAll("text").attr("font-size", 9);

  svg.selectAll("rect").data(entries).join("rect")
    .attr("x", (d) => x(d[0])!).attr("y", (d) => y(d[1]))
    .attr("width", x.bandwidth()).attr("height", (d) => h - m.bottom - y(d[1]))
    .attr("fill", PALETTE[0]).attr("rx", 3);

  svg.selectAll(".label").data(entries).join("text")
    .attr("x", (d) => x(d[0])! + x.bandwidth() / 2).attr("y", (d) => y(d[1]) - 4)
    .attr("text-anchor", "middle").attr("font-size", 9).attr("font-weight", 600).attr("fill", "#333")
    .text((d) => fmt(d[1]));

  const allVals = withWeightedRent.map((t) => t.rentSqmWeighted ?? 0).sort(d3.ascending);
  const median = d3.median(allVals)!;
  svg.append("line").attr("x1", m.left).attr("x2", w - m.right)
    .attr("y1", y(median)).attr("y2", y(median))
    .attr("stroke", "#c0392b").attr("stroke-dasharray", "5 3").attr("stroke-width", 1.5);
}

function renderEnseigneChart(el: SVGSVGElement | null, data: Transaction[]) {
  if (!el) return;
  const svg = d3.select(el);
  svg.selectAll("*").remove();
  const w = el.clientWidth, h = 280;

  const counts = d3.rollup(data, (v) => v.length, (t) => t.enseigne || t.newTenant || "?");
  let entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = d3.sum(entries, (e) => e[1]);
  const threshold = total * 0.03;
  const main = entries.filter((e) => e[1] >= threshold);
  const others = entries.filter((e) => e[1] < threshold);
  if (others.length) main.push(["Autres", d3.sum(others, (e) => e[1])]);
  entries = main;

  const r = Math.min(w * 0.3, h * 0.4);
  const arc = d3.arc<d3.PieArcDatum<[string, number]>>().innerRadius(r * 0.55).outerRadius(r);
  const pie = d3.pie<[string, number]>().value((d) => d[1]).sort(null);

  const g = svg.append("g").attr("transform", `translate(${w * 0.3},${h / 2})`);
  g.selectAll("path").data(pie(entries)).join("path")
    .attr("d", arc).attr("fill", (_, i) => PALETTE[i % PALETTE.length]);

  g.append("text").attr("text-anchor", "middle").attr("dy", "-0.2em").attr("font-size", 18).attr("font-weight", 700).text(String(total));
  g.append("text").attr("text-anchor", "middle").attr("dy", "1.2em").attr("font-size", 9).attr("fill", "#888").text("transactions");

  const legend = svg.append("g").attr("transform", `translate(${w * 0.62},${20})`);
  entries.forEach(([name, count], i) => {
    const row = legend.append("g").attr("transform", `translate(0,${i * 20})`);
    row.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", PALETTE[i % PALETTE.length]);
    row.append("text").attr("x", 16).attr("y", 9).attr("font-size", 10).attr("fill", "#333").text(`${name} (${count})`);
  });
}

function renderKeyMoneyChart(el: SVGSVGElement | null, data: Transaction[]) {
  if (!el) return;
  const svg = d3.select(el);
  svg.selectAll("*").remove();
  const w = el.clientWidth, h = 220;
  const m = { top: 20, right: 16, bottom: 20, left: 130 };

  const withDab = data.filter((t) => t.keyMoney != null && t.keyMoney > 0);
  if (!withDab.length) { svg.append("text").attr("x", w / 2).attr("y", h / 2).attr("text-anchor", "middle").attr("fill", "#999").attr("font-size", 11).text("Aucune donnée"); return; }

  const byStreet = d3.rollup(withDab, (v) => d3.mean(v, (t) => t.keyMoney!)!, (t) => t.street || "?");
  const entries = [...byStreet.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const y = d3.scaleBand().domain(entries.map((e) => e[0])).range([m.top, h - m.bottom]).padding(0.25);
  const x = d3.scaleLinear().domain([0, d3.max(entries, (e) => e[1])! * 1.1]).range([m.left, w - m.right]);

  svg.append("g").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).tickSize(0)).selectAll("text").attr("font-size", 9).each(function () {
    const el = this as SVGTextElement;
    if (el.getComputedTextLength() > 120) {
      el.textContent = el.textContent!.slice(0, 18) + "…";
    }
  });

  svg.selectAll("rect").data(entries).join("rect")
    .attr("x", m.left).attr("y", (d) => y(d[0])!)
    .attr("width", (d) => x(d[1]) - m.left).attr("height", y.bandwidth())
    .attr("fill", PALETTE[0]).attr("rx", 3);

  svg.selectAll(".val").data(entries).join("text")
    .attr("x", (d) => x(d[1]) + 4).attr("y", (d) => y(d[0])! + y.bandwidth() / 2)
    .attr("dy", "0.35em").attr("font-size", 9).attr("font-weight", 600).attr("fill", "#333")
    .text((d) => fmt(d[1]) + " €");
}

function renderVolumeChart(el: SVGSVGElement | null, data: Transaction[]) {
  if (!el) return;
  const svg = d3.select(el);
  svg.selectAll("*").remove();
  const w = el.clientWidth, h = 200;
  const m = { top: 20, right: 16, bottom: 36, left: 40 };

  const byYear = d3.rollup(data, (v) => v.length, (t) => t.year || "?");
  const entries = [...byYear.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (!entries.length) return;

  const x = d3.scaleBand().domain(entries.map((e) => e[0])).range([m.left, w - m.right]).padding(0.3);
  const y = d3.scaleLinear().domain([0, d3.max(entries, (e) => e[1])! * 1.15]).range([h - m.bottom, m.top]);

  svg.append("g").attr("transform", `translate(0,${h - m.bottom})`).call(d3.axisBottom(x).tickSize(0)).selectAll("text").attr("font-size", entries.length > 15 ? 7 : 9).attr("transform", entries.length > 15 ? "rotate(-45)" : "").style("text-anchor", entries.length > 15 ? "end" : "middle");
  svg.append("g").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("d"))).selectAll("text").attr("font-size", 9);

  svg.selectAll("rect").data(entries).join("rect")
    .attr("x", (d) => x(d[0])!).attr("y", (d) => y(d[1]))
    .attr("width", x.bandwidth()).attr("height", (d) => h - m.bottom - y(d[1]))
    .attr("fill", PALETTE[0]).attr("rx", 3);

  svg.selectAll(".label").data(entries).join("text")
    .attr("x", (d) => x(d[0])! + x.bandwidth() / 2).attr("y", (d) => y(d[1]) - 4)
    .attr("text-anchor", "middle").attr("font-size", 9).attr("font-weight", 600).attr("fill", "#333")
    .text((d) => String(d[1]));
}

function renderSurfaceChart(el: SVGSVGElement | null, data: Transaction[]) {
  if (!el) return;
  const svg = d3.select(el);
  svg.selectAll("*").remove();
  const w = el.clientWidth, h = 220;
  const m = { top: 20, right: 16, bottom: 36, left: 50 };

  const vals = data.map((t) => t.totalSurfaceSqm).filter((v): v is number => v != null && v > 0).sort(d3.ascending);
  if (!vals.length) { svg.append("text").attr("x", w / 2).attr("y", h / 2).attr("text-anchor", "middle").attr("fill", "#999").attr("font-size", 11).text("Aucune donnée"); return; }

  const p99 = d3.quantile(vals, 0.99)!;
  const filtered = vals.filter((v) => v <= p99);
  const binGen = d3.bin().domain([0, p99]).thresholds(d3.range(0, p99, 50));
  const bins = binGen(filtered);

  const x = d3.scaleLinear().domain([0, p99]).range([m.left, w - m.right]);
  const y = d3.scaleLinear().domain([0, d3.max(bins, (b) => b.length)! * 1.15]).range([h - m.bottom, m.top]);

  svg.append("g").attr("transform", `translate(0,${h - m.bottom})`).call(d3.axisBottom(x).ticks(8).tickFormat((d) => fmt(d as number))).selectAll("text").attr("font-size", 9);
  svg.append("g").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("d"))).selectAll("text").attr("font-size", 9);

  svg.selectAll("rect").data(bins).join("rect")
    .attr("x", (d) => x(d.x0!)).attr("y", (d) => y(d.length))
    .attr("width", (d) => Math.max(0, x(d.x1!) - x(d.x0!) - 1)).attr("height", (d) => h - m.bottom - y(d.length))
    .attr("fill", PALETTE[0]).attr("rx", 1);

  const median = d3.median(filtered)!;
  svg.append("line").attr("x1", x(median)).attr("x2", x(median))
    .attr("y1", m.top).attr("y2", h - m.bottom)
    .attr("stroke", "#c0392b").attr("stroke-dasharray", "5 3").attr("stroke-width", 1.5);
  svg.append("text").attr("x", x(median) + 4).attr("y", m.top + 10)
    .attr("font-size", 9).attr("fill", "#c0392b").attr("font-weight", 600)
    .text(`Médiane: ${fmt(median)} m²`);
}
