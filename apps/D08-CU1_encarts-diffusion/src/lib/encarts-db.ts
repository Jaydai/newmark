import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  ENCART_COPY_FIELD_KEYS,
  buildDefaultState,
  normalizeEncartsDiffusionState,
  type Contact,
  type EncartsDiffusionState,
  type EncartEditableCopy,
} from "@/lib/encarts-types";

type MetadataRow = {
  value: string;
};

type CopyFieldRow = {
  field_key: string;
  value: string;
};

type ContactRow = {
  id: number;
  name: string;
  phone: string;
  email: string;
  selected: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type EncartsSnapshot = {
  revision: number;
  state: EncartsDiffusionState;
  storageLabel: string;
};

export class RevisionConflictError extends Error {
  snapshot: EncartsSnapshot;

  constructor(snapshot: EncartsSnapshot) {
    super("Les donnees ont deja ete modifiees ailleurs.");
    this.name = "RevisionConflictError";
    this.snapshot = snapshot;
  }
}

declare global {
  var __encartsDiffusionDb__: DatabaseSync | undefined;
}

function resolveDbPath() {
  const configuredPath = process.env.ENCARTS_DIFFUSION_DB_PATH?.trim();
  if (configuredPath) {
    return path.resolve(configuredPath);
  }

  return path.join(process.cwd(), "data", "encarts-diffusion.sqlite");
}

const DB_PATH = resolveDbPath();
const STORAGE_LABEL = path.relative(process.cwd(), DB_PATH) || DB_PATH;
const COPY_FIELD_KEY_SET = new Set<string>(ENCART_COPY_FIELD_KEYS);

function getDb() {
  if (!global.__encartsDiffusionDb__) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const db = new DatabaseSync(DB_PATH);
    db.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS copy_fields (
        field_key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        selected INTEGER NOT NULL CHECK(selected IN (0, 1)),
        sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    global.__encartsDiffusionDb__ = db;
  }

  return global.__encartsDiffusionDb__;
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

function mapContactRow(row: ContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    selected: Boolean(row.selected),
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

function readCopyFields(): Partial<EncartEditableCopy> {
  const db = getDb();
  const rows = db
    .prepare("SELECT field_key, value FROM copy_fields")
    .all() as CopyFieldRow[];

  const copy: Partial<EncartEditableCopy> = {};

  for (const row of rows) {
    if (COPY_FIELD_KEY_SET.has(row.field_key)) {
      copy[row.field_key as keyof EncartEditableCopy] = row.value;
    }
  }

  return copy;
}

export function readEncartsSnapshot(): EncartsSnapshot {
  const db = getDb();
  const defaults = buildDefaultState();
  const revision = readRevision();
  const contacts = (
    db
      .prepare(
        `
          SELECT id, name, phone, email, selected, sort_order, created_at, updated_at
          FROM contacts
          ORDER BY sort_order ASC, id ASC
        `,
      )
      .all() as ContactRow[]
  ).map(mapContactRow);

  const state = normalizeEncartsDiffusionState(
    {
      version: 1,
      copy: readCopyFields(),
      offerReference:
        getMetadataValue("offer_reference") ?? defaults.offerReference,
      contacts: revision === 0 && contacts.length === 0 ? defaults.contacts : contacts,
      updatedAt: getMetadataValue("updated_at") ?? defaults.updatedAt,
    },
    defaults,
  );

  return {
    revision,
    state,
    storageLabel: STORAGE_LABEL,
  };
}

export function replaceEncartsState(
  candidateState: EncartsDiffusionState,
  expectedRevision: number,
): EncartsSnapshot {
  const currentSnapshot = readEncartsSnapshot();

  if (currentSnapshot.revision !== expectedRevision) {
    throw new RevisionConflictError(currentSnapshot);
  }

  const db = getDb();
  const persistedState = normalizeEncartsDiffusionState(
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
  const insertCopyField = db.prepare(
    `
      INSERT INTO copy_fields(field_key, value)
      VALUES(?, ?)
    `,
  );
  const insertContact = db.prepare(
    `
      INSERT INTO contacts(
        id,
        name,
        phone,
        email,
        selected,
        sort_order,
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
    db.exec("DELETE FROM copy_fields");
    db.exec("DELETE FROM contacts");

    for (const key of ENCART_COPY_FIELD_KEYS) {
      insertCopyField.run(key, persistedState.copy[key]);
    }

    persistedState.contacts.forEach((contact, index) => {
      insertContact.run(
        contact.id,
        contact.name,
        contact.phone,
        contact.email,
        contact.selected ? 1 : 0,
        index,
        contact.createdAt,
        contact.updatedAt,
      );
    });

    setMetadataValue("offer_reference", persistedState.offerReference);
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
