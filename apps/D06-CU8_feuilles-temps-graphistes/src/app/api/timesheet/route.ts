import { NextResponse } from "next/server";
import {
  RevisionConflictError,
  readTimesheetSnapshot,
  replaceTimesheetState,
} from "@/lib/timesheet-db";
import {
  buildDefaultState,
  normalizeGraphistesTimesheetState,
} from "@/lib/timesheet-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(readTimesheetSnapshot());
  } catch (error) {
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

    const normalizedState = normalizeGraphistesTimesheetState(
      body.state,
      buildDefaultState(),
    );

    return NextResponse.json(
      replaceTimesheetState(normalizedState, body.revision),
    );
  } catch (error) {
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
