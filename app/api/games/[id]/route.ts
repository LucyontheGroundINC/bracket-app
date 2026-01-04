import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { games } from "@/db/schema";
import { eq } from "drizzle-orm";

// Next.js App Router route context typing
type RouteContext = { params: { id: string } };

// Helpers
function getErrorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Unknown error";
}

// GET /api/games/:id
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const idParam = context.params.id;
    const numericId = Number(idParam);

    if (!Number.isFinite(numericId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const rows = await db.select().from(games).where(eq(games.id, numericId));

    if (!rows.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}

// PUT /api/games/:id
// Body can include: round, gameIndex, teamAId, teamBId, winnerId
type GameUpdateBody = Partial<{
  round: number;
  gameIndex: number;
  teamAId: number | null;
  teamBId: number | null;
  winnerId: number | null;
}>;

type GamePatch = Partial<{
  round: number;
  gameIndex: number;
  teamAId: number | null;
  teamBId: number | null;
  winnerId: number | null;
}>;

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const idParam = context.params.id;
    const numericId = Number(idParam);

    if (!Number.isFinite(numericId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = (await req.json()) as GameUpdateBody;

    const patch: GamePatch = {};

    if (body.round !== undefined) patch.round = Number(body.round);
    if (body.gameIndex !== undefined) patch.gameIndex = Number(body.gameIndex);
    if (body.teamAId !== undefined) patch.teamAId = body.teamAId ?? null;
    if (body.teamBId !== undefined) patch.teamBId = body.teamBId ?? null;
    if (body.winnerId !== undefined) patch.winnerId = body.winnerId ?? null;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // Optional: basic numeric sanity checks if provided
    if (patch.round !== undefined && !Number.isFinite(patch.round)) {
      return NextResponse.json({ error: "round must be a number" }, { status: 400 });
    }
    if (patch.gameIndex !== undefined && !Number.isFinite(patch.gameIndex)) {
      return NextResponse.json({ error: "gameIndex must be a number" }, { status: 400 });
    }

    const updated = await db
      .update(games)
      .set(patch)
      .where(eq(games.id, numericId))
      .returning();

    if (!updated.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated[0]);
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}

// DELETE /api/games/:id
export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const idParam = context.params.id;
    const numericId = Number(idParam);

    if (!Number.isFinite(numericId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const del = await db.delete(games).where(eq(games.id, numericId)).returning();

    if (!del.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id: numericId });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}
