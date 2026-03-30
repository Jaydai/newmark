"use client";

import { getEncartsBearerToken } from "@/lib/encarts-auth";
import type { EncartsDiffusionState } from "@/lib/encarts-types";

export type EncartsSnapshot = {
  revision: number;
  state: EncartsDiffusionState;
  storageLabel: string;
};

type ErrorPayload = {
  error?: string;
  revision?: number;
  state?: EncartsDiffusionState;
  storageLabel?: string;
};

export class EncartsConflictError extends Error {
  snapshot: EncartsSnapshot;

  constructor(message: string, snapshot: EncartsSnapshot) {
    super(message);
    this.name = "EncartsConflictError";
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

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const token = await getEncartsBearerToken();

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchEncartsSnapshot(): Promise<EncartsSnapshot> {
  const authHeaders = await buildAuthHeaders();
  const response = await fetch("/api/encarts-diffusion", {
    cache: "no-store",
    headers: authHeaders,
  });

  if (!response.ok) {
    const payload = await parseErrorPayload(response);
    throw new Error(payload.error || "Impossible de lire la base SQLite.");
  }

  return (await response.json()) as EncartsSnapshot;
}

export async function saveEncartsSnapshot(
  revision: number,
  state: EncartsDiffusionState,
): Promise<EncartsSnapshot> {
  const authHeaders = await buildAuthHeaders();
  const response = await fetch("/api/encarts-diffusion", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
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
      throw new EncartsConflictError(
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

  return (await response.json()) as EncartsSnapshot;
}
