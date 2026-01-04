// app/api/picks/by-bracket/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { picks } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

type PickRow = {
  bracketId: number;
  gameId: number;
  pickedTeamId: number;
  // if your table has other columns (id, createdAt, etc.), we don't need them here
};

type PostBody = {
  gameId?: number;
  pickedTeamId?: number;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown error";
}

/**
 * GET /api/picks/by-bracket/:id[?gameId=45]
 * - Without gameId: return all picks for a bracket
 * - With gameId: return a single pick (404 if none)
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const bracketId = Number(context.params.id);

    if (!Number.isFinite(bracketId)) {
      return NextResponse.json({ error: "Invalid bracket id" }, { status: 400 });
    }

    const url = new URL(req.url);
    const gameIdParam = url.searchParams.get("gameId");

    if (gameIdParam) {
      const gameId = Number(gameIdParam);
      if (!Number.isFinite(gameId)) {
        return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
      }

      const rows = (await db
        .select()
        .from(picks)
        .where(and(eq(picks.bracketId, bracketId), eq(picks.gameId, gameId)))
        .limit(1)) as unknown as PickRow[];

      if (!rows.length) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      return NextResponse.json(rows[0]);
    }

    // No gameId → return all picks for bracket
    const rows = (await db
      .select()
      .from(picks)
      .where(eq(picks.bracketId, bracketId))) as unknown as PickRow[];

    return NextResponse.json(rows);
  } catch (err: unknown) {
    console.error("[picks/by-bracket GET] error:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

/**
 * POST /api/picks/by-bracket/:id
 * Body: { gameId: number, pickedTeamId: number }
 * - Upsert pick for (bracketId, gameId)
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const bracketId = Number(context.params.id);

    if (!Number.isFinite(bracketId)) {
      return NextResponse.json({ error: "Invalid bracket id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as PostBody;

    const gameId = Number(body.gameId);
    const pickedTeamId = Number(body.pickedTeamId);

    if (!Number.isFinite(gameId) || !Number.isFinite(pickedTeamId)) {
      return NextResponse.json(
        { error: "gameId and pickedTeamId are required numbers" },
        { status: 400 }
      );
    }

    // Check existing pick
    const existing = (await db
      .select()
      .from(picks)
      .where(and(eq(picks.bracketId, bracketId), eq(picks.gameId, gameId)))
      .limit(1)) as unknown as PickRow[];

    let row: PickRow | null = null;

    if (existing.length) {
      const updated = (await db
        .update(picks)
        .set({ pickedTeamId })
        .where(and(eq(picks.bracketId, bracketId), eq(picks.gameId, gameId)))
        .returning()) as unknown as PickRow[];

      row = updated[0] ?? null;
    } else {
      const inserted = (await db
        .insert(picks)
        .values({ bracketId, gameId, pickedTeamId })
        .returning()) as unknown as PickRow[];

      row = inserted[0] ?? null;
    }

    return NextResponse.json(row);
  } catch (err: unknown) {
    console.error("[picks/by-bracket POST] error:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
