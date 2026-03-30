"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { clsx } from "clsx";
import { detectDateFromFilename } from "@/utils/date-detect";

interface FileUploadProps {
  onFilesReady: (
    files: { buffer: ArrayBuffer; fileName: string; date: Date }[],
  ) => void;
  isLoading: boolean;
}

export function FileUpload({ onFilesReady, isLoading }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    (fileList: FileList) => {
      setError(null);
      const excelFiles = Array.from(fileList).filter(
        (f) => f.name.endsWith(".xlsx") || f.name.endsWith(".xls"),
      );
      if (excelFiles.length === 0) {
        setError(
          "Veuillez sélectionner un ou plusieurs fichiers Excel (.xlsx ou .xls)",
        );
        return;
      }
      for (const f of excelFiles) {
        if (f.size > 50 * 1024 * 1024) {
          setError(`Le fichier ${f.name} est trop volumineux (max 50 Mo)`);
          return;
        }
      }

      // Read all files
      Promise.all(
        excelFiles.map(
          (file) =>
            new Promise<{
              buffer: ArrayBuffer;
              fileName: string;
              date: Date;
            }>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                if (e.target?.result instanceof ArrayBuffer) {
                  resolve({
                    buffer: e.target.result,
                    fileName: file.name,
                    date: detectDateFromFilename(file.name) ?? new Date(),
                  });
                } else {
                  reject(new Error("Failed to read file"));
                }
              };
              reader.onerror = () => reject(new Error("Read error"));
              reader.readAsArrayBuffer(file);
            }),
        ),
      )
        .then((results) => onFilesReady(results))
        .catch(() => setError("Erreur lors de la lecture des fichiers"));
    },
    [onFilesReady],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
      }
    },
    [processFiles],
  );

  return (
    <div className="w-full max-w-xl mx-auto">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          "relative cursor-pointer rounded-2xl border-2 border-dashed p-12",
          "flex flex-col items-center justify-center gap-4 text-center",
          "transition-all duration-300",
          isDragging
            ? "border-accent bg-accent-light/50 scale-[1.02] dropzone-active"
            : "border-border hover:border-accent/50 hover:bg-surface-hover",
          isLoading && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          onChange={handleInputChange}
          className="hidden"
        />

        {isLoading ? (
          <>
            <div className="w-12 h-12 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
            <p className="text-sm text-text-secondary font-medium">
              Analyse en cours…
            </p>
          </>
        ) : (
          <>
            <div
              className={clsx(
                "rounded-2xl p-4 transition-colors",
                isDragging ? "bg-accent/10" : "bg-surface-hover",
              )}
            >
              {isDragging ? (
                <FileSpreadsheet className="w-10 h-10 text-accent" />
              ) : (
                <Upload className="w-10 h-10 text-text-tertiary" />
              )}
            </div>

            <div>
              <p className="text-base font-semibold text-foreground mb-1">
                {isDragging
                  ? "Déposez vos fichiers ici"
                  : "Importer des fichiers KPI"}
              </p>
              <p className="text-sm text-text-secondary">
                Glissez-déposez vos fichiers{" "}
                <span className="font-medium">.xlsx</span> ou{" "}
                <button className="text-accent font-medium hover:underline">
                  parcourez
                </button>
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs text-text-tertiary mt-2">
              <span className="flex items-center gap-1">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                .xlsx, .xls
              </span>
              <span>Multi-fichiers supporté</span>
              <span>Max 50 Mo / fichier</span>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
