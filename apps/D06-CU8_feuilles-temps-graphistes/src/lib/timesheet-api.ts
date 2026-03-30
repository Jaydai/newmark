"use client";

import type { GraphistesTimesheetState } from "@/lib/timesheet-types";

export type TimesheetSnapshot = {
  revision: number;
  state: GraphistesTimesheetState;
  storageLabel: string;
};

type ErrorPayload = {
  error?: string;
  revision?: number;
  state?: GraphistesTimesheetState;
  storageLabel?: string;
};

export class TimesheetConflictError extends Error {
  snapshot: TimesheetSnapshot;

  constructor(message: string, snapshot: TimesheetSnapshot) {
    super(message);
    this.name = "TimesheetConflictError";
    this.snapshot = snapshot;
  }
}

async function parseErrorPayload(response: Response) {
  try {
    return (await response.json()) as ErrorPayload;
  } catch {
    return {};
  }
}

export async function fetchTimesheetSnapshot(): Promise<TimesheetSnapshot> {
  const response = await fetch("/api/timesheet", {
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await parseErrorPayload(response);
    throw new Error(payload.error || "Impossible de lire la base SQLite.");
  }

  return (await response.json()) as TimesheetSnapshot;
}

export async function saveTimesheetSnapshot(
  revision: number,
  state: GraphistesTimesheetState,
): Promise<TimesheetSnapshot> {
  const response = await fetch("/api/timesheet", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ revision, state }),
  });

  if (response.status === 409) {
    const payload = await parseErrorPayload(response);
    if (
      typeof payload.revision === "number" &&
      payload.state &&
      typeof payload.storageLabel === "string"
    ) {
      throw new TimesheetConflictError(
        payload.error || "Les donnees ont ete modifiees ailleurs.",
        {
          revision: payload.revision,
          state: payload.state,
          storageLabel: payload.storageLabel,
        },
      );
    }
  }

  if (!response.ok) {
    const payload = await parseErrorPayload(response);
    throw new Error(payload.error || "Impossible d'enregistrer dans SQLite.");
  }

  return (await response.json()) as TimesheetSnapshot;
}
