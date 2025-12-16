// app/api/picks/by-bracket/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { picks } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * GET /api/picks/by-bracket/:id[?gameId=45]
 * - Without gameId: return all picks for a bracket
 * - With gameId: return a single pick (404 if none)
 */
export async function GET(req: NextRequest, context: any) {
  try {
    const { id } = await context.params;
    const bracketId = Number(id);

    if (Number.isNaN(bracketId)) {
      return NextResponse.json({ error: "Invalid bracket id" }, { status: 400 });
    }

    const url = new URL(req.url);
    const gameIdParam = url.searchParams.get("gameId");

    if (gameIdParam) {
      const gameId = Number(gameIdParam);
      if (Number.isNaN(gameId)) {
        return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
      }

      const rows = await db
        .select()
        .from(picks)
        .where(
          and(eq(picks.bracketId, bracketId), eq(picks.gameId, gameId))
        )
        .limit(1);

      if (!rows.length) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      return NextResponse.json(rows[0]);
    }

    // No gameId → return all picks for bracket
    const rows = await db
      .select()
      .from(picks)
      .where(eq(picks.bracketId, bracketId));

    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/picks/by-bracket/:id
 * Body: { gameId: number, pickedTeamId: number }
 * - Upsert pick for (bracketId, gameId)
 */
export async function POST(req: NextRequest, context: any) {
  try {
    const { id } = await context.params;
    const bracketId = Number(id);

    if (Number.isNaN(bracketId)) {
      return NextResponse.json({ error: "Invalid bracket id" }, { status: 400 });
    }

    const body = (await req.json()) as {
      gameId?: number;
      pickedTeamId?: number;
    };

    if (
      body.gameId === undefined ||
      body.pickedTeamId === undefined ||
      Number.isNaN(Number(body.gameId)) ||
      Number.isNaN(Number(body.pickedTeamId))
    ) {
      return NextResponse.json(
        { error: "gameId and pickedTeamId are required numbers" },
        { status: 400 }
      );
    }

    const gameId = Number(body.gameId);
    const pickedTeamId = Number(body.pickedTeamId);

    // Check existing pick
    const existing = await db
      .select()
      .from(picks)
      .where(
        and(eq(picks.bracketId, bracketId), eq(picks.gameId, gameId))
      )
      .limit(1);

    let row;

    if (existing.length) {
      const updated = await db
        .update(picks)
        .set({ pickedTeamId })
        .where(
          and(eq(picks.bracketId, bracketId), eq(picks.gameId, gameId))
        )
        .returning();
      row = updated[0];
    } else {
      const inserted = await db
        .insert(picks)
        .values({
          bracketId,
          gameId,
          pickedTeamId,
        } as any)
        .returning();
      row = inserted[0];
    }

    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
