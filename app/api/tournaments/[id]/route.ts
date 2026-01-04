// app/api/tournaments/[id]/route.ts
export const runtime = "nodejs"; // keep Node runtime for DB clients

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { tournaments } from "@/db/schema";
import { eq } from "drizzle-orm";

type RouteContext = { params: { id: string } };

type TournamentDTO = {
  id: number;
  name: string;
  year: number | null;
  isActive: boolean | null;
  createdAt: string | null;
  isLockedManual: boolean | null;
  lockAt: string | null;
};

type TournamentRow = {
  id: number;
  name: string;
  year?: number | null;
  isActive?: boolean | null;
  createdAt?: string | Date | null;
  isLockedManual?: boolean | null;
  lockAt?: string | Date | null;
};

function toDto(row: unknown): TournamentDTO {
  const r = row as TournamentRow;

  return {
    id: r.id,
    name: r.name,
    year: r.year ?? null,
    isActive: r.isActive ?? null,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
    isLockedManual: r.isLockedManual ?? null,
    lockAt: r.lockAt ? new Date(r.lockAt).toISOString() : null,
  };
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "Unknown error";
  }
}

// GET /api/tournaments/:id
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const numericId = Number(context.params.id);

    if (!Number.isFinite(numericId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, numericId))
      .limit(1);

    if (!rows.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(toDto(rows[0]));
  } catch (e: unknown) {
    console.error("GET /api/tournaments/[id] failed:", e);
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

// PUT /api/tournaments/:id
// Body can include: name, isLockedManual, lockAt (ISO string)
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const numericId = Number(context.params.id);

    if (!Number.isFinite(numericId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = (await req.json()) as Partial<{
      name: string;
      isLockedManual: boolean | null;
      lockAt: string | null; // ISO string
    }>;

    // Avoid `any`: build patch in a typed way
    const patch: Partial<{
      name: string;
      isLockedManual: boolean | null;
      lockAt: Date | null;
    }> = {};

    if (body.name !== undefined) patch.name = body.name;
    if (body.isLockedManual !== undefined) patch.isLockedManual = body.isLockedManual;
    if (body.lockAt !== undefined) patch.lockAt = body.lockAt ? new Date(body.lockAt) : null;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await db
      .update(tournaments)
      .set(patch)
      .where(eq(tournaments.id, numericId))
      .returning();

    if (!updated.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(toDto(updated[0]));
  } catch (e: unknown) {
    console.error("PUT /api/tournaments/[id] failed:", e);
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
