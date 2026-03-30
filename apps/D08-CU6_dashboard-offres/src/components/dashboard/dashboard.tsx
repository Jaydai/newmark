"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useMsal } from "@azure/msal-react";
import {
  Building2,
  FileSpreadsheet,
  Archive,
  Users,
  Upload,
  LogOut,
  TrendingUp,
  Percent,
} from "lucide-react";
import { clsx } from "clsx";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { ChartBar } from "./chart-bar";
import { ChartPie } from "./chart-pie";
import { ChartLine } from "./chart-line";
import { ChartStackedBar } from "./chart-stacked-bar";
import { DataTable } from "./data-table";
import { SECTOR_TABS } from "@/utils/tab-config";
import {
  getMonthRange,
  getRefDate,
  newOffersPerMonth,
  updatedOffersPerMonth,
  updateRatePerMonth,
  archivedPerMonth,
  directVsConfreres,
  offersByCompany,
  countBy,
  directConfreresBySector,
  snapshotActiveEvolution,
  snapshotNewOffers,
  snapshotUpdatedOffers,
  snapshotUpdateRate,
  snapshotArchivedEvolution,
  filterSnapshots,
} from "@/utils/compute";
import type { DashboardData, OfferRow, FileSnapshot } from "@/types/kpi";
import { formatNumber, formatDate } from "@/utils/format";

interface DashboardProps {
  data: DashboardData;
  onReset: () => void;
}

export function Dashboard({ data, onReset }: DashboardProps) {
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  const [monthsFilter, setMonthsFilter] = useState<3 | 12>(12);

  const isMultiFile = data.snapshots.length > 1;

  const refDate = useMemo(
    () => getRefDate(data.activeOffers),
    [data.activeOffers],
  );
  const monthRange = useMemo(
    () => getMonthRange(monthsFilter, refDate),
    [monthsFilter, refDate],
  );

  const filteredSnapshots = useMemo(() => {
    if (!isMultiFile) return data.snapshots;
    const monthKeys = new Set(monthRange.map((m) => m.month));
    return data.snapshots.filter((s) => monthKeys.has(s.monthKey));
  }, [data.snapshots, monthRange, isMultiFile]);

  const handleLogout = () => instance.logoutRedirect();

  const fileLabel = useMemo(() => {
    if (data.snapshots.length === 1) return data.snapshots[0].fileName;
    return `${data.snapshots.length} fichiers`;
  }, [data.snapshots]);

  const tabList = useMemo(
    () =>
      SECTOR_TABS.map((t) => ({
        id: t.id,
        label: t.label,
        count:
          t.id === "global"
            ? undefined
            : data.activeOffers.filter(t.filter).length,
      })),
    [data.activeOffers],
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/newmark-logo.svg"
              alt="Newmark"
              width={140}
              height={32}
              priority
              className="h-7 w-auto"
            />
            <div className="h-6 w-px bg-border" />
            <span className="text-sm font-semibold text-text-secondary">
              Tableau de bord KPI
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5 bg-surface-hover rounded-lg p-0.5">
              <button
                onClick={() => setMonthsFilter(3)}
                className={clsx(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  monthsFilter === 3
                    ? "bg-surface shadow-[var(--shadow-sm)] text-foreground"
                    : "text-text-secondary hover:text-foreground",
                )}
              >
                3 mois
              </button>
              <button
                onClick={() => setMonthsFilter(12)}
                className={clsx(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  monthsFilter === 12
                    ? "bg-surface shadow-[var(--shadow-sm)] text-foreground"
                    : "text-text-secondary hover:text-foreground",
                )}
              >
                12 mois
              </button>
            </div>
            <span className="text-xs text-text-tertiary hidden md:block">
              {account && <>{account.name || account.username} &middot; </>}
              {fileLabel} &mdash; {formatDate(data.parsedAt)}
            </span>
            <button
              onClick={onReset}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-border hover:bg-surface-hover text-text-secondary hover:text-foreground"
            >
              <Upload className="w-3.5 h-3.5" />
              Nouveau fichier
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-surface-hover text-text-secondary hover:text-foreground"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <Tabs tabs={tabList} defaultTab="global">
          {(activeTab) => {
            const tabConfig = SECTOR_TABS.find((t) => t.id === activeTab)!;
            const isGlobal = activeTab === "global";
            const filteredActive = data.activeOffers.filter(tabConfig.filter);
            const filteredArchived = data.archivedOffers.filter(
              tabConfig.filter,
            );
            const tabSnapshots = isGlobal
              ? filteredSnapshots
              : filterSnapshots(filteredSnapshots, tabConfig.filter);

            return (
              <TabContent
                active={filteredActive}
                archived={filteredArchived}
                snapshots={tabSnapshots}
                monthRange={monthRange}
                isMultiFile={isMultiFile}
                isGlobal={isGlobal}
              />
            );
          }}
        </Tabs>
      </main>
    </div>
  );
}

/* ─── Unified tab content ─── */

interface TabContentProps {
  active: OfferRow[];
  archived: OfferRow[];
  snapshots: FileSnapshot[];
  monthRange: { month: string; label: string }[];
  isMultiFile: boolean;
  isGlobal: boolean;
}

function TabContent({
  active,
  archived,
  snapshots,
  monthRange,
  isMultiFile,
  isGlobal,
}: TabContentProps) {
  /* ── Evolution data ── */
  const activeEvolution = useMemo(
    () => (isMultiFile ? snapshotActiveEvolution(snapshots) : null),
    [snapshots, isMultiFile],
  );
  const newPerMonth = useMemo(
    () =>
      isMultiFile
        ? snapshotNewOffers(snapshots)
        : newOffersPerMonth(active, monthRange),
    [active, snapshots, monthRange, isMultiFile],
  );
  const updatedPerMonth = useMemo(
    () =>
      isMultiFile
        ? snapshotUpdatedOffers(snapshots)
        : updatedOffersPerMonth(active, monthRange),
    [active, snapshots, monthRange, isMultiFile],
  );
  const updateRate = useMemo(
    () =>
      isMultiFile
        ? snapshotUpdateRate(snapshots)
        : updateRatePerMonth(active, active.length, monthRange),
    [active, snapshots, monthRange, isMultiFile],
  );
  const archivedEvolution = useMemo(
    () =>
      isMultiFile
        ? snapshotArchivedEvolution(snapshots)
        : archivedPerMonth(archived, monthRange),
    [archived, snapshots, monthRange, isMultiFile],
  );

  /* ── Common analysis ── */
  const dvc = useMemo(() => directVsConfreres(active), [active]);
  const byCompany = useMemo(() => offersByCompany(active), [active]);

  /* ── Global-only analysis ── */
  const bySector = useMemo(
    () => (isGlobal ? countBy(active, "secteurMarche") : []),
    [active, isGlobal],
  );
  const dcBySector = useMemo(
    () => (isGlobal ? directConfreresBySector(active) : []),
    [active, isGlobal],
  );
  const newBySector = useMemo(() => {
    if (!isGlobal) return [];
    const monthKeys = new Set(monthRange.map((m) => m.month));
    const recentCreated = active.filter((o) => {
      if (!o.dateCreation) return false;
      const key = `${o.dateCreation.getFullYear()}-${String(o.dateCreation.getMonth() + 1).padStart(2, "0")}`;
      return monthKeys.has(key);
    });
    return countBy(recentCreated, "secteurMarche");
  }, [active, monthRange, isGlobal]);

  /* ── Current month stats ── */
  const currentMonth = monthRange[monthRange.length - 1]?.month;
  const newThisMonth =
    newPerMonth.find((p) => p.month === currentMonth)?.value ?? 0;
  const archivedThisMonth =
    archivedEvolution.find((p) => p.month === currentMonth)?.value ?? 0;
  const lastMonthUpdated =
    updatedPerMonth[updatedPerMonth.length - 1]?.value ?? 0;
  const lastMonthUpdatePct =
    active.length > 0
      ? Math.round((lastMonthUpdated / active.length) * 100)
      : 0;

  /* ── Empty state ── */
  if (active.length === 0 && !isGlobal) {
    return (
      <div className="text-center py-16 text-text-tertiary">
        <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium">Aucune offre dans ce secteur</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── 1. KPI Cards (same for all tabs) ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 stagger-children">
        <StatCard
          label="Offres actives"
          value={formatNumber(active.length)}
          icon={Building2}
          color="blue"
        />
        <StatCard
          label="Nouvelles offres"
          value={formatNumber(newThisMonth)}
          subtitle="Ce mois"
          icon={isGlobal ? FileSpreadsheet : TrendingUp}
          color="green"
        />
        <StatCard
          label="Directes / Confrères"
          value={`${dvc.directPct}% / ${dvc.confreresPct}%`}
          subtitle={`${formatNumber(dvc.direct)} / ${formatNumber(dvc.confreres)}`}
          icon={Users}
          color="purple"
        />
        <StatCard
          label="Taux de MAJ"
          value={`${lastMonthUpdatePct}%`}
          subtitle="Ce mois"
          icon={Percent}
          color="amber"
        />
        <StatCard
          label="Archivées"
          value={formatNumber(archived.length)}
          subtitle={`${archivedThisMonth} ce mois`}
          icon={Archive}
          color="red"
        />
      </div>

      {/* ── 2. Active offers evolution (multi-file only) ── */}
      {activeEvolution && (
        <ChartLine
          title="Évolution des offres actives"
          data={activeEvolution}
          color="#002855"
          filled
        />
      )}

      {/* ── 3. New offers + Update rate (always same position) ── */}
      <div className="grid md:grid-cols-2 gap-6">
        <ChartLine
          title="Nouvelles offres par mois"
          data={newPerMonth}
          color="#10b981"
          filled
        />
        <ChartLine
          title="Taux de mise à jour (%)"
          data={updateRate}
          color="#0066cc"
          suffix="%"
        />
      </div>

      {/* ── 4. Direct/Confrères pie + Offers by company (always same position) ── */}
      <div className="grid md:grid-cols-2 gap-6">
        <ChartPie
          title="Répartition Directes / Confrères"
          data={[
            { name: "Newmark (directes)", value: dvc.direct },
            { name: "Confrères", value: dvc.confreres },
          ]}
        />
        <ChartBar
          title="Offres par société"
          data={byCompany}
          layout="horizontal"
          maxItems={15}
        />
      </div>

      {/* ── 5. Archived evolution ── */}
      {(archived.length > 0 || isMultiFile) && (
        <ChartLine
          title="Espaces archivés par mois"
          data={archivedEvolution}
          color="#ef4444"
        />
      )}

      {/* ── 6. Global only: sector breakdowns ── */}
      {isGlobal && (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            <ChartBar
              title="Nouvelles offres par secteur"
              data={newBySector}
              layout="horizontal"
            />
            <ChartStackedBar
              title="Directes / Confrères par secteur"
              data={dcBySector}
            />
          </div>
          <ChartBar
            title="Offres actives par secteur"
            data={bySector}
            layout="horizontal"
          />
        </>
      )}

      {/* ── 7. Data table ── */}
      <DataTable
        title={isGlobal ? "Toutes les offres actives" : "Offres du secteur"}
        data={active}
      />
    </div>
  );
}
