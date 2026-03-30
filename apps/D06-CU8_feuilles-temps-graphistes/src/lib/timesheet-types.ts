export const DEFAULT_DESIGNERS = ["Graphiste 1", "Graphiste 2"] as const;

export type TimesheetProject = {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type TimesheetEntry = {
  id: string;
  projectId: number;
  designer: string;
  date: string;
  minutes: number;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type GraphistesTimesheetState = {
  version: 1;
  designers: string[];
  projects: TimesheetProject[];
  entries: TimesheetEntry[];
  updatedAt: string;
};

function cloneProject(project: TimesheetProject): TimesheetProject {
  return { ...project };
}

function cloneEntry(entry: TimesheetEntry): TimesheetEntry {
  return { ...entry };
}

export function cloneGraphistesTimesheetState(
  state: GraphistesTimesheetState,
): GraphistesTimesheetState {
  return {
    version: 1,
    designers: [...state.designers],
    projects: state.projects.map(cloneProject),
    entries: state.entries.map(cloneEntry),
    updatedAt: state.updatedAt,
  };
}

export function buildDefaultState(): GraphistesTimesheetState {
  return {
    version: 1,
    designers: [...DEFAULT_DESIGNERS],
    projects: [],
    entries: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalizeDesigners(raw: unknown, defaults: string[]): string[] {
  if (!Array.isArray(raw)) {
    return [...defaults];
  }

  const seen = new Set<string>();
  const designers = raw
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const normalized = value.toLocaleLowerCase("fr-FR");
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });

  return designers.length > 0 ? designers : [...defaults];
}

function normalizeProjects(
  raw: unknown,
  defaults: TimesheetProject[],
): TimesheetProject[] {
  if (!Array.isArray(raw)) {
    return defaults.map(cloneProject);
  }

  const projects = raw
    .filter(
      (project): project is Partial<TimesheetProject> =>
        typeof project === "object" && project !== null,
    )
    .map((project, index) => ({
      id: typeof project.id === "number" ? project.id : index + 1,
      name: typeof project.name === "string" ? project.name.trim() : "",
      createdAt:
        typeof project.createdAt === "string"
          ? project.createdAt
          : new Date().toISOString(),
      updatedAt:
        typeof project.updatedAt === "string"
          ? project.updatedAt
          : new Date().toISOString(),
    }))
    .filter((project) => project.name.length > 0);

  return projects.length > 0 ? projects : defaults.map(cloneProject);
}

function normalizeEntries(
  raw: unknown,
  defaults: TimesheetEntry[],
  projects: TimesheetProject[],
  designers: string[],
): TimesheetEntry[] {
  if (!Array.isArray(raw)) {
    return defaults.map(cloneEntry);
  }

  const projectIds = new Set(projects.map((project) => project.id));
  const allowedDesigners = new Set(designers);

  return raw
    .filter(
      (entry): entry is Partial<TimesheetEntry> =>
        typeof entry === "object" && entry !== null,
    )
    .map((entry, index) => ({
      id:
        typeof entry.id === "string" && entry.id.trim().length > 0
          ? entry.id
          : `entry-${index + 1}`,
      projectId:
        typeof entry.projectId === "number" ? entry.projectId : Number.NaN,
      designer:
        typeof entry.designer === "string" ? entry.designer.trim() : "",
      date: typeof entry.date === "string" ? entry.date : "",
      minutes:
        typeof entry.minutes === "number" && Number.isFinite(entry.minutes)
          ? Math.max(0, Math.round(entry.minutes))
          : 0,
      note: typeof entry.note === "string" ? entry.note : "",
      createdAt:
        typeof entry.createdAt === "string"
          ? entry.createdAt
          : new Date().toISOString(),
      updatedAt:
        typeof entry.updatedAt === "string"
          ? entry.updatedAt
          : new Date().toISOString(),
    }))
    .filter(
      (entry) =>
        entry.minutes > 0 &&
        entry.date.length > 0 &&
        projectIds.has(entry.projectId) &&
        allowedDesigners.has(entry.designer),
    );
}

export function normalizeGraphistesTimesheetState(
  raw: unknown,
  defaults: GraphistesTimesheetState,
): GraphistesTimesheetState {
  if (typeof raw !== "object" || raw === null) {
    return cloneGraphistesTimesheetState(defaults);
  }

  const parsed = raw as Partial<GraphistesTimesheetState>;
  const designers = normalizeDesigners(parsed.designers, defaults.designers);
  const projects = normalizeProjects(parsed.projects, defaults.projects);
  const entries = normalizeEntries(
    parsed.entries,
    defaults.entries,
    projects,
    designers,
  );

  return {
    version: 1,
    designers,
    projects,
    entries,
    updatedAt:
      typeof parsed.updatedAt === "string"
        ? parsed.updatedAt
        : defaults.updatedAt,
  };
}
