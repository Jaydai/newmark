import type { Metadata } from "next";
import GraphistesTimesheetLauncher from "@/components/tools/graphistes-timesheet-launcher";

export const metadata: Metadata = {
  title: "Newmark - Feuilles de Temps Graphistes",
  description:
    "Lanceur vers la miniapp feuilles de temps graphistes avec SQLite partagee",
};

export default function GraphistesTimesheetPage() {
  return <GraphistesTimesheetLauncher />;
}
