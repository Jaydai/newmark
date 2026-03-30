import type { LucideIcon } from "lucide-react";
import {
  BarChart3, Map, Calendar, GitCompareArrows, Search,
  Building2, TrendingUp, Briefcase, ShoppingBag, Megaphone,
  BookOpen, Database, Users,
} from "lucide-react";

export type Status = "deployed" | "in_progress" | "planned" | "blocked" | "not_feasible";
export type CUType = "agent" | "app" | "prompt" | "external" | "tool";

export interface UseCase {
  id: string;
  name: string;
  description: string;
  status: Status;
  type: CUType;
  referent?: string;
  priority: "haute" | "moyenne" | "faible";
}

export interface Direction {
  id: string;
  name: string;
  color: string;
  icon: LucideIcon;
  useCases: UseCase[];
}

export interface DeployedApp {
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string;
  direction: string;
  access: "external" | "internal";
}

const URLS = {
  dashboard: process.env.NEXT_PUBLIC_URL_DASHBOARD || "",
  commercialisation: process.env.NEXT_PUBLIC_URL_COMMERCIALISATION || "",
  transactions: process.env.NEXT_PUBLIC_URL_TRANSACTIONS || "",
  offreRetail: process.env.NEXT_PUBLIC_URL_OFFRE_RETAIL || "",
  visites: process.env.NEXT_PUBLIC_URL_VISITES || "",
  comparables: process.env.NEXT_PUBLIC_URL_COMPARABLES || "",
  proprietaire: process.env.NEXT_PUBLIC_URL_PROPRIETAIRE || "",
};

export const deployedApps: DeployedApp[] = [
  {
    name: "Dashboard KPI Offres",
    description: "Suivi des offres par secteur, evolution et part de marche",
    href: URLS.dashboard,
    icon: BarChart3,
    color: "#0066cc",
    direction: "D08",
    access: "external",
  },
  {
    name: "Carte de Commercialisation",
    description:
      "Cartographie des actifs a commercialiser et des references de marche",
    href: `${URLS.commercialisation}?from=hub`,
    icon: Map,
    color: "#2d8c5a",
    direction: "D09",
    access: "external",
  },
  {
    name: "Carte des Transactions",
    description:
      "Analyse des transactions immobilieres avec carte et graphiques",
    href: `${URLS.transactions}?from=hub`,
    icon: BarChart3,
    color: "#2563eb",
    direction: "D09",
    access: "external",
  },
  {
    name: "Offre Retail",
    description:
      "Offres retail disponibles avec carte interactive et analyses",
    href: `${URLS.offreRetail}?from=hub`,
    icon: ShoppingBag,
    color: "#0062ae",
    direction: "D05",
    access: "external",
  },
  {
    name: "Planning Visites",
    description: "Organisation des visites clients avec temps de parcours",
    href: URLS.visites,
    icon: Calendar,
    color: "#7c3aed",
    direction: "D04",
    access: "external",
  },
  {
    name: "Comparables",
    description: "Analyse des transactions comparables par zone et typologie",
    href: URLS.comparables,
    icon: GitCompareArrows,
    color: "#d97706",
    direction: "D09",
    access: "external",
  },
  {
    name: "Recherche Proprietaire",
    description: "Identification des proprietaires via Pappers et La Place",
    href: URLS.proprietaire,
    icon: Search,
    color: "#dc2626",
    direction: "D05",
    access: "external",
  },
  {
    name: "Encarts Diffusion",
    description:
      "Generateur d'encarts Newmark dans une miniapp dediee avec SQLite partagee",
    href: "/outils/encarts-diffusion",
    icon: Megaphone,
    color: "#f97316",
    direction: "D08",
    access: "internal",
  },
  {
    name: "Feuilles de Temps Graphistes",
    description:
      "Suivi du temps par projet dans une miniapp Next dediee avec SQLite partagee",
    href: "/outils/feuilles-temps-graphistes",
    icon: Users,
    color: "#f43f5e",
    direction: "D06",
    access: "internal",
  },
];

export const directions: Direction[] = [
  {
    id: "D02",
    name: "Expertise Immobiliere",
    color: "#0ea5e9",
    icon: Building2,
    useCases: [
      { id: "CU1", name: "Redaction rapport auto", description: "Generer la partie redactionnelle a partir d'une adresse (urbanisme, cadastre, transports)", status: "in_progress", type: "agent", priority: "haute" },
      { id: "CU2", name: "Moteur de recherche interne", description: "Rechercher dans les 9 000+ dossiers passes par adresse et typologie", status: "blocked", type: "agent", priority: "haute" },
      { id: "CU3", name: "Scraping donnees hotelieres", description: "Collecter les prix moyens/nuit sur Booking.com pour hotels comparables", status: "in_progress", type: "agent", referent: "Quentin", priority: "moyenne" },
      { id: "CU4", name: "Scraping offres locatives", description: "Extraire les offres de SeLoger, LeBonCoin, BureauxLocaux", status: "deployed", type: "agent", referent: "Quentin", priority: "moyenne" },
      { id: "CU5", name: "Prospection commerciale IA", description: "Identifier des clients cibles et pre-rediger des emails personnalises", status: "deployed", type: "prompt", referent: "JB", priority: "moyenne" },
    ],
  },
  {
    id: "D03",
    name: "Capital Markets",
    color: "#6366f1",
    icon: TrendingUp,
    useCases: [
      { id: "CU1", name: "Consolidation etats locatifs", description: "Normaliser les Excel clients heterogenes vers un template Newmark unifie", status: "blocked", type: "prompt", referent: "JB", priority: "haute" },
      { id: "CU2", name: "Extraction baux PDF", description: "Extraire les clauses cles de baux commerciaux PDF vers Excel", status: "blocked", type: "prompt", referent: "JB", priority: "haute" },
      { id: "CU3", name: "Warnings locataires", description: "Analyser l'actualite de chaque enseigne (sante financiere, restructuration)", status: "deployed", type: "prompt", referent: "JB", priority: "haute" },
      { id: "CU4", name: "Liste prospects investisseurs", description: "Construire la liste des acquereurs potentiels via rapports et presse", status: "blocked", type: "prompt", referent: "JB", priority: "moyenne" },
      { id: "CU5", name: "Veille presse & newsletter", description: "Agent de veille hebdomadaire Business Immo, CF News, LSA", status: "in_progress", type: "agent", referent: "Quentin", priority: "moyenne" },
      { id: "CU6", name: "Identification proprietaires zone", description: "Identifier les proprietaires d'une zone commerciale via Pappers Immo", status: "blocked", type: "agent", priority: "faible" },
    ],
  },
  {
    id: "D04",
    name: "Office Leasing",
    color: "#8b5cf6",
    icon: Briefcase,
    useCases: [
      { id: "CU1", name: "Avis de valeur automatises", description: "Production PPT des preconisations avec KPIs et offres concurrentes", status: "not_feasible", type: "tool", priority: "haute" },
      { id: "CU2", name: "Prospection sequences auto", description: "Workflows Sales Navigator + campagnes LinkedIn/email personnalisees", status: "planned", type: "agent", priority: "haute" },
      { id: "CU3", name: "Veille signaux d'achat", description: "Newsletter matinale IA : levees de fonds, recrutements, nominations", status: "in_progress", type: "agent", referent: "Quentin", priority: "haute" },
      { id: "CU4", name: "Fiches prospects enrichies", description: "Actualites societe, points forts de l'offre, conseils avant RDV", status: "deployed", type: "prompt", priority: "moyenne" },
      { id: "CU5", name: "Etudes de ciblage sectoriel", description: "Etudes sectorielles (ex : Top 50 cabinets d'avocats Paris)", status: "deployed", type: "prompt", priority: "moyenne" },
      { id: "CU6", name: "Selections clients enrichies", description: "Temps de parcours entre visites et duree estimee pour prospects", status: "deployed", type: "app", referent: "Vincent", priority: "moyenne" },
      { id: "CU7", name: "Saisie vocale CRM", description: "Dicter les CR de visite, l'IA structure et alimente Dynamics 365", status: "blocked", type: "tool", priority: "moyenne" },
      { id: "CU8", name: "Redaction annonces", description: "Redaction d'annonces immobilieres standardisees", status: "planned", type: "prompt", priority: "faible" },
      { id: "CU9", name: "Structuration pitchs", description: "Aide a la structuration des pitchs de commercialisation", status: "planned", type: "prompt", priority: "faible" },
      { id: "CU10", name: "Posts LinkedIn", description: "Posts LinkedIn personnalises pour les commerciaux", status: "planned", type: "prompt", priority: "faible" },
    ],
  },
  {
    id: "D05",
    name: "Retail Leasing",
    color: "#ec4899",
    icon: ShoppingBag,
    useCases: [
      { id: "CU1", name: "Dashboard transactions", description: "Visualisation du fichier Excel : prix/m2 par rue, tendances, ventilation", status: "planned", type: "app", referent: "Vincent", priority: "haute" },
      { id: "CU2", name: "Avis de valeur automatises", description: "Transactions comparables et donnees de marche dans template PPT", status: "not_feasible", type: "tool", priority: "haute" },
      { id: "CU3", name: "Fiches / flyers emplacements", description: "Generer les flyers d'emplacements depuis template PPT", status: "not_feasible", type: "tool", priority: "moyenne" },
      { id: "CU4", name: "Recherche proprietaires", description: "Agent interrogeant Pappers + La Place pour identifier proprietaires", status: "in_progress", type: "agent", referent: "Quentin", priority: "moyenne" },
      { id: "CU5", name: "Identification marques cibles", description: "Liste de marques pertinentes pour un emplacement donne", status: "planned", type: "prompt", priority: "moyenne" },
      { id: "CU6", name: "Veille marques & newsletter", description: "Newsletter hebdo sur 500 marques : ouvertures, levees, restructurations", status: "planned", type: "agent", referent: "Quentin", priority: "moyenne" },
      { id: "CU7", name: "Prospection personnalisee", description: "Fiches enrichies et sequences mail pour approche marques", status: "planned", type: "prompt", priority: "faible" },
    ],
  },
  {
    id: "D06",
    name: "Marketing & Communication",
    color: "#f43f5e",
    icon: Megaphone,
    useCases: [
      { id: "CU1", name: "Mock-ups visuels IA", description: "Mock-ups de tous les outils de comm d'un pitch depuis logo + charte", status: "planned", type: "prompt", referent: "JB", priority: "haute" },
      { id: "CU2", name: "Videos IA", description: "Videos aspirationnelles pour pitchs et presentations", status: "blocked", type: "external", referent: "JB", priority: "haute" },
      { id: "CU3", name: "Storytelling & naming", description: "Concept marketing, naming d'immeuble, manifeste creatif", status: "deployed", type: "prompt", priority: "moyenne" },
      { id: "CU4", name: "Vectorisation facades", description: "Photos de facades vers illustrations vectorisees epurees", status: "deployed", type: "prompt", priority: "moyenne" },
      { id: "CU5", name: "Traduction IA immobilier", description: "Assistant de traduction FR/EN specialise immobilier", status: "deployed", type: "prompt", priority: "moyenne" },
      { id: "CU6", name: "Briefs prestataires IA", description: "Redaction et structuration des briefs pour videastes et agences", status: "blocked", type: "prompt", priority: "moyenne" },
      { id: "CU7", name: "Declinaison PPT depuis charte", description: "Pages PPT depuis couverture + palette InDesign", status: "blocked", type: "prompt", priority: "faible" },
      { id: "CU8", name: "Feuilles de temps graphistes", description: "Application de suivi du temps par projet pour les graphistes", status: "deployed", type: "app", referent: "Vincent", priority: "haute" },
    ],
  },
  {
    id: "D07",
    name: "Research",
    color: "#14b8a6",
    icon: BookOpen,
    useCases: [
      { id: "CU1", name: "Lecture presse → Excel", description: "Agent lisant Business Immo et pre-remplissant une ligne de transaction", status: "deployed", type: "agent", referent: "Quentin", priority: "haute" },
      { id: "CU2", name: "Bulletins SCPI → Excel", description: "Lecture des 135 bulletins trimestriels SCPI, extraction vers base Excel", status: "planned", type: "agent", referent: "Quentin", priority: "haute" },
      { id: "CU3", name: "Croisement DVF automatique", description: "Croiser la base DVF avec le fichier transactions pour verifier les prix", status: "planned", type: "prompt", referent: "Quentin", priority: "moyenne" },
    ],
  },
  {
    id: "D08",
    name: "Data & Gestion des Offres",
    color: "#f97316",
    icon: Database,
    useCases: [
      { id: "CU1", name: "Generation encarts diffusion", description: "Generateur d'encarts Newmark exportables en PNG depuis une miniapp dediee", status: "deployed", type: "app", referent: "Vincent", priority: "haute" },
      { id: "CU2", name: "Audit base de contacts", description: "Verifier sur LinkedIn si les 1 783 contacts sont a jour", status: "planned", type: "agent", referent: "JB", priority: "haute" },
      { id: "CU3", name: "Verification SIRET", description: "Verifier si les SIRET sont actifs, detecter clotures et nouveaux SIRET", status: "deployed", type: "agent", referent: "Quentin", priority: "haute" },
      { id: "CU4", name: "Enrichissement fiches immeubles", description: "Infos cles d'un immeuble depuis le web (date, surface, architecte)", status: "planned", type: "prompt", referent: "JB", priority: "moyenne" },
      { id: "CU5", name: "Retouche photos de facade", description: "Prompts de retouche photo et suppression logos/watermarks", status: "planned", type: "prompt", priority: "moyenne" },
      { id: "CU6", name: "Dashboard suivi des offres", description: "Dashboard automatise depuis exports Logipro : offres par secteur", status: "deployed", type: "app", referent: "Quentin", priority: "haute" },
    ],
  },
  {
    id: "D09",
    name: "Analystes",
    color: "#84cc16",
    icon: Users,
    useCases: [
      { id: "CU1", name: "Ponderation surfaces retail", description: "Calcul des surfaces ponderees par zone a partir d'un plan PDF cote", status: "not_feasible", type: "tool", priority: "haute" },
      { id: "CU2", name: "Extraction baux + avenants", description: "Extraction des clauses de bail + gestion des avenants", status: "deployed", type: "prompt", referent: "JB", priority: "haute" },
      { id: "CU3", name: "Visuels amenagement interieur", description: "Prompts standardises pour visuels d'amenagement depuis photo vide", status: "in_progress", type: "app", referent: "Quentin", priority: "moyenne" },
      { id: "CU4", name: "Generateur trames pitch PPT", description: "Trame PPT complete depuis brief minimal", status: "planned", type: "prompt", referent: "JB", priority: "moyenne" },
      { id: "CU5", name: "Cartographie transactions", description: "Outil cartographique : charger Excel et positionner les points", status: "deployed", type: "app", referent: "Vincent", priority: "moyenne" },
      { id: "CU6", name: "Scraping SeLoger residentiel", description: "Offres locatives SeLoger pour etudes conversion bureaux/residentiel", status: "deployed", type: "prompt", referent: "JB", priority: "faible" },
      { id: "CU7", name: "Croisement brochures confreres", description: "Lecture brochures PDF confreres et croisement avec base Logipro", status: "deployed", type: "prompt", referent: "JB", priority: "faible" },
    ],
  },
];

export const statusLabels: Record<Status, string> = {
  deployed: "Deploye",
  in_progress: "En cours",
  planned: "A faire",
  blocked: "En attente",
  not_feasible: "Non realisable",
};

export const statusColors: Record<Status, { bg: string; text: string }> = {
  deployed: { bg: "#dcfce7", text: "#166534" },
  in_progress: { bg: "#fef9c3", text: "#854d0e" },
  planned: { bg: "#f1f5f9", text: "#475569" },
  blocked: { bg: "#fee2e2", text: "#991b1b" },
  not_feasible: { bg: "#f1f5f9", text: "#94a3b8" },
};

export const typeLabels: Record<CUType, string> = {
  agent: "Agent",
  app: "App",
  prompt: "Prompt",
  external: "Externe",
  tool: "Outil",
};
