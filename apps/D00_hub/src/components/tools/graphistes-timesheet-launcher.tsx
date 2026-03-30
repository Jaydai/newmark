"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { ArrowRight, Database, ExternalLink, ShieldCheck } from "lucide-react";

const configuredUrl =
  process.env.NEXT_PUBLIC_GRAPHISTES_TIMESHEET_URL?.trim() || "";

function resolveTargetUrl() {
  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window === "undefined") {
    return null;
  }

  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    return "http://localhost:3013";
  }

  return null;
}

export default function GraphistesTimesheetLauncher() {
  const targetUrl = useMemo(resolveTargetUrl, []);

  useEffect(() => {
    if (!targetUrl) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      window.location.assign(targetUrl);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [targetUrl]);

  return (
    <section className="max-w-4xl mx-auto px-6 py-16">
      <div className="rounded-[28px] border border-border bg-white shadow-sm overflow-hidden">
        <div className="px-8 py-8 bg-[linear-gradient(135deg,rgba(21,45,71,0.98),rgba(31,71,110,0.94))] text-white">
          <p className="text-[11px] font-extrabold tracking-[0.22em] uppercase text-pink-300 mb-3">
            D06 / CU8
          </p>
          <h1 className="text-3xl font-bold mb-3">
            Feuilles de temps graphistes
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-100/90">
            L&apos;outil n&apos;est plus embarque dans le hub statique. Il est
            maintenant servi par une miniapp Next dediee avec API Node, base
            SQLite partagee et controle d&apos;acces Microsoft.
          </p>
        </div>

        <div className="px-8 py-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Database className="w-5 h-5 mt-0.5 text-pink-500" />
              <div>
                <p className="font-semibold text-foreground">
                  Persistance serveur
                </p>
                <p className="text-sm text-text-secondary leading-6">
                  Les projets, graphistes et saisies sont centralises dans une
                  SQLite partagee, et non plus dans le navigateur.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 mt-0.5 text-pink-500" />
              <div>
                <p className="font-semibold text-foreground">
                  Miniapp dediee
                </p>
                <p className="text-sm text-text-secondary leading-6">
                  Le suivi du temps est maintenant servi par une app Next
                  separee pour permettre une vraie persistance partagee.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-pink-200 bg-pink-50/60 p-5 space-y-4">
            {targetUrl ? (
              <>
                <p className="text-sm font-semibold text-foreground">Redirection vers la miniapp...</p>
                <p className="text-sm leading-6 text-text-secondary break-all">{targetUrl}</p>
                <Link
                  href={targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-full bg-[#10253f] text-white text-sm font-semibold"
                >
                  Ouvrir la miniapp
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-foreground">Deploiement en cours</p>
                <p className="text-sm leading-6 text-text-secondary">
                  Cette miniapp necessite un serveur Node.js et sera disponible prochainement.
                </p>
                <span className="inline-flex items-center gap-2 px-4 py-3 rounded-full bg-white text-[#10253f] text-sm font-semibold border border-border">
                  Bientot disponible
                  <ArrowRight className="w-4 h-4" />
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
