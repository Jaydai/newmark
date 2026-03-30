import { NextResponse } from "next/server";
import {
  RevisionConflictError,
  readEncartsSnapshot,
  replaceEncartsState,
} from "@/lib/encarts-db";
import {
  AuthenticationError,
  requireAuthenticatedRequest,
} from "@/lib/server-auth";
import {
  buildDefaultState,
  normalizeEncartsDiffusionState,
} from "@/lib/encarts-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAuthenticatedRequest(request);
    return NextResponse.json(readEncartsSnapshot());
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible d'ouvrir la base SQLite.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    await requireAuthenticatedRequest(request);
    const body = (await request.json()) as {
      revision?: unknown;
      state?: unknown;
    };

    if (
      typeof body.revision !== "number" ||
      !Number.isInteger(body.revision) ||
      body.revision < 0
    ) {
      return NextResponse.json(
        { error: "Revision invalide pour l'enregistrement." },
        { status: 400 },
      );
    }

    const normalizedState = normalizeEncartsDiffusionState(
      body.state,
      buildDefaultState(),
    );

    return NextResponse.json(
      replaceEncartsState(normalizedState, body.revision),
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof RevisionConflictError) {
      return NextResponse.json(
        {
          error:
            "La base SQLite a change depuis votre dernier chargement. Rechargez pour recuperer la version courante.",
          ...error.snapshot,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible d'enregistrer dans la base SQLite.",
      },
      { status: 500 },
    );
  }
}
