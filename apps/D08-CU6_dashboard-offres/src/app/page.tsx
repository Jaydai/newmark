"use client";

import { useState, useCallback } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { WelcomeScreen } from "@/components/upload/welcome-screen";
import { Dashboard } from "@/components/dashboard/dashboard";
import { parseMultipleFiles } from "@/utils/parse-xlsx";
import type { DashboardData } from "@/types/kpi";

export default function Home() {
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFilesReady = useCallback(
    async (
      files: { buffer: ArrayBuffer; fileName: string; date: Date }[],
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        // Small delay to let the loading UI render
        await new Promise((r) => setTimeout(r, 100));
        const data = parseMultipleFiles(files);
        setDashData(data);
      } catch (e) {
        console.error("Parse error:", e);
        setError(
          "Erreur lors de l'analyse des fichiers. Vérifiez le format.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const handleReset = useCallback(() => {
    setDashData(null);
    setError(null);
  }, []);

  return (
    <AuthGuard>
      {dashData ? (
        <Dashboard data={dashData} onReset={handleReset} />
      ) : (
        <>
          <WelcomeScreen
            onFilesReady={handleFilesReady}
            isLoading={isLoading}
          />
          {error && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg text-sm font-medium">
              {error}
            </div>
          )}
        </>
      )}
    </AuthGuard>
  );
}
