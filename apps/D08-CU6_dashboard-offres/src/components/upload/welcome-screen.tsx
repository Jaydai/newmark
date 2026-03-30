"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useMsal } from "@azure/msal-react";
import {
  searchSites,
  getSiteDrives,
  listDriveItems,
  listFolderByPath,
  downloadFile,
  type SharePointFile,
} from "@/lib/graph-client";
import {
  BarChart3,
  TrendingUp,
  PieChart,
  Building2,
  LogOut,
  Loader2,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Download,
  Plus,
  AlertCircle,
  RefreshCw,
  Upload,
  Globe,
  Folder,
  HardDrive,
  ChevronRight,
  ArrowLeft,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import {
  detectDateFromFilename,
  formatDateForInput,
  parseDateInput,
} from "@/utils/date-detect";

/* ─── Constants ─── */

const SP_SITE_QUERY = "Communication";
const SP_FOLDER_PATH = "D08CU6_Raw_Data";

/* ─── Types ─── */

interface FileEntry {
  id: string;
  name: string;
  date: Date;
  checked: boolean;
  size?: number;
  modifiedBy?: string;
  spInfo?: { driveId: string; fileId: string };
  localBuffer?: ArrayBuffer;
}

interface WelcomeScreenProps {
  onFilesReady: (
    files: { buffer: ArrayBuffer; fileName: string; date: Date }[],
  ) => void;
  isLoading: boolean;
}

/* ─── Features ─── */

const features = [
  {
    icon: BarChart3,
    title: "Vue d'ensemble",
    description: "KPIs clés et métriques agrégées en un coup d'œil",
  },
  {
    icon: PieChart,
    title: "Répartition",
    description: "Analyse par secteur, gestionnaire et type de contrat",
  },
  {
    icon: TrendingUp,
    title: "Évolution mensuelle",
    description:
      "Suivi mois par mois des offres, mises à jour et archivages",
  },
  {
    icon: Building2,
    title: "Détail par équipe",
    description:
      "Onglets par secteur parisien et banlieue avec KPIs dédiés",
  },
];

/* ─── Helpers ─── */

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function isExcel(name: string) {
  return name.endsWith(".xlsx") || name.endsWith(".xls");
}

/* ─── Component ─── */

export function WelcomeScreen({
  onFilesReady,
  isLoading,
}: WelcomeScreenProps) {
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState("");

  // SharePoint browse overlay state
  const [showSpBrowse, setShowSpBrowse] = useState(false);
  const [spBrowseItems, setSpBrowseItems] = useState<SharePointFile[]>([]);
  const [spBrowseDriveId, setSpBrowseDriveId] = useState<string | null>(null);
  const [spBrowseStack, setSpBrowseStack] = useState<{ id: string; name: string }[]>([]);
  const [spBrowseLoading, setSpBrowseLoading] = useState(false);

  // Store driveId for SharePoint downloads — not needed in render
  const driveIdRef = useRef<string | null>(null);

  /* ── Auto-load files from SharePoint on mount ── */
  useEffect(() => {
    if (!account) return;
    let cancelled = false;

    async function load() {
      setLoadingFiles(true);
      setLoadError(null);
      try {
        // 1. Find the Communication site
        const sites = await searchSites(instance, account, SP_SITE_QUERY);
        if (cancelled) return;
        const site = sites.find((s) =>
          s.displayName.toLowerCase().includes("communication"),
        );
        if (!site) throw new Error("Site SharePoint « Communication » introuvable");

        // 2. List the D08CU6_Raw_Data folder via the default drive
        const { files: spFiles, driveId } = await listFolderByPath(
          instance,
          account,
          site.id,
          SP_FOLDER_PATH,
        );
        if (cancelled) return;
        driveIdRef.current = driveId;

        // 3. Map Excel files to FileEntry
        const entries: FileEntry[] = spFiles
          .filter((f) => f.file && isExcel(f.name))
          .map((f) => ({
            id: f.id,
            name: f.name,
            date: detectDateFromFilename(f.name) ?? new Date(),
            checked: true,
            size: f.size,
            modifiedBy: f.lastModifiedBy?.user?.displayName,
            spInfo: { driveId, fileId: f.id },
          }));

        setFiles(entries);
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message);
      } finally {
        if (!cancelled) setLoadingFiles(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [instance, account]);

  /* ── Toggle / update files ── */

  const toggleFile = useCallback((id: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, checked: !f.checked } : f)),
    );
  }, []);

  const updateFileDate = useCallback((id: string, dateStr: string) => {
    const date = parseDateInput(dateStr);
    if (!date) return;
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, date } : f)),
    );
  }, []);

  /* ── Add local files ── */

  const handleLocalFiles = useCallback(
    (fileList: FileList) => {
      const excelFiles = Array.from(fileList).filter((f) => isExcel(f.name));
      if (excelFiles.length === 0) return;

      Promise.all(
        excelFiles.map(
          (file) =>
            new Promise<FileEntry>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                if (e.target?.result instanceof ArrayBuffer) {
                  resolve({
                    id: `local-${Date.now()}-${file.name}`,
                    name: file.name,
                    date:
                      detectDateFromFilename(file.name) ?? new Date(),
                    checked: true,
                    size: file.size,
                    localBuffer: e.target.result,
                  });
                } else {
                  reject(new Error("read error"));
                }
              };
              reader.onerror = () => reject(new Error("read error"));
              reader.readAsArrayBuffer(file);
            }),
        ),
      ).then((entries) => setFiles((prev) => [...prev, ...entries]));
    },
    [],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleLocalFiles(e.target.files);
      }
      // Reset so same file can be re-added
      e.target.value = "";
    },
    [handleLocalFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        handleLocalFiles(e.dataTransfer.files);
      }
    },
    [handleLocalFiles],
  );

  /* ── SharePoint browse overlay ── */

  const openSpBrowse = useCallback(async () => {
    setShowSpBrowse(true);
    setSpBrowseLoading(true);
    setSpBrowseStack([]);
    try {
      const sites = await searchSites(instance, account, SP_SITE_QUERY);
      const site = sites.find((s) =>
        s.displayName.toLowerCase().includes("communication"),
      );
      if (!site) return;
      const drives = await getSiteDrives(instance, account, site.id);
      const docDrive = drives.find(
        (d) =>
          d.name.toLowerCase().includes("document") ||
          d.name.toLowerCase().includes("shared"),
      );
      if (!docDrive) return;
      setSpBrowseDriveId(docDrive.id);
      const items = await listDriveItems(instance, account, docDrive.id);
      setSpBrowseItems(items);
    } catch {
      /* ignore */
    } finally {
      setSpBrowseLoading(false);
    }
  }, [instance, account]);

  const spBrowseOpenFolder = useCallback(
    async (folder: SharePointFile) => {
      if (!spBrowseDriveId) return;
      setSpBrowseStack((prev) => [...prev, { id: folder.id, name: folder.name }]);
      setSpBrowseLoading(true);
      try {
        const items = await listDriveItems(instance, account, spBrowseDriveId, folder.id);
        setSpBrowseItems(items);
      } catch {
        /* ignore */
      } finally {
        setSpBrowseLoading(false);
      }
    },
    [instance, account, spBrowseDriveId],
  );

  const spBrowseBack = useCallback(async () => {
    if (!spBrowseDriveId) return;
    const newStack = [...spBrowseStack];
    newStack.pop();
    setSpBrowseStack(newStack);
    setSpBrowseLoading(true);
    try {
      const parentId = newStack.length > 0 ? newStack[newStack.length - 1].id : undefined;
      const items = await listDriveItems(instance, account, spBrowseDriveId, parentId);
      setSpBrowseItems(items);
    } catch {
      /* ignore */
    } finally {
      setSpBrowseLoading(false);
    }
  }, [instance, account, spBrowseDriveId, spBrowseStack]);

  const spBrowseAddFile = useCallback(
    (spFile: SharePointFile) => {
      if (!spBrowseDriveId) return;
      // Don't add duplicates
      if (files.some((f) => f.id === spFile.id)) return;
      setFiles((prev) => [
        ...prev,
        {
          id: spFile.id,
          name: spFile.name,
          date: detectDateFromFilename(spFile.name) ?? new Date(),
          checked: true,
          size: spFile.size,
          modifiedBy: spFile.lastModifiedBy?.user?.displayName,
          spInfo: { driveId: spBrowseDriveId, fileId: spFile.id },
        },
      ]);
    },
    [spBrowseDriveId, files],
  );

  /* ── Analyze ── */

  const checkedFiles = files.filter((f) => f.checked);
  const checkedCount = checkedFiles.length;

  const handleAnalyze = useCallback(async () => {
    if (checkedCount === 0) return;
    setAnalyzing(true);
    setAnalyzeError(null);

    try {
      const results: {
        buffer: ArrayBuffer;
        fileName: string;
        date: Date;
      }[] = [];

      for (let i = 0; i < checkedFiles.length; i++) {
        const f = checkedFiles[i];
        setProgress(
          `Téléchargement ${i + 1}/${checkedFiles.length} : ${f.name}`,
        );

        let buffer: ArrayBuffer;
        if (f.localBuffer) {
          buffer = f.localBuffer;
        } else if (f.spInfo) {
          buffer = await downloadFile(
            instance,
            account,
            f.spInfo.driveId,
            f.spInfo.fileId,
          );
        } else {
          continue;
        }

        results.push({ buffer, fileName: f.name, date: f.date });
      }

      setProgress("Analyse en cours…");
      await new Promise((r) => setTimeout(r, 50));
      onFilesReady(results);
    } catch (e) {
      setAnalyzeError(
        `Erreur lors du téléchargement : ${(e as Error).message}`,
      );
    } finally {
      setAnalyzing(false);
      setProgress("");
    }
  }, [checkedFiles, checkedCount, instance, account, onFilesReady]);

  /* ── Retry ── */

  const handleRetry = useCallback(() => {
    setLoadError(null);
    setLoadingFiles(true);
    // Re-trigger the effect by toggling a dummy state… or just reload
    window.location.reload();
  }, []);

  const handleLogout = () => instance.logoutRedirect();

  /* ── Render ── */

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Image
            src="/newmark-logo.svg"
            alt="Newmark"
            width={160}
            height={36}
            priority
            className="h-8 w-auto"
          />
          {account && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-tertiary hidden md:block">
                {account.name || account.username}
              </span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-surface-hover text-text-secondary hover:text-foreground"
              >
                <LogOut className="w-3.5 h-3.5" />
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-2xl mx-auto text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-light text-accent text-xs font-semibold mb-6">
            <BarChart3 className="w-3.5 h-3.5" />
            Tableau de bord KPI
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight mb-4">
            Analysez vos KPIs
            <br />
            <span className="text-accent">en quelques secondes</span>
          </h1>
          <p className="text-lg text-text-secondary max-w-md mx-auto">
            Sélectionnez les exports à analyser pour générer votre tableau de
            bord interactif avec évolution mensuelle.
          </p>
        </div>

        {/* ── File list panel ── */}
        <div
          className="w-full max-w-2xl animate-fade-in"
          style={{ animationDelay: "100ms" }}
        >
          <div className="rounded-2xl border border-border bg-surface overflow-hidden">
            {/* Loading */}
            {loadingFiles && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-7 h-7 text-accent animate-spin" />
                <p className="text-sm text-text-secondary">
                  Chargement des fichiers depuis SharePoint…
                </p>
              </div>
            )}

            {/* Error */}
            {!loadingFiles && loadError && !analyzing && (
              <div className="p-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-4 text-red-600">
                  <AlertCircle className="w-5 h-5" />
                  <p className="text-sm font-medium">{loadError}</p>
                </div>
                <button
                  onClick={handleRetry}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-surface-hover text-text-secondary"
                >
                  <RefreshCw className="w-4 h-4" />
                  Réessayer
                </button>
              </div>
            )}

            {/* File list */}
            {!loadingFiles && !loadError && (
              <>
                {/* Header */}
                {files.length > 0 && (
                  <div className="px-4 py-2.5 border-b border-border bg-surface-hover/30">
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                      Fichiers à analyser — cochez ceux à inclure
                    </p>
                  </div>
                )}

                {/* Files */}
                <div className="max-h-80 overflow-y-auto">
                  {files.length === 0 && (
                    <div className="text-center py-12 text-sm text-text-tertiary">
                      Aucun fichier Excel trouvé dans le dossier
                    </div>
                  )}
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-surface-hover/50"
                    >
                      <button
                        onClick={() => toggleFile(file.id)}
                        className="shrink-0 text-accent"
                      >
                        {file.checked ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5 text-text-tertiary" />
                        )}
                      </button>
                      <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-text-tertiary">
                          {file.size ? formatSize(file.size) : "Fichier local"}
                          {file.modifiedBy && (
                            <> &middot; {file.modifiedBy}</>
                          )}
                          {file.localBuffer && (
                            <span className="ml-1 px-1.5 py-0.5 rounded bg-accent-light text-accent text-[10px] font-medium">
                              local
                            </span>
                          )}
                        </p>
                      </div>
                      <input
                        type="date"
                        value={formatDateForInput(file.date)}
                        onChange={(e) =>
                          updateFileDate(file.id, e.target.value)
                        }
                        className="shrink-0 px-2 py-1 text-xs rounded-md border border-border bg-background focus:outline-none focus:border-accent w-36"
                      />
                    </div>
                  ))}
                </div>

                {/* Add files */}
                <div
                  className="px-4 py-3 border-t border-border"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    multiple
                    onChange={handleInputChange}
                    className="hidden"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-text-secondary hover:text-foreground rounded-lg border border-dashed border-border hover:border-accent/50 hover:bg-surface-hover transition-all"
                    >
                      <Upload className="w-4 h-4" />
                      Fichier local
                    </button>
                    <button
                      onClick={openSpBrowse}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-text-secondary hover:text-foreground rounded-lg border border-dashed border-border hover:border-accent/50 hover:bg-surface-hover transition-all"
                    >
                      <Globe className="w-4 h-4" />
                      SharePoint
                    </button>
                  </div>
                </div>

                {/* Analyze error (inline) */}
                {analyzeError && (
                  <div className="px-4 py-2 border-t border-border">
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span className="flex-1">{analyzeError}</span>
                      <button
                        onClick={() => setAnalyzeError(null)}
                        className="shrink-0 p-0.5 hover:bg-red-100 rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Analyze button */}
                <div className="px-4 py-3 border-t border-border bg-surface-hover/30">
                  {analyzing || isLoading ? (
                    <div className="flex items-center justify-center gap-3 py-1">
                      <Loader2 className="w-5 h-5 text-accent animate-spin" />
                      <span className="text-sm text-text-secondary">
                        {progress || "Analyse en cours…"}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={handleAnalyze}
                      disabled={checkedCount === 0}
                      className={clsx(
                        "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
                        checkedCount > 0
                          ? "bg-accent text-white hover:bg-accent/90 shadow-sm"
                          : "bg-border text-text-tertiary cursor-not-allowed",
                      )}
                    >
                      <Download className="w-4 h-4" />
                      Analyser {checkedCount} fichier
                      {checkedCount > 1 ? "s" : ""}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mt-16 stagger-children">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col items-center text-center p-4 rounded-xl hover:bg-surface-hover transition-colors"
            >
              <div className="rounded-lg bg-accent-light p-2.5 mb-3">
                <feature.icon className="w-5 h-5 text-accent" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">
                {feature.title}
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </main>

      {/* SharePoint browse overlay */}
      {showSpBrowse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg mx-4 rounded-2xl border border-border bg-surface shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-hover/50">
              <div className="flex items-center gap-2">
                {spBrowseStack.length > 0 && (
                  <button
                    onClick={spBrowseBack}
                    className="p-1 rounded hover:bg-surface-hover text-text-secondary"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <span className="text-sm font-semibold text-foreground">
                  {spBrowseStack.length > 0
                    ? spBrowseStack[spBrowseStack.length - 1].name
                    : "Documents"}
                </span>
              </div>
              <button
                onClick={() => setShowSpBrowse(false)}
                className="p-1 rounded hover:bg-surface-hover text-text-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="px-4 py-2 text-xs text-text-tertiary border-b border-border">
              Cliquez sur un fichier Excel pour l&apos;ajouter à la liste
            </p>

            {/* Content */}
            <div className="max-h-80 overflow-y-auto">
              {spBrowseLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-accent animate-spin" />
                  <span className="ml-3 text-sm text-text-secondary">
                    Chargement…
                  </span>
                </div>
              ) : spBrowseItems.length === 0 ? (
                <div className="text-center py-12 text-sm text-text-tertiary">
                  Ce dossier est vide
                </div>
              ) : (
                spBrowseItems.map((item) => {
                  const isFolder = !!item.folder;
                  const isExcelFile = isExcel(item.name);
                  const alreadyAdded = files.some((f) => f.id === item.id);

                  if (!isFolder && !isExcelFile) return null;

                  return (
                    <button
                      key={item.id}
                      onClick={() =>
                        isFolder
                          ? spBrowseOpenFolder(item)
                          : spBrowseAddFile(item)
                      }
                      disabled={alreadyAdded}
                      className={clsx(
                        "w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border last:border-0 transition-colors",
                        alreadyAdded
                          ? "opacity-40 cursor-default"
                          : "hover:bg-surface-hover cursor-pointer",
                      )}
                    >
                      {isFolder ? (
                        <Folder className="w-5 h-5 text-amber-500 shrink-0" />
                      ) : (
                        <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-text-tertiary">
                          {isFolder
                            ? `${item.folder!.childCount} éléments`
                            : alreadyAdded
                              ? "Déjà ajouté"
                              : formatSize(item.size)}
                        </p>
                      </div>
                      {isFolder && (
                        <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0" />
                      )}
                      {!isFolder && !alreadyAdded && (
                        <Plus className="w-4 h-4 text-accent shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center">
        <p className="text-xs text-text-tertiary">
          Newmark France — Tableau de bord KPI — Données traitées localement
        </p>
      </footer>
    </div>
  );
}
