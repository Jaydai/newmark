import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  buildDefaultState,
  normalizeGraphistesTimesheetState,
  type GraphistesTimesheetState,
  type TimesheetEntry,
  type TimesheetProject,
} from "@/lib/timesheet-types";

type MetadataRow = {
  value: string;
};

type ProjectRow = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
};

type EntryRow = {
  id: string;
  project_id: number;
  designer: string;
  date: string;
  minutes: number;
  note: string;
  created_at: string;
  updated_at: string;
};

export type TimesheetSnapshot = {
  revision: number;
  state: GraphistesTimesheetState;
  storageLabel: string;
};

export class RevisionConflictError extends Error {
  snapshot: TimesheetSnapshot;

  constructor(snapshot: TimesheetSnapshot) {
    super("Les donnees ont deja ete modifiees ailleurs.");
    this.name = "RevisionConflictError";
    this.snapshot = snapshot;
  }
}

declare global {
  var __graphistesTimesheetDb__: DatabaseSync | undefined;
}

function resolveDbPath() {
  const configuredPath = process.env.TIMESHEET_DB_PATH?.trim();
  if (configuredPath) {
    return path.resolve(configuredPath);
  }

  return path.join(process.cwd(), "data", "graphistes-timesheet.sqlite");
}

const DB_PATH = resolveDbPath();
const STORAGE_LABEL = path.relative(process.cwd(), DB_PATH) || DB_PATH;

function getDb() {
  if (!global.__graphistesTimesheetDb__) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const db = new DatabaseSync(DB_PATH);
    db.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        designer TEXT NOT NULL,
        date TEXT NOT NULL,
        minutes INTEGER NOT NULL,
        note TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    global.__graphistesTimesheetDb__ = db;
  }

  return global.__graphistesTimesheetDb__;
}

function getMetadataValue(key: string) {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM metadata WHERE key = ?")
    .get(key) as MetadataRow | undefined;

  return row?.value ?? null;
}

function setMetadataValue(key: string, value: string) {
  const db = getDb();
  db.prepare(
    `
      INSERT INTO metadata(key, value)
      VALUES(?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
  ).run(key, value);
}

function mapProjectRow(row: ProjectRow): TimesheetProject {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEntryRow(row: EntryRow): TimesheetEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    designer: row.designer,
    date: row.date,
    minutes: row.minutes,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function readRevision() {
  const raw = getMetadataValue("revision");
  if (!raw) {
    return 0;
  }

  const revision = Number.parseInt(raw, 10);
  return Number.isInteger(revision) && revision >= 0 ? revision : 0;
}

export function readTimesheetSnapshot(): TimesheetSnapshot {
  const db = getDb();
  const defaults = buildDefaultState();
  const projects = (
    db
      .prepare(
        "SELECT id, name, created_at, updated_at FROM projects ORDER BY name COLLATE NOCASE ASC",
      )
      .all() as ProjectRow[]
  ).map(mapProjectRow);
  const entries = (
    db
      .prepare(
        "SELECT id, project_id, designer, date, minutes, note, created_at, updated_at FROM entries ORDER BY date DESC, created_at DESC",
      )
      .all() as EntryRow[]
  ).map(mapEntryRow);

  let designers = defaults.designers;
  const designersRaw = getMetadataValue("designers");
  if (designersRaw) {
    try {
      const parsed = JSON.parse(designersRaw) as unknown;
      if (Array.isArray(parsed)) {
        designers = parsed.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        );
      }
    } catch {
      designers = defaults.designers;
    }
  }

  const state = normalizeGraphistesTimesheetState(
    {
      version: 1,
      designers,
      projects,
      entries,
      updatedAt: getMetadataValue("updated_at") ?? defaults.updatedAt,
    },
    defaults,
  );

  return {
    revision: readRevision(),
    state,
    storageLabel: STORAGE_LABEL,
  };
}

export function replaceTimesheetState(
  candidateState: GraphistesTimesheetState,
  expectedRevision: number,
): TimesheetSnapshot {
  const currentSnapshot = readTimesheetSnapshot();

  if (currentSnapshot.revision !== expectedRevision) {
    throw new RevisionConflictError(currentSnapshot);
  }

  const db = getDb();
  const persistedState = normalizeGraphistesTimesheetState(
    {
      ...candidateState,
      updatedAt:
        typeof candidateState.updatedAt === "string"
          ? candidateState.updatedAt
          : new Date().toISOString(),
    },
    buildDefaultState(),
  );
  const nextRevision = currentSnapshot.revision + 1;
  const insertProject = db.prepare(
    `
      INSERT INTO projects(id, name, created_at, updated_at)
      VALUES(?, ?, ?, ?)
    `,
  );
  const insertEntry = db.prepare(
    `
      INSERT INTO entries(
        id,
        project_id,
        designer,
        date,
        minutes,
        note,
        created_at,
        updated_at
      )
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)
    `,
  );

  let started = false;

  try {
    db.exec("BEGIN IMMEDIATE");
    started = true;
    db.exec("DELETE FROM entries");
    db.exec("DELETE FROM projects");

    for (const project of persistedState.projects) {
      insertProject.run(
        project.id,
        project.name,
        project.createdAt,
        project.updatedAt,
      );
    }

    for (const entry of persistedState.entries) {
      insertEntry.run(
        entry.id,
        entry.projectId,
        entry.designer,
        entry.date,
        entry.minutes,
        entry.note,
        entry.createdAt,
        entry.updatedAt,
      );
    }

    setMetadataValue("designers", JSON.stringify(persistedState.designers));
    setMetadataValue("updated_at", persistedState.updatedAt);
    setMetadataValue("revision", String(nextRevision));

    db.exec("COMMIT");
    started = false;
  } catch (error) {
    if (started) {
      db.exec("ROLLBACK");
    }
    throw error;
  }

  return {
    revision: nextRevision,
    state: persistedState,
    storageLabel: STORAGE_LABEL,
  };
}
