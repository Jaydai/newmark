"use client";

import { useState, useEffect, useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import {
  searchSites,
  getSiteDrives,
  listDriveItems,
  downloadFile,
  type SharePointSite,
  type SharePointDrive,
  type SharePointFile,
} from "@/lib/graph-client";
import {
  Globe,
  HardDrive,
  Folder,
  FileSpreadsheet,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Search,
  AlertCircle,
  CheckSquare,
  Square,
  Download,
} from "lucide-react";
import { clsx } from "clsx";
import {
  detectDateFromFilename,
  formatDateForInput,
  parseDateInput,
} from "@/utils/date-detect";

type Step = "sites" | "drives" | "files";

interface BreadcrumbItem {
  label: string;
  step: Step;
  id?: string;
}

interface SelectedFile {
  spFile: SharePointFile;
  date: Date;
  checked: boolean;
}

interface SharePointPickerProps {
  onFilesReady: (
    files: { buffer: ArrayBuffer; fileName: string; date: Date }[],
  ) => void;
  isLoading: boolean;
}

export function SharePointPicker({
  onFilesReady,
  isLoading,
}: SharePointPickerProps) {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  const [step, setStep] = useState<Step>("sites");
  const [sites, setSites] = useState<SharePointSite[]>([]);
  const [drives, setDrives] = useState<SharePointDrive[]>([]);
  const [files, setFiles] = useState<SharePointFile[]>([]);
  const [folderStack, setFolderStack] = useState<
    { id: string; name: string }[]
  >([]);

  const [selectedSite, setSelectedSite] = useState<SharePointSite | null>(
    null,
  );
  const [selectedDrive, setSelectedDrive] = useState<SharePointDrive | null>(
    null,
  );

  // Multi-file selection state
  const [selectedFiles, setSelectedFiles] = useState<
    Map<string, SelectedFile>
  >(new Map());

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Load sites on mount
  useEffect(() => {
    if (!account) return;
    setLoading(true);
    setError(null);
    searchSites(instance, account)
      .then(setSites)
      .catch((e) =>
        setError(`Impossible de charger les sites : ${e.message}`),
      )
      .finally(() => setLoading(false));
  }, [instance, account]);

  // When files change, auto-detect dates and select xlsx files
  useEffect(() => {
    const map = new Map<string, SelectedFile>();
    for (const f of files) {
      if (!f.file) continue; // skip folders
      const isExcel =
        f.name.endsWith(".xlsx") || f.name.endsWith(".xls");
      if (!isExcel) continue;
      const detected = detectDateFromFilename(f.name);
      map.set(f.id, {
        spFile: f,
        date: detected ?? new Date(),
        checked: true,
      });
    }
    setSelectedFiles(map);
  }, [files]);

  const handleSiteSelect = useCallback(
    async (site: SharePointSite) => {
      setSelectedSite(site);
      setStep("drives");
      setLoading(true);
      setError(null);
      try {
        const d = await getSiteDrives(instance, account, site.id);
        setDrives(d);
      } catch (e: unknown) {
        setError(
          `Impossible de charger les bibliothèques : ${(e as Error).message}`,
        );
      } finally {
        setLoading(false);
      }
    },
    [instance, account],
  );

  const handleDriveSelect = useCallback(
    async (drive: SharePointDrive) => {
      setSelectedDrive(drive);
      setStep("files");
      setFolderStack([]);
      setLoading(true);
      setError(null);
      try {
        const items = await listDriveItems(instance, account, drive.id);
        setFiles(items);
      } catch (e: unknown) {
        setError(
          `Impossible de charger les fichiers : ${(e as Error).message}`,
        );
      } finally {
        setLoading(false);
      }
    },
    [instance, account],
  );

  const handleFolderOpen = useCallback(
    async (folder: SharePointFile) => {
      if (!selectedDrive) return;
      setFolderStack((prev) => [
        ...prev,
        { id: folder.id, name: folder.name },
      ]);
      setLoading(true);
      setError(null);
      try {
        const items = await listDriveItems(
          instance,
          account,
          selectedDrive.id,
          folder.id,
        );
        setFiles(items);
      } catch (e: unknown) {
        setError(
          `Impossible de charger le dossier : ${(e as Error).message}`,
        );
      } finally {
        setLoading(false);
      }
    },
    [instance, account, selectedDrive],
  );

  const handleBack = useCallback(async () => {
    if (step === "drives") {
      setStep("sites");
      setSelectedSite(null);
    } else if (step === "files" && folderStack.length > 0) {
      const newStack = [...folderStack];
      newStack.pop();
      setFolderStack(newStack);
      setLoading(true);
      try {
        const parentId =
          newStack.length > 0
            ? newStack[newStack.length - 1].id
            : undefined;
        const items = await listDriveItems(
          instance,
          account,
          selectedDrive!.id,
          parentId,
        );
        setFiles(items);
      } catch (e: unknown) {
        setError(
          `Erreur de navigation : ${(e as Error).message}`,
        );
      } finally {
        setLoading(false);
      }
    } else if (step === "files") {
      setStep("drives");
      setSelectedDrive(null);
      setFolderStack([]);
    }
  }, [step, folderStack, instance, account, selectedDrive]);

  const handleFileClick = useCallback(
    (file: SharePointFile) => {
      if (file.folder) {
        handleFolderOpen(file);
      }
    },
    [handleFolderOpen],
  );

  const toggleFile = useCallback((fileId: string) => {
    setSelectedFiles((prev) => {
      const next = new Map(prev);
      const entry = next.get(fileId);
      if (entry) {
        next.set(fileId, { ...entry, checked: !entry.checked });
      }
      return next;
    });
  }, []);

  const updateFileDate = useCallback((fileId: string, dateStr: string) => {
    const date = parseDateInput(dateStr);
    if (!date) return;
    setSelectedFiles((prev) => {
      const next = new Map(prev);
      const entry = next.get(fileId);
      if (entry) {
        next.set(fileId, { ...entry, date });
      }
      return next;
    });
  }, []);

  const checkedFiles = Array.from(selectedFiles.values()).filter(
    (f) => f.checked,
  );
  const checkedCount = checkedFiles.length;

  const handleAnalyze = useCallback(async () => {
    if (!selectedDrive || checkedCount === 0) return;
    setDownloading(true);
    setError(null);

    try {
      const results: {
        buffer: ArrayBuffer;
        fileName: string;
        date: Date;
      }[] = [];

      for (let i = 0; i < checkedFiles.length; i++) {
        const { spFile, date } = checkedFiles[i];
        setDownloadProgress(
          `Téléchargement ${i + 1}/${checkedFiles.length} : ${spFile.name}`,
        );
        const buffer = await downloadFile(
          instance,
          account,
          selectedDrive.id,
          spFile.id,
        );
        results.push({ buffer, fileName: spFile.name, date });
      }

      setDownloadProgress("Analyse en cours…");
      // Small delay for UI
      await new Promise((r) => setTimeout(r, 50));
      onFilesReady(results);
    } catch (e: unknown) {
      setError(
        `Erreur lors du téléchargement : ${(e as Error).message}`,
      );
    } finally {
      setDownloading(false);
      setDownloadProgress("");
    }
  }, [
    selectedDrive,
    checkedFiles,
    checkedCount,
    instance,
    account,
    onFilesReady,
  ]);

  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Sites", step: "sites" },
    ...(selectedSite
      ? [
          {
            label: selectedSite.displayName,
            step: "drives" as Step,
            id: selectedSite.id,
          },
        ]
      : []),
    ...(selectedDrive
      ? [
          {
            label: selectedDrive.name,
            step: "files" as Step,
            id: selectedDrive.id,
          },
        ]
      : []),
    ...folderStack.map((f) => ({
      label: f.name,
      step: "files" as Step,
      id: f.id,
    })),
  ];

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const filteredFiles = files.filter(
    (f) =>
      !searchQuery ||
      f.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const folders = filteredFiles.filter((f) => !!f.folder);
  const excelFiles = filteredFiles.filter(
    (f) =>
      !f.folder &&
      (f.name.endsWith(".xlsx") || f.name.endsWith(".xls")),
  );

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 px-4 py-3 border-b border-border bg-surface-hover/50 text-sm overflow-x-auto">
          {step !== "sites" && (
            <button
              onClick={handleBack}
              className="p-1 rounded hover:bg-surface-hover text-text-secondary hover:text-foreground shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          {breadcrumbs.map((bc, i) => (
            <span key={i} className="flex items-center gap-1 shrink-0">
              {i > 0 && (
                <ChevronRight className="w-3.5 h-3.5 text-text-tertiary" />
              )}
              <span
                className={clsx(
                  "truncate max-w-[140px]",
                  i === breadcrumbs.length - 1
                    ? "font-medium text-foreground"
                    : "text-text-secondary",
                )}
              >
                {bc.label}
              </span>
            </span>
          ))}
        </div>

        {/* Search (files step only) */}
        {step === "files" && (
          <div className="px-4 py-2 border-b border-border">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                placeholder="Rechercher un fichier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
              <span className="ml-3 text-sm text-text-secondary">
                Chargement…
              </span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 p-4 m-4 rounded-lg bg-red-50 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          ) : step === "sites" ? (
            sites.length === 0 ? (
              <div className="text-center py-12 text-sm text-text-tertiary">
                Aucun site SharePoint trouvé
              </div>
            ) : (
              sites.map((site) => (
                <button
                  key={site.id}
                  onClick={() => handleSiteSelect(site)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left border-b border-border last:border-0"
                >
                  <Globe className="w-5 h-5 text-accent shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {site.displayName}
                    </p>
                    <p className="text-xs text-text-tertiary truncate">
                      {site.webUrl}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0" />
                </button>
              ))
            )
          ) : step === "drives" ? (
            drives.length === 0 ? (
              <div className="text-center py-12 text-sm text-text-tertiary">
                Aucune bibliothèque de documents trouvée
              </div>
            ) : (
              drives.map((drive) => (
                <button
                  key={drive.id}
                  onClick={() => handleDriveSelect(drive)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left border-b border-border last:border-0"
                >
                  <HardDrive className="w-5 h-5 text-amber-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {drive.name}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0" />
                </button>
              ))
            )
          ) : (
            <>
              {/* Folders */}
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => handleFileClick(folder)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left border-b border-border last:border-0"
                >
                  <Folder className="w-5 h-5 text-amber-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {folder.name}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {folder.folder!.childCount} élément
                      {folder.folder!.childCount > 1 ? "s" : ""}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0" />
                </button>
              ))}

              {/* Excel files with checkboxes + date inputs */}
              {excelFiles.length === 0 && folders.length === 0 && (
                <div className="text-center py-12 text-sm text-text-tertiary">
                  {searchQuery
                    ? "Aucun fichier trouvé"
                    : "Ce dossier est vide"}
                </div>
              )}
              {excelFiles.length > 0 && (
                <div className="px-4 py-2 border-b border-border bg-surface-hover/30">
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Fichiers Excel — sélectionnez les exports à analyser
                  </p>
                </div>
              )}
              {excelFiles.map((file) => {
                const sel = selectedFiles.get(file.id);
                const isChecked = sel?.checked ?? false;
                const fileDate = sel?.date ?? new Date();

                return (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-surface-hover/50"
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleFile(file.id)}
                      className="shrink-0 text-accent"
                    >
                      {isChecked ? (
                        <CheckSquare className="w-5 h-5" />
                      ) : (
                        <Square className="w-5 h-5 text-text-tertiary" />
                      )}
                    </button>

                    {/* File icon + name */}
                    <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-text-tertiary">
                        {formatSize(file.size)}
                        {file.lastModifiedBy?.user?.displayName && (
                          <>
                            {" "}
                            &middot;{" "}
                            {file.lastModifiedBy.user.displayName}
                          </>
                        )}
                      </p>
                    </div>

                    {/* Date input */}
                    <div className="shrink-0">
                      <input
                        type="date"
                        value={formatDateForInput(fileDate)}
                        onChange={(e) =>
                          updateFileDate(file.id, e.target.value)
                        }
                        className="px-2 py-1 text-xs rounded-md border border-border bg-background focus:outline-none focus:border-accent w-36"
                      />
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Analyze button (shown when xlsx files are visible) */}
        {step === "files" && excelFiles.length > 0 && (
          <div className="px-4 py-3 border-t border-border bg-surface-hover/30">
            {downloading ? (
              <div className="flex items-center justify-center gap-3 py-1">
                <Loader2 className="w-5 h-5 text-accent animate-spin" />
                <span className="text-sm text-text-secondary">
                  {downloadProgress}
                </span>
              </div>
            ) : (
              <button
                onClick={handleAnalyze}
                disabled={checkedCount === 0 || isLoading}
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
        )}
      </div>
    </div>
  );
}
