import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { games } from "@/db/schema";
import { and, eq } from "drizzle-orm";

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Unknown error";
}

// GET /api/games?tournamentId=1&round=1
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tid = searchParams.get("tournamentId");
    const rnd = searchParams.get("round");

    const where: Parameters<typeof and> = [];
    if (tid) where.push(eq(games.tournamentId, Number(tid)));
    if (rnd) where.push(eq(games.round, Number(rnd)));

    const rows = await db
      .select()
      .from(games)
      .where(where.length ? and(...where) : undefined)
      .orderBy(games.round, games.gameIndex, games.id);

    return NextResponse.json(rows);
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}

// POST /api/games
// Single:
// { "tournamentId":1, "round":1, "gameIndex":1, "teamAId":2, "teamBId":3 }
// Bulk:
// { "tournamentId":1, "games":[{ "round":1,"gameIndex":1,"teamAId":2,"teamBId":3 }, ...] }
export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const b = body as {
      tournamentId?: unknown;
      round?: unknown;
      gameIndex?: unknown;
      teamAId?: unknown;
      teamBId?: unknown;
      winnerId?: unknown;
      games?: unknown;
    };

    // Bulk insert
    if (Array.isArray(b.games) && b.tournamentId != null) {
      const tournamentId = Number(b.tournamentId);
      if (!Number.isFinite(tournamentId)) {
        return NextResponse.json(
          { error: "tournamentId must be a number" },
          { status: 400 }
        );
      }

      const values = (b.games as Array<{
        round: unknown;
        gameIndex: unknown;
        teamAId?: unknown;
        teamBId?: unknown;
        winnerId?: unknown;
      }>)
        .map((g) => ({
          tournamentId,
          round: Number(g.round),
          gameIndex: Number(g.gameIndex),
          teamAId: g.teamAId == null ? null : Number(g.teamAId),
          teamBId: g.teamBId == null ? null : Number(g.teamBId),
          winnerId: g.winnerId == null ? null : Number(g.winnerId),
        }))
        .filter(
          (g) =>
            Number.isFinite(g.round) &&
            Number.isFinite(g.gameIndex) &&
            (g.teamAId == null || Number.isFinite(g.teamAId)) &&
            (g.teamBId == null || Number.isFinite(g.teamBId)) &&
            (g.winnerId == null || Number.isFinite(g.winnerId))
        );

      if (values.length === 0) {
        return NextResponse.json(
          { error: "No valid games provided" },
          { status: 400 }
        );
      }

      const inserted = await db.insert(games).values(values).returning();
      return NextResponse.json(inserted, { status: 201 });
    }

    // Single insert
    const t = Number(b.tournamentId);
    const r = Number(b.round);
    const gi = Number(b.gameIndex);

    if (!Number.isFinite(t) || !Number.isFinite(r) || !Number.isFinite(gi)) {
      return NextResponse.json(
        { error: "Required numeric fields: tournamentId, round, gameIndex" },
        { status: 400 }
      );
    }

    const [row] = await db
      .insert(games)
      .values({
        tournamentId: t,
        round: r,
        gameIndex: gi,
        teamAId: b.teamAId == null ? null : Number(b.teamAId),
        teamBId: b.teamBId == null ? null : Number(b.teamBId),
        winnerId: b.winnerId == null ? null : Number(b.winnerId),
      })
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}
