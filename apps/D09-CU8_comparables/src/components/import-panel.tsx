"use client";

import { useState, useRef } from "react";
import type { Comparable, ParsedExcelData } from "@/lib/types";
import { parseExcelRows } from "@/lib/excel-parser";
import { geocode, hasCoords } from "@/lib/geocode";
import SidePanel from "./side-panel";
import { FolderOpen } from "lucide-react";

interface ImportPanelProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: (
    actif: { nom: string; adresse: string; lat: number; lng: number } | null,
    comps: Comparable[]
  ) => void;
}

type Phase = "select" | "progress" | "done";

export default function ImportPanel({
  open,
  onClose,
  onImportComplete,
}: ImportPanelProps) {
  const [phase, setPhase] = useState<Phase>("select");
  const [parsed, setParsed] = useState<ParsedExcelData | null>(null);
  const [filename, setFilename] = useState("");
  const [city, setCity] = useState("Paris");
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [error, setError] = useState("");
  const abortRef = useRef(false);
  const busyRef = useRef(false);

  const reset = () => {
    setPhase("select");
    setParsed(null);
    setFilename("");
    setCity("Paris");
    setProgress({ done: 0, total: 0, failed: 0 });
    setError("");
    abortRef.current = false;
    busyRef.current = false;
  };

  const handleClose = () => {
    if (busyRef.current) {
      abortRef.current = true;
      return;
    }
    reset();
    onClose();
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setError("");

    const XLSX = await import("xlsx");
    const data = new Uint8Array(await file.arrayBuffer());
    const wb = XLSX.read(data, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, {
      defval: "",
      header: 1,
    });

    const result = parseExcelRows(rows);
    if (result.error) {
      setError(result.error);
      setParsed(null);
    } else {
      setParsed(result);
    }
  };

  const startImport = async () => {
    if (!parsed) return;
    busyRef.current = true;
    abortRef.current = false;
    setPhase("progress");

    const { refAddr, comps: newComps } = parsed;
    const cityVal = city.trim() || "Paris";

    let refObj: { nom: string; adresse: string; lat: number | null; lng: number | null } | null =
      null;

    interface GeoItem {
      obj: { lat: number | null; lng: number | null; adresse?: string; nom?: string };
      addr: string;
    }

    const toGeocode: GeoItem[] = [];
    if (refAddr) {
      const ref = { nom: refAddr, adresse: refAddr, lat: null as number | null, lng: null as number | null };
      toGeocode.push({ obj: ref, addr: refAddr });
      refObj = ref;
    }
    newComps.forEach((c) => {
      if (!hasCoords(c.lat, c.lng) && c.adresse) {
        toGeocode.push({ obj: c, addr: c.adresse });
      }
    });

    const total = toGeocode.length;
    let done = 0;
    let failed = 0;
    setProgress({ done: 0, total, failed: 0 });

    for (const item of toGeocode) {
      if (abortRef.current) break;
      let result: { lat: number; lng: number } | null = null;
      try {
        result = await geocode(item.addr + ", " + cityVal);
      } catch {
        try {
          result = await geocode(item.addr);
        } catch {
          // both failed
        }
      }
      if (result) {
        item.obj.lat = result.lat;
        item.obj.lng = result.lng;
      } else {
        failed++;
      }
      done++;
      setProgress({ done, total, failed });
      if (abortRef.current) break;
      if (done < total) await new Promise((r) => setTimeout(r, 1100));
    }

    if (!abortRef.current) {
      setPhase("done");
      setTimeout(() => {
        onImportComplete(
          refObj && hasCoords(refObj.lat, refObj.lng) ? { nom: refObj.nom, adresse: refObj.adresse, lat: refObj.lat!, lng: refObj.lng! } : null,
          newComps
        );
        busyRef.current = false;
        reset();
        onClose();
      }, 1200);
    } else {
      busyRef.current = false;
      reset();
      onClose();
    }
  };

  return (
    <SidePanel
      open={open}
      title="Importer des comparables"
      onClose={handleClose}
      busy={busyRef.current}
      footer={
        phase === "select" ? (
          <>
            <button
              onClick={handleClose}
              className="px-5 py-2.5 border-none rounded-lg text-xs font-semibold cursor-pointer bg-surface-alt text-text-secondary hover:bg-surface-hover"
            >
              Annuler
            </button>
            <button
              onClick={startImport}
              disabled={!parsed}
              className="flex-1 px-5 py-2.5 border-none rounded-lg text-xs font-bold cursor-pointer bg-success text-white hover:bg-success-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ✓ Importer et géocoder
            </button>
          </>
        ) : phase === "progress" ? (
          <button
            onClick={() => {
              abortRef.current = true;
            }}
            className="px-5 py-2.5 border-none rounded-lg text-xs font-semibold cursor-pointer bg-surface-alt text-text-secondary hover:bg-surface-hover"
          >
            Annuler l&apos;import
          </button>
        ) : undefined
      }
    >
      {phase === "select" && (
        <>
          <label className="flex flex-col items-center gap-3 p-7 border-2 border-dashed border-border-input rounded-xl cursor-pointer transition-colors hover:border-map-blue hover:bg-map-blue/[.03]">
            <FolderOpen className="w-8 h-8 text-text-tertiary" />
            <span className="text-xs text-text-secondary">
              Cliquez pour sélectionner un fichier .xlsx
            </span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={onFileSelected}
              className="hidden"
            />
          </label>
          {filename && (
            <div className="text-[11px] text-success mt-2 font-semibold text-center">
              ✓ {filename}
            </div>
          )}
          {error && (
            <div className="text-xs text-danger mt-2">✕ {error}</div>
          )}

          <div className="mb-3.5 mt-4">
            <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">
              Complément d&apos;adresse (ville)
            </label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Paris, Lyon, Marseille..."
              className="w-full px-3 py-2 border-[1.5px] border-border-input rounded-lg text-xs font-sans transition-colors focus:outline-none focus:border-map-green focus:ring-2 focus:ring-map-green/10"
            />
          </div>

          {parsed && (
            <div className="mt-3 text-xs p-3 bg-surface-alt rounded-lg">
              {parsed.refAddr && (
                <div className="mb-1.5">
                  <span className="font-semibold">Référence :</span>{" "}
                  {parsed.refAddr}
                </div>
              )}
              <div>
                <span className="font-semibold">{parsed.comps.length}</span>{" "}
                comparable{parsed.comps.length > 1 ? "s" : ""} trouvé
                {parsed.comps.length > 1 ? "s" : ""}
              </div>
              <div className="mt-2 text-[10px] text-text-tertiary">
                Colonnes : {parsed.columns.join(", ")}
              </div>
            </div>
          )}
        </>
      )}

      {phase === "progress" && (
        <div className="text-center py-6">
          <div className="text-3xl mb-3">📍</div>
          <div className="font-semibold text-sm mb-2">
            Géocodage en cours…
          </div>
          <div className="text-xs text-text-tertiary mb-4">
            {progress.done} / {progress.total}
            {progress.failed > 0 && (
              <span className="text-danger">
                {" "}
                ({progress.failed} échec{progress.failed > 1 ? "s" : ""})
              </span>
            )}
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-[width] duration-300"
              style={{
                width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="text-center py-6">
          <div className="text-3xl mb-3">✓</div>
          <div className="font-semibold text-sm mb-2">Import terminé</div>
          <div className="text-xs text-text-tertiary">
            {progress.done - progress.failed} comparable
            {progress.done - progress.failed > 1 ? "s" : ""} localisé
            {progress.done - progress.failed > 1 ? "s" : ""}
            {progress.failed > 0 && (
              <>
                <br />
                <span className="text-danger">
                  {progress.failed} adresse
                  {progress.failed > 1 ? "s" : ""} non trouvée
                  {progress.failed > 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </SidePanel>
  );
}
