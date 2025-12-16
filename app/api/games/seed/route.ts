import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { teams, games } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

/**
 * POST /api/games/seed
 * Body: { "tournamentId": 1, "round": 1 }
 * Creates pairings by seed: 1v16, 2v15, ... (skips teams without a seed)
 * Won’t duplicate if the same round already has games with teamA/B set.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json() as { tournamentId?: number; round?: number };
    const tournamentId = Number(body.tournamentId);
    const round = Number(body.round ?? 1);
    if (!Number.isFinite(tournamentId) || !Number.isFinite(round)) {
      return NextResponse.json({ error: "tournamentId and round are required numbers" }, { status: 400 });
    }

    // get all seeded teams for this tournament
    const seeded = await db
      .select()
      .from(teams)
      .where(eq(teams.tournamentId, tournamentId));

    const withSeeds = seeded.filter(t => typeof t.seed === "number") as Array<typeof teams.$inferSelect>;

    // Build pairs like 1v16, 2v15, ...
    const maxSeed = Math.max(...withSeeds.map(t => t.seed ?? 0), 0);
    if (!Number.isFinite(maxSeed) || maxSeed < 2) {
      return NextResponse.json({ error: "Not enough seeded teams to auto-seed." }, { status: 400 });
    }

    // Existing games in this round with any teams (avoid dupes)
    const existing = await db
      .select()
      .from(games)
      .where(and(eq(games.tournamentId, tournamentId), eq(games.round, round)));

    const bySeed = new Map<number, number>(); // seed -> teamId
    for (const t of withSeeds) {
      if (typeof t.seed === "number") bySeed.set(t.seed, t.id);
    }

    const values: typeof games.$inferInsert[] = [];
    // e.g. if seeds go up to 16, do 1..8 pairings
    const half = Math.floor(maxSeed / 2);
    let gameIndex = existing.length ? Math.max(0, ...existing.map(g => g.gameIndex ?? 0)) + 1 : 1;

    for (let s = 1; s <= half; s++) {
      const a = bySeed.get(s) ?? null;
      const b = bySeed.get(maxSeed - s + 1) ?? null;

      // Skip if already exists (simple check)
      const dupe = existing.some(g =>
        g.round === round &&
        ((g.teamAId === a && g.teamBId === b) || (g.teamAId === b && g.teamBId === a))
      );
      if (dupe) continue;

      values.push({
        tournamentId,
        round,
        gameIndex,
        teamAId: a,
        teamBId: b,
        winnerId: null,
      });
      gameIndex++;
    }

    if (!values.length) {
      return NextResponse.json({ ok: true, created: 0, note: "No new games to create." });
    }

    const inserted = await db.insert(games).values(values).returning();
    return NextResponse.json({ ok: true, created: inserted.length, games: inserted }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
