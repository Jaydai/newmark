"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  BarChart3,
  Clock3,
  Download,
  FolderKanban,
  LoaderCircle,
  PencilLine,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Users2,
  X,
} from "lucide-react";
import styles from "./timesheet.module.css";
import {
  fetchTimesheetSnapshot,
  saveTimesheetSnapshot,
  TimesheetConflictError,
} from "@/lib/timesheet-api";
import {
  buildDefaultState,
  DEFAULT_DESIGNERS,
  type GraphistesTimesheetState,
  type TimesheetEntry,
  type TimesheetProject,
} from "@/lib/timesheet-types";

const TAB_ITEMS = [
  { id: "projects", label: "Projets", icon: FolderKanban },
  { id: "entry", label: "Saisie", icon: Clock3 },
  { id: "history", label: "Historique", icon: Users2 },
  { id: "charts", label: "Dataviz", icon: BarChart3 },
] as const;
const CHART_COLORS = [
  "#10253f",
  "#ef6a5b",
  "#2d7dd2",
  "#4f46e5",
  "#0f766e",
  "#b45309",
  "#7c3aed",
  "#2563eb",
];

type TabId = (typeof TAB_ITEMS)[number]["id"];

type ChartDatum = {
  label: string;
  value: number;
  color: string;
};

type SyncPhase = "idle" | "loading" | "ready" | "syncing" | "error";

type SyncStatus = {
  phase: SyncPhase;
  message: string;
  detail: string;
  lastSyncedAt: string | null;
};

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours} h`;
  return `${hours} h ${remainder.toString().padStart(2, "0")}`;
}

function formatHours(minutes: number) {
  return (minutes / 60).toFixed(2).replace(".", ",");
}

function formatDateLong(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function escapeCsvCell(value: string | number) {
  const stringValue = String(value ?? "");
  if (!/[;"\n\r]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/g, '""')}"`;
}

function parseDurationInput(value: string) {
  const input = value.trim().toLowerCase().replace(",", ".");
  if (!input) return 0;

  const hoursMatch = input.match(/^(\d+)(?:\s*h(?:\s*(\d+))?)$/);
  if (hoursMatch) {
    return Number(hoursMatch[1]) * 60 + Number(hoursMatch[2] ?? 0);
  }

  const minutesMatch = input.match(/^(\d+)\s*min$/);
  if (minutesMatch) {
    return Number(minutesMatch[1]);
  }

  const numericValue = Number(input);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }

  if (input.includes(".")) {
    return Math.round(numericValue * 60);
  }

  if (numericValue <= 12) {
    return Math.round(numericValue * 60);
  }

  return Math.round(numericValue);
}

function sortEntries(entries: TimesheetEntry[]) {
  return [...entries].sort((left, right) => {
    const dateCompare = right.date.localeCompare(left.date);
    if (dateCompare !== 0) return dateCompare;
    return right.createdAt.localeCompare(left.createdAt);
  });
}

function sumMinutes(entries: TimesheetEntry[]) {
  return entries.reduce((total, entry) => total + entry.minutes, 0);
}

function nextProjectId(projects: TimesheetProject[]) {
  return projects.length > 0
    ? Math.max(...projects.map((project) => project.id)) + 1
    : 1;
}

function nowIso() {
  return new Date().toISOString();
}

function DonutChart({ data }: { data: ChartDatum[] }) {
  const size = 176;
  const radius = size / 2 - 16;
  const circumference = 2 * Math.PI * radius;
  const positiveData = data.filter((item) => item.value > 0);
  const total = positiveData.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className={styles.chartEmpty}>
        Aucune donnee exploitable pour generer ce graphique.
      </div>
    );
  }

  const segments = positiveData.reduce<
    Array<{ item: ChartDatum; dash: number; offset: number }>
  >((accumulator, item) => {
    const previous = accumulator[accumulator.length - 1];
    const offset = previous ? previous.offset + previous.dash : 0;
    const dash = (item.value / total) * circumference;

    return [...accumulator, { item, dash, offset }];
  }, []);

  return (
    <div className={styles.chartWrap}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e7edf5"
          strokeWidth="24"
        />
        {segments.map((segment) => (
          <circle
            key={segment.item.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={segment.item.color}
            strokeWidth="24"
            strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
            strokeDashoffset={-segment.offset}
            strokeLinecap="round"
          />
        ))}
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#10253f"
          fontSize="15"
          fontWeight="800"
          style={{ transform: "rotate(90deg)", transformOrigin: "center" }}
        >
          {formatMinutes(total)}
        </text>
      </svg>

      <div className={styles.chartLegend}>
        {positiveData.map((item) => (
          <div key={item.label} className={styles.chartLegendItem}>
            <span
              className={styles.legendSwatch}
              style={{ background: item.color }}
            />
            <span>{item.label}</span>
            <span className={styles.legendMuted}>
              {formatMinutes(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizontalBars({ data }: { data: ChartDatum[] }) {
  const positiveData = data.filter((item) => item.value > 0);
  const maxValue = Math.max(...positiveData.map((item) => item.value), 1);

  if (positiveData.length === 0) {
    return (
      <div className={styles.chartEmpty}>
        Aucune donnee exploitable pour generer ce graphique.
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      {positiveData.map((item) => (
        <div key={item.label} className={styles.stack}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "baseline",
            }}
          >
            <strong>{item.label}</strong>
            <span className={styles.smallHint}>{formatMinutes(item.value)}</span>
          </div>
          <div
            style={{
              height: 14,
              borderRadius: 999,
              background: "#e7edf5",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(item.value / maxValue) * 100}%`,
                height: "100%",
                borderRadius: 999,
                background: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function VerticalBars({ data }: { data: ChartDatum[] }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  if (data.length === 0 || data.every((item) => item.value === 0)) {
    return (
      <div className={styles.chartEmpty}>
        Aucune donnee exploitable pour generer ce graphique.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
        gap: 10,
        alignItems: "end",
        minHeight: 220,
      }}
    >
      {data.map((item) => (
        <div
          key={item.label}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span className={styles.smallHint}>
            {item.value > 0 ? formatMinutes(item.value) : "—"}
          </span>
          <div
            style={{
              width: "100%",
              maxWidth: 54,
              height: 150,
              borderRadius: 18,
              background: "#eef3f8",
              display: "flex",
              alignItems: "end",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "100%",
                minHeight: item.value > 0 ? 8 : 0,
                height: `${(item.value / maxValue) * 100}%`,
                borderRadius: 18,
                background: item.color,
              }}
            />
          </div>
          <strong style={{ textAlign: "center" }}>{item.label}</strong>
        </div>
      ))}
    </div>
  );
}

export default function GraphistesTimesheetTool() {
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    phase: "loading",
    message: "Chargement",
    detail: "Lecture de la base locale partagee...",
    lastSyncedAt: null,
  });
  const [state, setState] = useState<GraphistesTimesheetState>(buildDefaultState);
  const [serverRevision, setServerRevision] = useState<number | null>(null);
  const [storageLabel, setStorageLabel] = useState(
    "data/graphistes-timesheet.sqlite",
  );
  const [activeTab, setActiveTab] = useState<TabId>("projects");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [saveRetryVersion, setSaveRetryVersion] = useState(0);
  const [lastSavedSerialized, setLastSavedSerialized] = useState("");

  const [projectName, setProjectName] = useState("");
  const [designerName, setDesignerName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedDesigner, setSelectedDesigner] = useState<string>(
    DEFAULT_DESIGNERS[0] ?? "",
  );
  const [selectedDate, setSelectedDate] = useState(today());
  const [durationInput, setDurationInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [historyDesigner, setHistoryDesigner] = useState("all");
  const [historyProject, setHistoryProject] = useState("all");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingDuration, setEditingDuration] = useState("");
  const [editingNote, setEditingNote] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadState = async () => {
      setSyncStatus({
        phase: "loading",
        message: "Chargement",
        detail: "Lecture de la base locale partagee...",
        lastSyncedAt: null,
      });

      try {
        const snapshot = await fetchTimesheetSnapshot();

        if (cancelled) return;

        setLastSavedSerialized(JSON.stringify(snapshot.state));
        setServerRevision(snapshot.revision);
        setStorageLabel(snapshot.storageLabel);
        setState(snapshot.state);
        setSelectedProjectId((current) =>
          current &&
          !snapshot.state.projects.some((project) => String(project.id) === current)
            ? ""
            : current,
        );
        setHistoryProject((current) =>
          current !== "all" &&
          !snapshot.state.projects.some((project) => String(project.id) === current)
            ? "all"
            : current,
        );
        setSelectedDesigner((current) =>
          snapshot.state.designers.includes(current)
            ? current
            : snapshot.state.designers[0] ?? "",
        );
        setHistoryDesigner((current) =>
          current !== "all" && !snapshot.state.designers.includes(current)
            ? "all"
            : current,
        );
        setHydrated(true);
        setSyncStatus({
          phase: "ready",
          message: "Connecte",
          detail: `Fichier: ${snapshot.storageLabel}`,
          lastSyncedAt: snapshot.state.updatedAt,
        });
      } catch (error) {
        if (cancelled) return;

        setHydrated(true);
        setServerRevision(null);
        setSyncStatus({
          phase: "error",
          message: "Connexion interrompue",
          detail:
            error instanceof Error
              ? error.message
              : "Impossible d'ouvrir la base partagee.",
          lastSyncedAt: null,
        });
      }
    };

    void loadState();

    return () => {
      cancelled = true;
    };
  }, [refreshVersion]);

  useEffect(() => {
    if (!hydrated || serverRevision === null) return;

    const serialized = JSON.stringify(state);
    if (serialized === lastSavedSerialized) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setSyncStatus({
        phase: "syncing",
        message: "Enregistrement",
        detail: `Mise a jour de ${storageLabel}...`,
        lastSyncedAt: null,
      });

      try {
        const snapshot = await saveTimesheetSnapshot(serverRevision, state);
        if (cancelled) return;

        setLastSavedSerialized(serialized);
        setServerRevision(snapshot.revision);
        setStorageLabel(snapshot.storageLabel);
        setSyncStatus({
          phase: "ready",
          message: "Connecte",
          detail: `Fichier: ${snapshot.storageLabel}`,
          lastSyncedAt: snapshot.state.updatedAt,
        });
      } catch (error) {
        if (cancelled) return;

        if (error instanceof TimesheetConflictError) {
          setServerRevision(error.snapshot.revision);
          setStorageLabel(error.snapshot.storageLabel);
          setSyncStatus({
            phase: "error",
            message: "Conflit de synchro",
            detail:
              "Une autre session a modifie la base. Rechargez avant de poursuivre.",
            lastSyncedAt: error.snapshot.state.updatedAt,
          });
          return;
        }

        setSyncStatus({
          phase: "error",
          message: "Connexion interrompue",
          detail:
            error instanceof Error
              ? error.message
              : "Les changements restent uniquement dans l'onglet.",
          lastSyncedAt: null,
        });

        window.setTimeout(() => {
          setSaveRetryVersion((current) => current + 1);
        }, 2500);
      }
    }, 650);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [hydrated, lastSavedSerialized, saveRetryVersion, serverRevision, state, storageLabel]);

  useEffect(() => {
    if (!toast) return;

    const timeoutId = window.setTimeout(() => {
      setToast("");
    }, 2400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  const serializedState = useMemo(() => JSON.stringify(state), [state]);

  const projectsById = useMemo(
    () => new Map(state.projects.map((project) => [project.id, project])),
    [state.projects],
  );
  const hasUnsavedChanges =
    hydrated &&
    serverRevision !== null &&
    serializedState !== lastSavedSerialized;

  const sortedEntries = useMemo(() => sortEntries(state.entries), [state.entries]);

  const filteredEntries = useMemo(() => {
    return sortedEntries.filter((entry) => {
      const designerMatch =
        historyDesigner === "all" || entry.designer === historyDesigner;
      const projectMatch =
        historyProject === "all" || String(entry.projectId) === historyProject;

      return designerMatch && projectMatch;
    });
  }, [historyDesigner, historyProject, sortedEntries]);

  const totalMinutes = sumMinutes(state.entries);
  const currentMonthKey = today().slice(0, 7);
  const currentMonthMinutes = state.entries
    .filter((entry) => entry.date.startsWith(currentMonthKey))
    .reduce((total, entry) => total + entry.minutes, 0);
  const activeDesignersCount = new Set(
    state.entries.map((entry) => entry.designer).filter(Boolean),
  ).size;
  const projectsWithEntriesCount = new Set(
    state.entries.map((entry) => entry.projectId),
  ).size;
  const designerSummaries = useMemo(
    () =>
      state.designers.map((designer) => {
        const entries = state.entries.filter((entry) => entry.designer === designer);
        return {
          designer,
          entriesCount: entries.length,
          minutes: sumMinutes(entries),
        };
      }),
    [state.designers, state.entries],
  );

  const selectedProject = selectedProjectId
    ? projectsById.get(Number(selectedProjectId))
    : null;

  const projectChartData: ChartDatum[] = state.projects.map((project, index) => ({
    label: project.name,
    value: filteredEntries
      .filter((entry) => entry.projectId === project.id)
      .reduce((total, entry) => total + entry.minutes, 0),
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  const designerChartData: ChartDatum[] = state.designers.map(
    (designer, index) => ({
      label: designer,
      value: filteredEntries
        .filter((entry) => entry.designer === designer)
        .reduce((total, entry) => total + entry.minutes, 0),
      color: CHART_COLORS[index % CHART_COLORS.length],
    }),
  );

  const weeklyChartData: ChartDatum[] = Array.from({ length: 6 }, (_, index) => {
    const now = new Date();
    const weekOffset = 5 - index;
    const weekStart = new Date(now);
    weekStart.setHours(12, 0, 0, 0);
    weekStart.setDate(now.getDate() - now.getDay() - weekOffset * 7 + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const start = weekStart.toISOString().slice(0, 10);
    const end = weekEnd.toISOString().slice(0, 10);

    return {
      label: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`,
      value: filteredEntries
        .filter((entry) => entry.date >= start && entry.date <= end)
        .reduce((total, entry) => total + entry.minutes, 0),
      color: CHART_COLORS[(index + 2) % CHART_COLORS.length],
    };
  });

  const recentEntries = filteredEntries.slice(0, 6);

  function notify(message: string) {
    setToast(message);
  }

  function patchState(
    updater: (current: GraphistesTimesheetState) => GraphistesTimesheetState,
  ) {
    setState((current) => {
      const nextState = updater(current);
      return { ...nextState, updatedAt: nowIso() };
    });
  }

  function addProject() {
    const normalizedName = projectName.trim();
    if (!normalizedName) {
      notify("Saisissez un nom de projet.");
      return;
    }

    const exists = state.projects.some(
      (project) => project.name.toLowerCase() === normalizedName.toLowerCase(),
    );
    if (exists) {
      notify("Ce projet existe deja.");
      return;
    }

    const timestamp = nowIso();
    const project: TimesheetProject = {
      id: nextProjectId(state.projects),
      name: normalizedName,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    patchState((current) => ({
      ...current,
      projects: [...current.projects, project],
    }));
    setProjectName("");
    setSelectedProjectId(String(project.id));
    notify(`Projet "${normalizedName}" cree.`);
  }

  function addDesigner() {
    const normalizedName = designerName.trim();
    if (!normalizedName) {
      notify("Saisissez un nom de graphiste.");
      return;
    }

    const exists = state.designers.some(
      (designer) =>
        designer.toLocaleLowerCase("fr-FR") ===
        normalizedName.toLocaleLowerCase("fr-FR"),
    );
    if (exists) {
      notify("Ce graphiste existe deja.");
      return;
    }

    patchState((current) => ({
      ...current,
      designers: [...current.designers, normalizedName],
    }));
    setDesignerName("");
    setSelectedDesigner(normalizedName);
    notify(`Graphiste "${normalizedName}" ajoute.`);
  }

  function removeDesigner(designerNameToRemove: string) {
    if (state.designers.length <= 1) {
      notify("Conservez au moins un graphiste.");
      return;
    }

    const entriesCount = state.entries.filter(
      (entry) => entry.designer === designerNameToRemove,
    ).length;
    if (entriesCount > 0) {
      notify("Supprimez ou modifiez d'abord ses saisies.");
      return;
    }

    if (!window.confirm(`Supprimer "${designerNameToRemove}" de l'equipe ?`)) {
      return;
    }

    const remainingDesigners = state.designers.filter(
      (designer) => designer !== designerNameToRemove,
    );

    patchState((current) => ({
      ...current,
      designers: current.designers.filter(
        (designer) => designer !== designerNameToRemove,
      ),
    }));

    if (selectedDesigner === designerNameToRemove) {
      setSelectedDesigner(remainingDesigners[0] ?? "");
    }
    if (historyDesigner === designerNameToRemove) {
      setHistoryDesigner("all");
    }

    notify(`Graphiste "${designerNameToRemove}" supprime.`);
  }

  function removeProject(projectId: number) {
    const project = projectsById.get(projectId);
    if (!project) return;

    if (
      !window.confirm(
        `Supprimer "${project.name}" ainsi que toutes ses feuilles de temps ?`,
      )
    ) {
      return;
    }

    patchState((current) => ({
      ...current,
      projects: current.projects.filter((item) => item.id !== projectId),
      entries: current.entries.filter((entry) => entry.projectId !== projectId),
    }));

    if (selectedProjectId === String(projectId)) {
      setSelectedProjectId("");
    }
    if (historyProject === String(projectId)) {
      setHistoryProject("all");
    }

    notify(`Projet "${project.name}" supprime.`);
  }

  function addEntry() {
    const minutes = parseDurationInput(durationInput);
    if (!selectedProject || minutes <= 0) {
      notify("Selectionnez un projet et une duree valide.");
      return;
    }

    const timestamp = nowIso();
    const entry: TimesheetEntry = {
      id: `entry-${Date.now()}`,
      projectId: selectedProject.id,
      designer: selectedDesigner,
      date: selectedDate,
      minutes,
      note: noteInput.trim(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    patchState((current) => ({
      ...current,
      entries: [...current.entries, entry],
    }));

    setDurationInput("");
    setNoteInput("");
    notify(`${formatMinutes(minutes)} enregistrees.`);
  }

  function removeEntry(entryId: string) {
    patchState((current) => ({
      ...current,
      entries: current.entries.filter((entry) => entry.id !== entryId),
    }));
    if (editingEntryId === entryId) {
      setEditingEntryId(null);
      setEditingDuration("");
      setEditingNote("");
    }
    notify("Entree supprimee.");
  }

  function startEditing(entry: TimesheetEntry) {
    setEditingEntryId(entry.id);
    setEditingDuration(formatHours(entry.minutes));
    setEditingNote(entry.note);
  }

  function saveEntryEdition(entryId: string) {
    const minutes = parseDurationInput(editingDuration);
    if (minutes <= 0) {
      notify("Saisissez une duree valide.");
      return;
    }

    patchState((current) => ({
      ...current,
      entries: current.entries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              minutes,
              note: editingNote.trim(),
              updatedAt: nowIso(),
            }
          : entry,
      ),
    }));

    setEditingEntryId(null);
    setEditingDuration("");
    setEditingNote("");
    notify("Entree mise a jour.");
  }

  function exportCsv() {
    const header = [
      "Projet",
      "Graphiste",
      "Date",
      "Heures",
      "Minutes",
      "Note",
    ].join(";");
    const rows = filteredEntries.map((entry) =>
      [
        escapeCsvCell(projectsById.get(entry.projectId)?.name ?? "Projet supprime"),
        escapeCsvCell(entry.designer),
        escapeCsvCell(entry.date),
        escapeCsvCell(formatHours(entry.minutes)),
        escapeCsvCell(entry.minutes),
        escapeCsvCell(entry.note),
      ].join(";"),
    );

    const blob = new Blob([`\uFEFF${header}\n${rows.join("\n")}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `newmark_feuilles_temps_${today()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify("Export CSV telecharge.");
  }

  function syncBadgeClassName() {
    if (syncStatus.phase === "error") return styles.statusError;
    if (syncStatus.phase === "syncing" || syncStatus.phase === "loading") {
      return styles.statusSyncing;
    }
    return styles.statusReady;
  }

  function reloadSnapshot() {
    if (
      hasUnsavedChanges &&
      !window.confirm(
        "Des modifications locales ne sont pas encore enregistrees. Recharger la base va ecraser cet etat local. Continuer ?",
      )
    ) {
      return;
    }

    setRefreshVersion((current) => current + 1);
  }

  if (!hydrated) {
    return (
      <section className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.chartEmpty}>
            <LoaderCircle
              className="animate-spin"
              style={{ width: 24, height: 24, marginBottom: 12 }}
            />
            Chargement de l&apos;application...
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.shell}>
        {toast ? (
          <div
            className={clsx(styles.statusBadge, styles.statusReady)}
            style={{
              position: "fixed",
              top: 20,
              right: 20,
              zIndex: 100,
              boxShadow: "0 18px 36px rgba(16, 37, 63, 0.18)",
            }}
          >
            {toast}
          </div>
        ) : null}

        <div className={styles.hero}>
          <div className={styles.heroCard}>
            <div className={styles.heroTop}>
              <Image
                src="/newmark-logo-white.svg"
                alt="Newmark"
                width={176}
                height={38}
                priority
              />
              <div className={clsx(styles.heroStatus, syncBadgeClassName())}>
                <span className={styles.heroStatusDot} />
                {syncStatus.message}
              </div>
            </div>
            <h1 className={styles.heroTitle}>Feuilles de temps graphistes</h1>
            {syncStatus.phase === "error" ? (
              <div className={styles.syncAlert}>
                <div>
                  <strong>{syncStatus.message}</strong>
                  <span>{syncStatus.detail}</span>
                </div>
                <button
                  type="button"
                  className={styles.syncAlertButton}
                  onClick={reloadSnapshot}
                >
                  <RefreshCw size={15} />
                  Recharger
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.statsGrid}>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>Graphistes actifs</p>
            <p className={styles.statValue}>{activeDesignersCount}</p>
            <p className={styles.statHint}>
              {state.designers.length} configures dans l&apos;app
            </p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>Projets actifs</p>
            <p className={styles.statValue}>{state.projects.length}</p>
            <p className={styles.statHint}>
              {projectsWithEntriesCount} avec au moins une saisie
            </p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>Temps cumule</p>
            <p className={styles.statValue}>{formatMinutes(totalMinutes)}</p>
            <p className={styles.statHint}>
              {currentMonthMinutes > 0
                ? `Ce mois: ${formatMinutes(currentMonthMinutes)}`
                : "Aucune saisie ce mois"}
            </p>
          </article>
        </div>

        <div className={styles.tabs}>
          {TAB_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={clsx(styles.tab, activeTab === item.id && styles.tabActive)}
              onClick={() => setActiveTab(item.id)}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </div>

        {activeTab === "projects" ? (
          <div className={styles.sectionGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>Creer un projet</h2>
                  <p className={styles.panelLead}>
                    Les temps sont rattaches a un projet stable, ce qui evite
                    les orphelins d&apos;une structure basee sur un simple nom de
                    projet.
                  </p>
                </div>
              </div>

              <div className={styles.stack}>
                <label className={styles.field}>
                  <span className={styles.label}>Nom du projet</span>
                  <input
                    className={styles.input}
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    placeholder="Ex. Pitch Avenue de l'Opera"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        addProject();
                      }
                    }}
                  />
                </label>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={addProject}
                  >
                    <Plus size={16} />
                    Ajouter le projet
                  </button>
                </div>
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>Resume des projets</h2>
                  <p className={styles.panelLead}>
                    Vue compacte des projets actifs et de leur charge.
                  </p>
                </div>
              </div>

              {state.projects.length === 0 ? (
                <div className={styles.emptyState}>
                  Aucun projet pour le moment. Creez d&apos;abord un projet pour
                  commencer la saisie des temps.
                </div>
              ) : (
                <div className={styles.projectsList}>
                  {state.projects.map((project, index) => {
                    const projectEntries = state.entries.filter(
                      (entry) => entry.projectId === project.id,
                    );
                    const lastEntry = sortEntries(projectEntries)[0] ?? null;
                    const designerMinutes = state.designers.map((designer) => ({
                      designer,
                      minutes: projectEntries
                        .filter((entry) => entry.designer === designer)
                        .reduce((total, entry) => total + entry.minutes, 0),
                    }));

                    return (
                      <article key={project.id} className={styles.projectCard}>
                        <div className={styles.panelHeader}>
                          <div>
                            <h3 className={styles.projectName}>{project.name}</h3>
                            <div className={styles.projectMeta}>
                              {lastEntry
                                ? `Derniere saisie: ${formatDateLong(lastEntry.date)}`
                                : "Aucune saisie encore"}
                            </div>
                          </div>
                          <button
                            type="button"
                            className={styles.iconButton}
                            title="Supprimer le projet"
                            onClick={() => removeProject(project.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div className={styles.projectMetrics}>
                          <div className={styles.metricTile}>
                            <strong>{formatMinutes(sumMinutes(projectEntries))}</strong>
                            <span>Total cumule</span>
                          </div>
                          <div className={styles.metricTile}>
                            <strong>{projectEntries.length}</strong>
                            <span>Entrees</span>
                          </div>
                        </div>

                        <div className={styles.miniGrid}>
                          {designerMinutes.map((item) => (
                            <div key={item.designer} className={styles.miniPill}>
                              <strong>{item.designer}</strong>
                              {formatMinutes(item.minutes)}
                            </div>
                          ))}
                        </div>

                        <div className={styles.statusDetail}>
                          Palette du projet: couleur{" "}
                          <span
                            className={styles.legendSwatch}
                            style={{
                              display: "inline-block",
                              verticalAlign: "middle",
                              marginInline: 6,
                              background: CHART_COLORS[index % CHART_COLORS.length],
                            }}
                          />
                          pour les graphiques.
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        ) : null}

        {activeTab === "entry" ? (
          <div className={styles.sectionGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>Saisie du temps</h2>
                  <p className={styles.panelLead}>
                    Entrez la duree sous forme libre: <code>1,5</code>,{" "}
                    <code>1h30</code> ou <code>90min</code>.
                  </p>
                </div>
              </div>

              <div className={styles.stack}>
                <div className={styles.row}>
                  <label className={styles.field}>
                    <span className={styles.label}>Projet</span>
                    <select
                      className={styles.select}
                      value={selectedProjectId}
                      onChange={(event) => setSelectedProjectId(event.target.value)}
                    >
                      <option value="">Choisir un projet</option>
                      {state.projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.field}>
                    <span className={styles.label}>Graphiste</span>
                    <select
                      className={styles.select}
                      value={selectedDesigner}
                      onChange={(event) => setSelectedDesigner(event.target.value)}
                    >
                      {state.designers.map((designer) => (
                        <option key={designer} value={designer}>
                          {designer}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className={styles.row}>
                  <label className={styles.field}>
                    <span className={styles.label}>Date</span>
                    <input
                      type="date"
                      className={styles.input}
                      value={selectedDate}
                      onChange={(event) => setSelectedDate(event.target.value)}
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.label}>Duree</span>
                    <input
                      className={styles.input}
                      value={durationInput}
                      onChange={(event) => setDurationInput(event.target.value)}
                      placeholder="Ex. 1,5 ou 1h30"
                    />
                  </label>
                </div>

                <label className={styles.field}>
                  <span className={styles.label}>Note</span>
                  <textarea
                    className={styles.textarea}
                    value={noteInput}
                    onChange={(event) => setNoteInput(event.target.value)}
                    placeholder="Ex. Corrections brochure, mise en page, retouches facade..."
                  />
                </label>

                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={addEntry}
                    disabled={state.projects.length === 0}
                  >
                    <Save size={16} />
                    Enregistrer la saisie
                  </button>
                </div>
              </div>
            </section>

            <div className={styles.panelStack}>
              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <h2 className={styles.panelTitle}>Equipe graphistes</h2>
                    <p className={styles.panelLead}>
                      Ajoutez les graphistes disponibles pour la saisie. La
                      suppression reste bloquee tant qu&apos;il existe de
                      l&apos;historique.
                    </p>
                  </div>
                </div>

                <div className={styles.stack}>
                  <label className={styles.field}>
                    <span className={styles.label}>Nouveau graphiste</span>
                    <input
                      className={styles.input}
                      value={designerName}
                      onChange={(event) => setDesignerName(event.target.value)}
                      placeholder="Ex. Camille Martin"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          addDesigner();
                        }
                      }}
                    />
                  </label>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={addDesigner}
                    >
                      <Plus size={16} />
                      Ajouter le graphiste
                    </button>
                  </div>

                  <div className={styles.designerList}>
                    {designerSummaries.map((item) => {
                      const hasHistory = item.entriesCount > 0;
                      const isLastDesigner = state.designers.length === 1;

                      return (
                        <article
                          key={item.designer}
                          className={styles.designerCard}
                        >
                          <div className={styles.designerCardMain}>
                            <h3 className={styles.designerName}>{item.designer}</h3>
                            <div className={styles.designerMeta}>
                              {hasHistory
                                ? `${item.entriesCount} saisies · ${formatMinutes(item.minutes)}`
                                : "Aucune saisie"}
                            </div>
                          </div>
                          <div className={styles.designerActions}>
                            {hasHistory ? (
                              <span className={styles.designerFlag}>
                                Historique
                              </span>
                            ) : null}
                            <button
                              type="button"
                              className={clsx(
                                styles.iconButton,
                                (hasHistory || isLastDesigner) &&
                                  styles.buttonMuted,
                              )}
                              title={
                                hasHistory
                                  ? "Supprimez ou modifiez ses saisies avant suppression"
                                  : isLastDesigner
                                    ? "Conservez au moins un graphiste"
                                    : "Supprimer le graphiste"
                              }
                              onClick={() => removeDesigner(item.designer)}
                              disabled={hasHistory || isLastDesigner}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <h2 className={styles.panelTitle}>Dernieres saisies</h2>
                    <p className={styles.panelLead}>
                      Apercu immediat de l&apos;historique recent.
                    </p>
                  </div>
                </div>

                {recentEntries.length === 0 ? (
                  <div className={styles.emptyState}>
                    Aucune saisie pour le moment.
                  </div>
                ) : (
                  <div className={styles.timeline}>
                    {recentEntries.map((entry) => (
                      <article key={entry.id} className={styles.timelineItem}>
                        <span className={styles.timelineDot} />
                        <div>
                          <h3 className={styles.timelineTitle}>
                            {projectsById.get(entry.projectId)?.name ?? "Projet supprime"}
                          </h3>
                          <div className={styles.timelineMeta}>
                            {entry.designer} · {formatDateLong(entry.date)}
                            {entry.note ? ` · ${entry.note}` : ""}
                          </div>
                        </div>
                        <div className={styles.timeValue}>
                          {formatMinutes(entry.minutes)}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : null}

        {activeTab === "history" ? (
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Historique detaille</h2>
                <p className={styles.panelLead}>
                  Filtrez, exportez et ajustez les lignes sans quitter
                  l&apos;application.
                </p>
              </div>
            </div>

            <div className={styles.stack}>
              <div className={styles.row}>
                <label className={styles.field}>
                  <span className={styles.label}>Filtre graphiste</span>
                  <select
                    className={styles.select}
                    value={historyDesigner}
                    onChange={(event) => setHistoryDesigner(event.target.value)}
                  >
                    <option value="all">Tous</option>
                    {state.designers.map((designer) => (
                      <option key={designer} value={designer}>
                        {designer}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Filtre projet</span>
                  <select
                    className={styles.select}
                    value={historyProject}
                    onChange={(event) => setHistoryProject(event.target.value)}
                  >
                    <option value="all">Tous</option>
                    {state.projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={exportCsv}
                >
                  <Download size={16} />
                  Exporter en CSV
                </button>
              </div>
            </div>

            <div className={styles.tableWrap} style={{ marginTop: 18 }}>
              <table className={styles.historyTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Projet</th>
                    <th>Graphiste</th>
                    <th>Duree</th>
                    <th>Note</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className={styles.emptyState}>
                          Aucun resultat avec les filtres actuels.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((entry) => {
                      const isEditing = editingEntryId === entry.id;

                      return (
                        <tr key={entry.id}>
                          <td>{formatDateLong(entry.date)}</td>
                          <td>
                            {projectsById.get(entry.projectId)?.name ??
                              "Projet supprime"}
                          </td>
                          <td>{entry.designer}</td>
                          <td>
                            {isEditing ? (
                              <input
                                className={styles.input}
                                value={editingDuration}
                                onChange={(event) =>
                                  setEditingDuration(event.target.value)
                                }
                              />
                            ) : (
                              formatMinutes(entry.minutes)
                            )}
                          </td>
                          <td className={styles.noteCell}>
                            {isEditing ? (
                              <textarea
                                className={styles.textarea}
                                value={editingNote}
                                onChange={(event) =>
                                  setEditingNote(event.target.value)
                                }
                              />
                            ) : (
                              entry.note || "—"
                            )}
                          </td>
                          <td>
                            <div className={styles.historyActions}>
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    className={styles.iconButton}
                                    title="Enregistrer"
                                    onClick={() => saveEntryEdition(entry.id)}
                                  >
                                    <Save size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.iconButton}
                                    title="Annuler"
                                    onClick={() => {
                                      setEditingEntryId(null);
                                      setEditingDuration("");
                                      setEditingNote("");
                                    }}
                                  >
                                    <X size={16} />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className={styles.iconButton}
                                  title="Modifier"
                                  onClick={() => startEditing(entry)}
                                >
                                  <PencilLine size={16} />
                                </button>
                              )}
                              <button
                                type="button"
                                className={styles.iconButton}
                                title="Supprimer"
                                onClick={() => removeEntry(entry.id)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeTab === "charts" ? (
          <div className={styles.chartsGrid}>
            <section className={styles.chartPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>Charge par graphiste</h2>
                  <p className={styles.panelLead}>
                    Repartition du temps filtre entre les membres de l&apos;equipe.
                  </p>
                </div>
              </div>
              <DonutChart data={designerChartData} />
            </section>

            <section className={styles.chartPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>Temps par projet</h2>
                  <p className={styles.panelLead}>
                    Priorites visuelles sur la charge projet.
                  </p>
                </div>
              </div>
              <HorizontalBars data={projectChartData} />
            </section>

            <section className={clsx(styles.chartPanel, styles.chartPanelWide)}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>Tendance hebdomadaire</h2>
                  <p className={styles.panelLead}>
                    Volume saisi sur les six dernieres semaines.
                  </p>
                </div>
              </div>
              <VerticalBars data={weeklyChartData} />
            </section>
          </div>
        ) : null}
      </div>
    </section>
  );
}
