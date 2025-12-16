// app/api/picks/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { picks, games } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isTournamentLocked } from "@/utils/isLocked";

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      bracketId: number;
      gameId: number;
      pickedTeamId: number;
    };

    // Find the tournament this game belongs to
    const [game] = await db
      .select({ tournamentId: games.tournamentId })
      .from(games)
      .where(eq(games.id, body.gameId))
      .limit(1);

    if (!game) {
      return NextResponse.json({ ok: false, error: "Game not found" }, { status: 404 });
    }

    // 🧠 Check if tournament is locked
    if (await isTournamentLocked(game.tournamentId)) {
      return NextResponse.json({ ok: false, error: "Tournament is locked" }, { status: 403 });
    }

    // If not locked → allow pick insert/update
    const [newPick] = await db
      .insert(picks)
      .values({
        bracketId: body.bracketId,
        gameId: body.gameId,
        pickedTeamId: body.pickedTeamId,
      })
      .onConflictDoUpdate({
        target: [picks.bracketId, picks.gameId],
        set: { pickedTeamId: body.pickedTeamId },
      })
      .returning();

    return NextResponse.json({ ok: true, pick: newPick });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}



