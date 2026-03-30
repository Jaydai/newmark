"use client";

import { agents } from "@/data/agents";
import { statusLabels, statusColors } from "@/data/use-cases";
import { ExternalLink } from "lucide-react";

export default function AgentsGrid() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {agents.map((agent) => {
          const sc = statusColors[agent.status];
          return (
            <div
              key={agent.id}
              className="bg-white rounded-xl border border-border p-6 shadow-sm"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: `color-mix(in srgb, ${agent.color} 12%, transparent)`,
                    }}
                  >
                    <agent.icon
                      className="w-5 h-5"
                      style={{ color: agent.color }}
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-text-tertiary">
                      {agent.id}
                    </span>
                    <h3 className="text-sm font-bold text-foreground">
                      {agent.name}
                    </h3>
                  </div>
                </div>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{ background: sc.bg, color: sc.text }}
                >
                  {statusLabels[agent.status]}
                </span>
              </div>

              <p className="text-xs text-text-secondary leading-relaxed mb-4">
                {agent.description}
              </p>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {agent.tech.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] font-medium text-text-tertiary px-2 py-0.5 rounded-md bg-surface-alt"
                  >
                    {t}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
                  {agent.direction} — {agent.directionName}
                </span>
                {agent.url ? (
                  <a
                    href={agent.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-primary transition-colors no-underline"
                  >
                    Lancer
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-tertiary cursor-not-allowed">
                    Lancer
                    <ExternalLink className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
