"use client";

import { useState, useCallback, useRef, DragEvent } from "react";
import { useMsal } from "@azure/msal-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { uploadFileToSharePoint, searchSites, getSiteDrives } from "@/lib/graph-client";
import Image from "next/image";
import {
  Search,
  Upload,
  FileSpreadsheet,
  Loader2,
  Download,
  ExternalLink,
  RotateCcw,
  Building2,
  AlertCircle,
  CheckCircle2,
  LogOut,
  FolderUp,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface LookupResult {
  status: string;
  addresses_count: number;
  xlsx_base64: string;
  summary: {
    address: string;
    owner: string;
    owner_type: string;
    siren: string;
    dirigeants_count: number;
  }[];
}

type AppState = "input" | "submitting" | "polling" | "done" | "error";

export default function Home() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  const [appState, setAppState] = useState<AppState>("input");
  const [addresses, setAddresses] = useState<string[]>([]);
  const [singleAddress, setSingleAddress] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState("");
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- CSV Parsing ---
  const parseCSV = useCallback((text: string): string[] => {
    const lines = text.trim().split("\n");
    if (lines.length === 0) return [];

    // Detect delimiter
    const header = lines[0].toLowerCase();
    const delimiter = header.includes(";") ? ";" : ",";
    const headers = header.split(delimiter).map((h) => h.trim().replace(/"/g, ""));

    // Find the address column
    const addrIdx = headers.findIndex((h) =>
      ["adresse", "address", "adresses", "addresses", "addr"].includes(h),
    );
    if (addrIdx === -1) {
      // If no header match, treat single-column CSV as addresses
      if (headers.length === 1) {
        return lines.map((l) => l.trim().replace(/"/g, "")).filter(Boolean);
      }
      throw new Error(
        'Colonne "adresse" introuvable. Colonnes trouvées : ' +
          headers.join(", "),
      );
    }

    return lines
      .slice(1)
      .map((line) => {
        const cols = line.split(delimiter);
        return (cols[addrIdx] || "").trim().replace(/"/g, "");
      })
      .filter(Boolean);
  }, []);

  const handleFileUpload = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const addrs = parseCSV(text);
          if (addrs.length === 0) {
            setError("Aucune adresse trouvée dans le fichier.");
            return;
          }
          if (addrs.length > 20) {
            setError("Maximum 20 adresses par lot.");
            return;
          }
          setAddresses(addrs);
          setError("");
        } catch (err) {
          setError((err as Error).message);
        }
      };
      reader.readAsText(file);
    },
    [parseCSV],
  );

  // --- Drag & Drop ---
  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith(".csv") || file.name.endsWith(".txt"))) {
        handleFileUpload(file);
      } else {
        setError("Format non supporté. Utilisez un fichier CSV.");
      }
    },
    [handleFileUpload],
  );

  // --- API Call ---
  const startLookup = useCallback(
    async (addrs: string[]) => {
      setAppState("submitting");
      setError("");
      setResult(null);

      try {
        const res = await fetch(`${API_URL}/start-lookup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ addresses: addrs }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }

        const { job_id } = await res.json();
        setAppState("polling");

        // Poll for results
        let attempts = 0;
        const maxAttempts = 120; // 10 min max (5s intervals)
        while (attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 5000));
          attempts++;

          const pollRes = await fetch(
            `${API_URL}/lookup-results?job_id=${job_id}`,
          );
          if (pollRes.status === 202) continue;
          if (pollRes.status === 200) {
            const data: LookupResult = await pollRes.json();
            setResult(data);
            setAppState("done");
            return;
          }
          const errBody = await pollRes.json().catch(() => ({}));
          throw new Error(errBody.error || `Polling error: HTTP ${pollRes.status}`);
        }

        throw new Error("Timeout — la recherche a pris trop de temps.");
      } catch (err) {
        setError((err as Error).message);
        setAppState("error");
      }
    },
    [],
  );

  // --- Download Excel ---
  const downloadExcel = useCallback(() => {
    if (!result?.xlsx_base64) return;
    const bytes = Uint8Array.from(atob(result.xlsx_base64), (c) =>
      c.charCodeAt(0),
    );
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proprietaires_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  // --- Save to SharePoint ---
  const saveToSharePoint = useCallback(async () => {
    if (!result?.xlsx_base64 || !account) return;
    setUploadStatus("searching");

    try {
      // Search for Newmark site
      const sites = await searchSites(instance, account, "Newmark");
      if (sites.length === 0) {
        setUploadStatus("error:Aucun site SharePoint Newmark trouvé");
        return;
      }

      setUploadStatus("uploading");
      const drives = await getSiteDrives(instance, account, sites[0].id);
      if (drives.length === 0) {
        setUploadStatus("error:Aucune bibliothèque de documents trouvée");
        return;
      }

      const bytes = Uint8Array.from(atob(result.xlsx_base64), (c) =>
        c.charCodeAt(0),
      );
      const fileName = `proprietaires_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const uploaded = await uploadFileToSharePoint(
        instance,
        account,
        drives[0].id,
        "Recherche Proprietaires",
        fileName,
        bytes.buffer,
      );

      setUploadStatus(`done:${uploaded.webUrl}`);
    } catch (err) {
      console.error("SharePoint upload error:", err);
      setUploadStatus(`error:${(err as Error).message}`);
    }
  }, [result, instance, account]);

  // --- Reset ---
  const reset = useCallback(() => {
    setAppState("input");
    setAddresses([]);
    setSingleAddress("");
    setResult(null);
    setError("");
    setUploadStatus(null);
  }, []);

  const handleLogout = () => {
    instance.logoutRedirect();
  };

  return (
    <AuthGuard>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-border bg-surface/80 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Image
                src="/newmark-logo.svg"
                alt="Newmark"
                width={140}
                height={32}
                priority
                className="h-7 w-auto"
              />
              <span className="text-sm text-text-secondary hidden sm:block">
                Recherche Propriétaire
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="text-text-secondary hover:text-foreground text-sm flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10">
          {/* Input State */}
          {appState === "input" && (
            <div className="animate-fade-in space-y-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-light mb-4">
                  <Building2 className="w-7 h-7 text-accent" />
                </div>
                <h1 className="text-2xl font-bold mb-2">
                  Recherche de propriétaires
                </h1>
                <p className="text-text-secondary">
                  Identifiez les propriétaires d&apos;immeubles via La Place de
                  l&apos;Immobilier
                </p>
              </div>

              {/* Single Address */}
              <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <Search className="w-4 h-4 text-accent" />
                  Adresse unique
                </h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (singleAddress.trim()) {
                      startLookup([singleAddress.trim()]);
                    }
                  }}
                  className="flex gap-3"
                >
                  <input
                    type="text"
                    value={singleAddress}
                    onChange={(e) => setSingleAddress(e.target.value)}
                    placeholder="12 rue de la Paix, 75002 Paris"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  />
                  <button
                    type="submit"
                    disabled={!singleAddress.trim()}
                    className="px-5 py-2.5 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Rechercher
                  </button>
                </form>
              </div>

              {/* CSV Upload */}
              <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-accent" />
                  Import CSV (lot)
                </h2>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? "dropzone-active bg-accent-light/50"
                      : "border-border hover:border-accent/50 hover:bg-surface-hover"
                  }`}
                >
                  <FileSpreadsheet className="w-8 h-8 text-text-tertiary mx-auto mb-3" />
                  <p className="text-sm text-text-secondary mb-1">
                    Glissez un fichier CSV ou cliquez pour parcourir
                  </p>
                  <p className="text-xs text-text-tertiary">
                    Colonne &quot;adresse&quot; requise, 20 adresses max
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />
                </div>

                {/* Show parsed addresses */}
                {addresses.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">
                      {addresses.length} adresse{addresses.length > 1 ? "s" : ""}{" "}
                      trouvée{addresses.length > 1 ? "s" : ""} :
                    </p>
                    <ul className="text-sm text-text-secondary space-y-1 max-h-40 overflow-y-auto">
                      {addresses.map((a, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="text-text-tertiary text-xs w-5 text-right">
                            {i + 1}.
                          </span>
                          {a}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => startLookup(addresses)}
                      className="mt-4 px-5 py-2.5 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-accent/90"
                    >
                      Lancer la recherche ({addresses.length} adresse
                      {addresses.length > 1 ? "s" : ""})
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 px-4 py-3 rounded-xl">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Loading / Polling State */}
          {(appState === "submitting" || appState === "polling") && (
            <div className="animate-fade-in flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-accent animate-spin mb-6" />
              <h2 className="text-lg font-semibold mb-2">
                {appState === "submitting"
                  ? "Lancement de la recherche..."
                  : "Recherche en cours..."}
              </h2>
              <p className="text-text-secondary text-sm">
                {appState === "polling"
                  ? "Connexion à La Place de l'Immobilier et extraction des données. Cela peut prendre quelques minutes."
                  : "Envoi des adresses au serveur..."}
              </p>
            </div>
          )}

          {/* Results State */}
          {appState === "done" && result && (
            <div className="animate-fade-in space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  Résultats ({result.addresses_count} adresse
                  {result.addresses_count > 1 ? "s" : ""})
                </h2>
                <button
                  onClick={reset}
                  className="text-sm text-text-secondary hover:text-foreground flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  Nouvelle recherche
                </button>
              </div>

              {/* Summary Table */}
              <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-primary text-white text-left">
                      <th className="px-4 py-3 font-semibold">Adresse</th>
                      <th className="px-4 py-3 font-semibold">Propriétaire</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">SIREN</th>
                      <th className="px-4 py-3 font-semibold text-right">
                        Dirigeants
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.summary.map((row, i) => (
                      <tr
                        key={i}
                        className="border-t border-border hover:bg-surface-hover"
                      >
                        <td className="px-4 py-3">{row.address}</td>
                        <td className="px-4 py-3 font-medium">
                          {row.owner || (
                            <span className="text-text-tertiary italic">
                              Non trouvé
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {row.owner_type === "personne_morale" ? (
                            <span className="inline-flex items-center px-2 py-0.5 bg-accent-light text-accent text-xs rounded-full font-medium">
                              Société
                            </span>
                          ) : row.owner_type === "personne_physique" ? (
                            <span className="inline-flex items-center px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full font-medium">
                              Particulier
                            </span>
                          ) : (
                            ""
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {row.siren}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.dirigeants_count > 0 ? row.dirigeants_count : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={downloadExcel}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-accent/90 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Télécharger Excel
                </button>

                <button
                  onClick={saveToSharePoint}
                  disabled={
                    uploadStatus === "searching" ||
                    uploadStatus === "uploading"
                  }
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface text-foreground text-sm font-semibold rounded-xl border border-border hover:bg-surface-hover shadow-sm disabled:opacity-50"
                >
                  {uploadStatus === "searching" ||
                  uploadStatus === "uploading" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FolderUp className="w-4 h-4" />
                  )}
                  {uploadStatus === "searching"
                    ? "Recherche du site..."
                    : uploadStatus === "uploading"
                      ? "Upload en cours..."
                      : "Enregistrer dans SharePoint"}
                </button>
              </div>

              {/* SharePoint status */}
              {uploadStatus?.startsWith("done:") && (
                <div className="flex items-center gap-2 text-sm text-success bg-success/10 px-4 py-3 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  Fichier enregistré dans SharePoint
                  <a
                    href={uploadStatus.replace("done:", "")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-accent hover:underline flex items-center gap-1"
                  >
                    Ouvrir
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
              {uploadStatus?.startsWith("error:") && (
                <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 px-4 py-3 rounded-xl">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {uploadStatus.replace("error:", "")}
                </div>
              )}
            </div>
          )}

          {/* Error State */}
          {appState === "error" && (
            <div className="animate-fade-in flex flex-col items-center justify-center py-20">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-danger/10 mb-4">
                <AlertCircle className="w-7 h-7 text-danger" />
              </div>
              <h2 className="text-lg font-semibold mb-2">
                Erreur lors de la recherche
              </h2>
              <p className="text-text-secondary text-sm mb-6 text-center max-w-md">
                {error}
              </p>
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-accent/90"
              >
                <RotateCcw className="w-4 h-4" />
                Réessayer
              </button>
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
