import type { LucideIcon } from "lucide-react";
import { Newspaper, Mail, FileSpreadsheet } from "lucide-react";
import type { Status } from "./use-cases";

export interface Agent {
  id: string;
  name: string;
  direction: string;
  directionName: string;
  description: string;
  status: Status;
  icon: LucideIcon;
  color: string;
  tech: string[];
  url?: string;
}

export const agents: Agent[] = [
  {
    id: "D03-CU5",
    name: "Veille Presse",
    direction: "D03",
    directionName: "Capital Markets",
    description:
      "Agent de veille hebdomadaire Business Immo et Le Monde. Scrape les articles, analyse les signaux marche et genere un rapport structure.",
    status: "in_progress",
    icon: Newspaper,
    color: "#6366f1",
    tech: ["Python", "Playwright", "Azure Functions"],
  },
  {
    id: "D04-CU3",
    name: "Newsletter Signaux",
    direction: "D04",
    directionName: "Office Leasing",
    description:
      "Newsletter matinale IA : levees de fonds, recrutements, nominations. Analyse les signaux d'achat pour identifier les prospects.",
    status: "in_progress",
    icon: Mail,
    color: "#8b5cf6",
    tech: ["Python", "OpenAI", "Azure Functions"],
  },
  {
    id: "D07-CU1",
    name: "Lecture Presse → Excel",
    direction: "D07",
    directionName: "Research",
    description:
      "Scrape les articles Business Immo, classifie via Claude comme transaction ou non, extrait ~35 champs et genere un fichier Excel.",
    status: "deployed",
    icon: FileSpreadsheet,
    color: "#14b8a6",
    tech: ["Python", "Claude API", "openpyxl", "Azure Functions"],
  },
];
