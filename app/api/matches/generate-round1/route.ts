export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { teams, games } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";

/**
 * POST /api/games/generate-round1
 * body: { tournamentId: number, mode?: "seeded" | "random", wipeRound1?: boolean }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const tournamentId = Number(body?.tournamentId);
    const mode = (body?.mode ?? "seeded") as "seeded" | "random";
    const wipeRound1 = body?.wipeRound1 !== false; // default true

    if (!Number.isFinite(tournamentId)) {
      return NextResponse.json({ error: "tournamentId must be a number" }, { status: 400 });
    }

    // 1) Load teams (songs) for this tournament
    const rawTeams = await db
      .select()
      .from(teams)
      .where(eq(teams.tournamentId, tournamentId))
      .orderBy(asc(teams.seed), asc(teams.id));

    if (!rawTeams.length) {
      return NextResponse.json({ error: "No teams found for this tournament" }, { status: 400 });
    }

    // 2) Order teams
    let ordered = [...rawTeams];

    if (mode === "random") {
      ordered = shuffle(ordered);
    } else {
      // Seeded: null seeds go last; stable by id
      ordered.sort((a, b) => {
        const as = a.seed ?? 9999;
        const bs = b.seed ?? 9999;
        if (as !== bs) return as - bs;
        return a.id - b.id;
      });
    }

    // 3) Must be even
    if (ordered.length % 2 !== 0) {
      return NextResponse.json(
        { error: `Need an even number of teams. Found ${ordered.length}.` },
        { status: 400 }
      );
    }

    // 4) Pairings (seeded bracket style): 1vN, 2vN-1, ...
    const n = ordered.length;
    const pairs: Array<{ teamAId: number; teamBId: number; gameIndex: number }> = [];

    for (let i = 0; i < n / 2; i++) {
      const a = ordered[i];
      const b = ordered[n - 1 - i];
      pairs.push({
        teamAId: a.id,
        teamBId: b.id,
        gameIndex: i + 1, // order within round
      });
    }

    // 5) Write to games table
    await db.transaction(async (tx) => {
      if (wipeRound1) {
        await tx
          .delete(games)
          .where(and(eq(games.tournamentId, tournamentId), eq(games.round, 1)));
      }

      await tx.insert(games).values(
        pairs.map((p) => ({
          tournamentId,
          round: 1,
          gameIndex: p.gameIndex,
          teamAId: p.teamAId,
          teamBId: p.teamBId,
          winnerId: null,
          // updatedAt default is fine; DB sets defaultNow
        }))
      );
    });

    return NextResponse.json(
      { ok: true, tournamentId, inserted: pairs.length, mode },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
} catch (e: unknown) {
  const message =
    e instanceof Error
      ? e.message
      : typeof e === "string"
      ? e
      : "Unknown error";

  return NextResponse.json(
    { error: message },
    { status: 500 }
  );
}

}

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
