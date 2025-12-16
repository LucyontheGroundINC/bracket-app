import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { games } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// GET /api/games?tournamentId=1&round=1
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tid = searchParams.get("tournamentId");
    const rnd = searchParams.get("round");

    const where = [];
    if (tid) where.push(eq(games.tournamentId, Number(tid)));
    if (rnd) where.push(eq(games.round, Number(rnd)));

    const rows = await db
      .select()
      .from(games)
      .where(where.length ? and(...where) : undefined)
      .orderBy(games.round, games.gameIndex, games.id);

    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}

// POST /api/games
// Single:
// { "tournamentId":1, "round":1, "gameIndex":1, "teamAId":2, "teamBId":3 }
// Bulk:
// { "tournamentId":1, "games":[{ "round":1,"gameIndex":1,"teamAId":2,"teamBId":3 }, ...] }
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Bulk insert
    if (Array.isArray(body?.games) && body?.tournamentId != null) {
      const tournamentId = Number(body.tournamentId);
      if (!Number.isFinite(tournamentId)) {
        return NextResponse.json({ error: "tournamentId must be a number" }, { status: 400 });
      }
      const values = (body.games as Array<{
        round: number; gameIndex: number;
        teamAId?: number | null; teamBId?: number | null; winnerId?: number | null;
      }>)
        .map(g => ({
          tournamentId,
          round: Number(g.round),
          gameIndex: Number(g.gameIndex),
          teamAId: g.teamAId ?? null,
          teamBId: g.teamBId ?? null,
          winnerId: g.winnerId ?? null,
        }))
        .filter(g => Number.isFinite(g.round) && Number.isFinite(g.gameIndex));

      if (values.length === 0) {
        return NextResponse.json({ error: "No valid games provided" }, { status: 400 });
      }

      const inserted = await db.insert(games).values(values).returning();
      return NextResponse.json(inserted, { status: 201 });
    }

    // Single insert
    const t = Number(body?.tournamentId);
    const r = Number(body?.round);
    const gi = Number(body?.gameIndex);
    if (!Number.isFinite(t) || !Number.isFinite(r) || !Number.isFinite(gi)) {
      return NextResponse.json({ error: "Required numeric fields: tournamentId, round, gameIndex" }, { status: 400 });
    }

    const [row] = await db.insert(games).values({
      tournamentId: t,
      round: r,
      gameIndex: gi,
      teamAId: body.teamAId ?? null,
      teamBId: body.teamBId ?? null,
      winnerId: body.winnerId ?? null,
    }).returning();

    return NextResponse.json(row, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
