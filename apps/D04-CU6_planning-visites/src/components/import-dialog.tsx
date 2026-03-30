"use client";

import { useState, useCallback, useRef } from "react";
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
import { parseVisitsExcel } from "@/lib/parse-visits-xlsx";
import { geocode } from "@/lib/geocode";
import type { Visit } from "@/lib/types";
import {
  Upload, Globe, FileSpreadsheet, Folder, HardDrive,
  ChevronRight, ArrowLeft, Loader2, Search, AlertCircle, X, CheckCircle, MapPin,
} from "lucide-react";
import { clsx } from "clsx";

type SourceMode = "local" | "sharepoint";
type SPStep = "sites" | "drives" | "files";
type Phase = "select" | "geocoding" | "done";

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (visits: Visit[]) => void;
}

export default function ImportDialog({ open, onClose, onImport }: ImportDialogProps) {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  const [sourceMode, setSourceMode] = useState<SourceMode>("local");
  const [phase, setPhase] = useState<Phase>("select");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [fileName, setFileName] = useState("");

  // Geocoding progress
  const [geocodeProgress, setGeocodeProgress] = useState({ current: 0, total: 0 });
  const abortRef = useRef(false);

  // Local file
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // SharePoint
  const [spStep, setSpStep] = useState<SPStep>("sites");
  const [sites, setSites] = useState<SharePointSite[]>([]);
  const [drives, setDrives] = useState<SharePointDrive[]>([]);
  const [files, setFiles] = useState<SharePointFile[]>([]);
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([]);
  const [selectedSite, setSelectedSite] = useState<SharePointSite | null>(null);
  const [selectedDrive, setSelectedDrive] = useState<SharePointDrive | null>(null);
  const [spLoading, setSpLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const sitesLoaded = useRef(false);

  const geocodeVisits = useCallback(async (visits: Visit[]): Promise<Visit[]> => {
    const needsGeocode = visits.filter((v) => v.lat == null || v.lng == null);
    if (!needsGeocode.length) return visits;

    setPhase("geocoding");
    setGeocodeProgress({ current: 0, total: needsGeocode.length });
    abortRef.current = false;

    const result = [...visits];
    let geocoded = 0;

    for (let i = 0; i < result.length; i++) {
      if (abortRef.current) break;
      if (result[i].lat != null && result[i].lng != null) continue;

      try {
        const coords = await geocode(result[i].address || result[i].name);
        if (coords) {
          result[i] = { ...result[i], lat: coords.lat, lng: coords.lng };
        }
      } catch { /* skip */ }

      geocoded++;
      setGeocodeProgress({ current: geocoded, total: needsGeocode.length });
      // Rate limit for Nominatim
      if (geocoded < needsGeocode.length) {
        await new Promise((r) => setTimeout(r, 1100));
      }
    }

    return result;
  }, []);

  const handleBuffer = useCallback(async (buffer: ArrayBuffer, name: string) => {
    setParsing(true);
    setError(null);
    setFileName(name);
    try {
      const visits = await parseVisitsExcel(buffer);
      if (visits.length === 0) {
        setError("Aucune visite trouvée. Vérifiez que le fichier contient des colonnes 'Nom' et/ou 'Adresse'.");
        setParsing(false);
        return;
      }
      setParsing(false);

      const geocoded = await geocodeVisits(visits);
      if (abortRef.current) {
        setPhase("select");
        return;
      }

      const valid = geocoded.filter((v) => v.lat != null && v.lng != null);
      if (valid.length === 0) {
        setError("Aucune adresse n'a pu être géolocalisée. Vérifiez les adresses du fichier.");
        setPhase("select");
        return;
      }

      onImport(valid);
      setImportedCount(valid.length);
      setPhase("done");
    } catch (e: unknown) {
      setError(`Erreur de lecture : ${(e as Error).message}`);
      setParsing(false);
      setPhase("select");
    }
  }, [geocodeVisits, onImport]);

  // ─── Local file handlers ───
  const processFile = useCallback((file: File) => {
    setError(null);
    setPhase("select");
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setError("Veuillez sélectionner un fichier Excel (.xlsx ou .xls)");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("Le fichier est trop volumineux (max 50 Mo)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result instanceof ArrayBuffer) handleBuffer(e.target.result, file.name);
    };
    reader.onerror = () => setError("Erreur lors de la lecture du fichier");
    reader.readAsArrayBuffer(file);
  }, [handleBuffer]);

  // ─── SharePoint handlers ───
  const loadSites = useCallback(async () => {
    if (!account || sitesLoaded.current) return;
    sitesLoaded.current = true;
    setSpLoading(true);
    setError(null);
    try {
      setSites(await searchSites(instance, account));
    } catch (e: unknown) {
      setError(`Impossible de charger les sites : ${(e as Error).message}`);
    } finally {
      setSpLoading(false);
    }
  }, [instance, account]);

  const handleSiteSelect = useCallback(async (site: SharePointSite) => {
    setSelectedSite(site);
    setSpStep("drives");
    setSpLoading(true);
    setError(null);
    try { setDrives(await getSiteDrives(instance, account, site.id)); }
    catch (e: unknown) { setError(`Impossible de charger les bibliothèques : ${(e as Error).message}`); }
    finally { setSpLoading(false); }
  }, [instance, account]);

  const handleDriveSelect = useCallback(async (drive: SharePointDrive) => {
    setSelectedDrive(drive);
    setSpStep("files");
    setFolderStack([]);
    setSpLoading(true);
    setError(null);
    try { setFiles(await listDriveItems(instance, account, drive.id)); }
    catch (e: unknown) { setError(`Impossible de charger les fichiers : ${(e as Error).message}`); }
    finally { setSpLoading(false); }
  }, [instance, account]);

  const handleFolderOpen = useCallback(async (folder: SharePointFile) => {
    if (!selectedDrive) return;
    setFolderStack((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setSpLoading(true);
    setError(null);
    try { setFiles(await listDriveItems(instance, account, selectedDrive.id, folder.id)); }
    catch (e: unknown) { setError(`Impossible de charger le dossier : ${(e as Error).message}`); }
    finally { setSpLoading(false); }
  }, [instance, account, selectedDrive]);

  const handleSpBack = useCallback(async () => {
    if (spStep === "drives") { setSpStep("sites"); setSelectedSite(null); }
    else if (spStep === "files" && folderStack.length > 0) {
      const newStack = [...folderStack]; newStack.pop(); setFolderStack(newStack);
      setSpLoading(true);
      try {
        const parentId = newStack.length > 0 ? newStack[newStack.length - 1].id : undefined;
        setFiles(await listDriveItems(instance, account, selectedDrive!.id, parentId));
      } catch (e: unknown) { setError(`Erreur de navigation : ${(e as Error).message}`); }
      finally { setSpLoading(false); }
    } else if (spStep === "files") { setSpStep("drives"); setSelectedDrive(null); setFolderStack([]); }
  }, [spStep, folderStack, instance, account, selectedDrive]);

  const handleFileClick = useCallback(async (file: SharePointFile) => {
    if (file.folder) { handleFolderOpen(file); return; }
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) return;
    if (!selectedDrive) return;
    setDownloading(file.id);
    setError(null);
    try {
      const buffer = await downloadFile(instance, account, selectedDrive.id, file.id);
      await handleBuffer(buffer, file.name);
    } catch (e: unknown) {
      setError(`Impossible de télécharger le fichier : ${(e as Error).message}`);
    } finally { setDownloading(null); }
  }, [instance, account, selectedDrive, handleBuffer, handleFolderOpen]);

  const handleSwitchToSharePoint = useCallback(() => {
    setSourceMode("sharepoint");
    setError(null);
    setPhase("select");
    loadSites();
  }, [loadSites]);

  const handleClose = useCallback(() => {
    abortRef.current = true;
    setPhase("select");
    setError(null);
    setParsing(false);
    setImportedCount(0);
    onClose();
  }, [onClose]);

  if (!open) return null;

  const isExcel = (name: string) => name.endsWith(".xlsx") || name.endsWith(".xls");
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const filteredFiles = files.filter(
    (f) => !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const breadcrumbs = [
    { label: "Sites" },
    ...(selectedSite ? [{ label: selectedSite.displayName }] : []),
    ...(selectedDrive ? [{ label: selectedDrive.name }] : []),
    ...folderStack.map((f) => ({ label: f.name })),
  ];

  return (
    <div className="fixed inset-0 z-[3000] bg-black/60 backdrop-blur-[4px] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h3 className="text-sm font-bold">Importer des visites</h3>
          <button onClick={handleClose} className="p-1 rounded hover:bg-surface-hover text-text-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Source toggle */}
        {phase === "select" && (
          <div className="px-5 pt-4 shrink-0">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-alt w-fit">
              <button
                onClick={() => { setSourceMode("local"); setError(null); }}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all",
                  sourceMode === "local" ? "bg-white text-foreground shadow-sm" : "text-text-secondary hover:text-foreground"
                )}
              >
                <Upload className="w-3.5 h-3.5" /> Fichier local
              </button>
              <button
                onClick={handleSwitchToSharePoint}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all",
                  sourceMode === "sharepoint" ? "bg-white text-foreground shadow-sm" : "text-text-secondary hover:text-foreground"
                )}
              >
                <Globe className="w-3.5 h-3.5" /> SharePoint
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Success */}
          {phase === "done" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">{importedCount} visites importées</p>
                <p className="text-xs text-text-secondary mt-1">depuis {fileName}</p>
              </div>
            </div>
          )}

          {/* Geocoding progress */}
          {phase === "geocoding" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
                <MapPin className="w-7 h-7 text-accent animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">Géolocalisation des adresses…</p>
                <p className="text-xs text-text-secondary mt-1">
                  {geocodeProgress.current} / {geocodeProgress.total}
                </p>
              </div>
              <div className="w-64 h-1.5 bg-surface-alt rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${geocodeProgress.total ? (geocodeProgress.current / geocodeProgress.total) * 100 : 0}%` }}
                />
              </div>
              <button
                onClick={() => { abortRef.current = true; }}
                className="text-xs text-text-tertiary hover:text-danger transition-colors"
              >
                Annuler
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 text-red-700 text-sm mb-4">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          {/* Local upload */}
          {phase === "select" && sourceMode === "local" && (
            <div
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onClick={() => inputRef.current?.click()}
              className={clsx(
                "cursor-pointer rounded-xl border-2 border-dashed p-10 flex flex-col items-center justify-center gap-3 text-center transition-all",
                isDragging ? "border-accent bg-accent/5 scale-[1.01]" : "border-border hover:border-accent/50 hover:bg-surface-hover/50",
                parsing && "pointer-events-none opacity-60"
              )}
            >
              <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} className="hidden" />
              {parsing ? (
                <>
                  <div className="w-10 h-10 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
                  <p className="text-xs text-text-secondary font-medium">Analyse en cours…</p>
                </>
              ) : (
                <>
                  <div className={clsx("rounded-xl p-3 transition-colors", isDragging ? "bg-accent/10" : "bg-surface-alt")}>
                    {isDragging ? <FileSpreadsheet className="w-8 h-8 text-accent" /> : <Upload className="w-8 h-8 text-text-tertiary" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">
                      {isDragging ? "Déposez votre fichier ici" : "Glissez-déposez un fichier Excel"}
                    </p>
                    <p className="text-xs text-text-secondary">
                      ou <span className="text-accent font-medium">parcourez</span> vos fichiers — .xlsx, .xls (max 50 Mo)
                    </p>
                    <p className="text-[10px] text-text-tertiary mt-2">
                      Colonnes attendues : Nom, Adresse, Durée (min), Latitude, Longitude
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* SharePoint browser */}
          {phase === "select" && sourceMode === "sharepoint" && (
            <div className="rounded-xl border border-border overflow-hidden">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1 px-4 py-2.5 border-b border-border bg-surface-alt/50 text-xs overflow-x-auto">
                {spStep !== "sites" && (
                  <button onClick={handleSpBack} className="p-1 rounded hover:bg-surface-hover text-text-secondary hover:text-foreground shrink-0">
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                )}
                {breadcrumbs.map((bc, i) => (
                  <span key={i} className="flex items-center gap-1 shrink-0">
                    {i > 0 && <ChevronRight className="w-3 h-3 text-text-tertiary" />}
                    <span className={clsx("truncate max-w-[120px]", i === breadcrumbs.length - 1 ? "font-medium text-foreground" : "text-text-secondary")}>
                      {bc.label}
                    </span>
                  </span>
                ))}
              </div>

              {/* Search (files only) */}
              {spStep === "files" && (
                <div className="px-3 py-2 border-b border-border">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
                    <input
                      type="text" placeholder="Rechercher un fichier…"
                      value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              )}

              {/* List */}
              <div className="max-h-72 overflow-y-auto">
                {spLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 text-accent animate-spin" />
                    <span className="ml-2 text-xs text-text-secondary">Chargement…</span>
                  </div>
                ) : spStep === "sites" ? (
                  sites.length === 0 ? (
                    <div className="text-center py-10 text-xs text-text-tertiary">Aucun site SharePoint trouvé</div>
                  ) : sites.map((site) => (
                    <button key={site.id} onClick={() => handleSiteSelect(site)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors text-left border-b border-border last:border-0">
                      <Globe className="w-4 h-4 text-accent shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{site.displayName}</p>
                        <p className="text-[10px] text-text-tertiary truncate">{site.webUrl}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                    </button>
                  ))
                ) : spStep === "drives" ? (
                  drives.length === 0 ? (
                    <div className="text-center py-10 text-xs text-text-tertiary">Aucune bibliothèque trouvée</div>
                  ) : drives.map((drive) => (
                    <button key={drive.id} onClick={() => handleDriveSelect(drive)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors text-left border-b border-border last:border-0">
                      <HardDrive className="w-4 h-4 text-amber-500 shrink-0" />
                      <p className="text-xs font-medium text-foreground truncate flex-1">{drive.name}</p>
                      <ChevronRight className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                    </button>
                  ))
                ) : filteredFiles.length === 0 ? (
                  <div className="text-center py-10 text-xs text-text-tertiary">
                    {searchQuery ? "Aucun fichier trouvé" : "Ce dossier est vide"}
                  </div>
                ) : filteredFiles.map((file) => {
                  const isFolder = !!file.folder;
                  const isXlsx = isExcel(file.name);
                  const isClickable = isFolder || isXlsx;
                  const isDown = downloading === file.id;
                  return (
                    <button key={file.id} onClick={() => isClickable && handleFileClick(file)}
                      disabled={!isClickable || isDown || parsing}
                      className={clsx(
                        "w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left border-b border-border last:border-0",
                        isClickable ? "hover:bg-surface-hover cursor-pointer" : "opacity-40 cursor-default",
                        isDown && "bg-accent/5"
                      )}>
                      {isDown ? <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />
                        : isFolder ? <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                        : <FileSpreadsheet className={clsx("w-4 h-4 shrink-0", isXlsx ? "text-green-600" : "text-text-tertiary")} />}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
                        <p className="text-[10px] text-text-tertiary">
                          {isFolder ? `${file.folder!.childCount} élément${file.folder!.childCount > 1 ? "s" : ""}` : formatSize(file.size)}
                          {file.lastModifiedBy?.user?.displayName && <> · {file.lastModifiedBy.user.displayName}</>}
                        </p>
                      </div>
                      {isFolder && <ChevronRight className="w-3.5 h-3.5 text-text-tertiary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {phase === "done" && (
          <div className="px-5 py-3 border-t border-border shrink-0 flex justify-end">
            <button onClick={handleClose}
              className="px-5 py-2 text-xs font-semibold bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors">
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
