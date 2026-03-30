"use client";

import { deployedApps } from "@/data/use-cases";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

export default function AppsGrid() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <h2 className="text-xl font-bold text-foreground mb-1">Applications et outils disponibles</h2>
      <p className="text-sm text-text-secondary mb-6">
        Acces direct aux outils disponibles
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {deployedApps.map((app) => (
          <Link
            key={app.name}
            href={app.href}
            target={app.access === "external" ? "_blank" : undefined}
            rel={app.access === "external" ? "noopener noreferrer" : undefined}
            className="group bg-white rounded-xl border border-border p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 no-underline"
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center"
                style={{ background: `color-mix(in srgb, ${app.color} 12%, transparent)` }}
              >
                <app.icon className="w-5 h-5" style={{ color: app.color }} />
              </div>
              {app.access === "external" ? (
                <ExternalLink className="w-4 h-4 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
              ) : (
                <ArrowRight className="w-4 h-4 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1 group-hover:text-accent transition-colors">
              {app.name}
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              {app.description}
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
                {app.direction}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
