import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

type Body = {
  matchId?: string;
  chosenWinner?: "team1" | "team2";
};

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token;
}

function getAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const authClient = getAuthClient();
    if (!authClient) {
      return NextResponse.json({ error: "Supabase auth client not configured" }, { status: 500 });
    }

    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const authRes = await authClient.auth.getUser(token);
    const authUser = authRes.data.user;

    if (authRes.error || !authUser) {
      return NextResponse.json({ error: authRes.error?.message ?? "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const matchId = (body.matchId ?? "").trim();
    const chosenWinner = body.chosenWinner;

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS picks_user_match_uidx
      ON public.picks (user_id, match_id)
    `);

    if (!matchId || (chosenWinner !== "team1" && chosenWinner !== "team2")) {
      return NextResponse.json(
        { error: "matchId and chosenWinner(team1|team2) are required" },
        { status: 400 }
      );
    }

    const matchRows = (await db.execute(sql`
      SELECT id, tournament_id
      FROM public.matches
      WHERE id = ${matchId}
      LIMIT 1
    `)) as Array<{ id: string; tournament_id: number | null }>;

    const matchRow = Array.isArray(matchRows) ? matchRows[0] : null;

    if (!matchRow) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const tournamentId =
      typeof matchRow.tournament_id === "number" ? matchRow.tournament_id : null;

    if (tournamentId !== null) {
      const tournamentRows = (await db.execute(sql`
        SELECT is_locked_manual, lock_at
        FROM public.tournaments
        WHERE id = ${tournamentId}
        LIMIT 1
      `)) as Array<{ is_locked_manual: boolean | null; lock_at: string | null }>;

      const tournament = Array.isArray(tournamentRows) ? tournamentRows[0] : null;

      const isManualLock = !!tournament?.is_locked_manual;
      const lockAt = tournament?.lock_at ? new Date(tournament.lock_at) : null;
      const isTimeLock = !!lockAt && lockAt <= new Date();

      if (isManualLock || isTimeLock) {
        return NextResponse.json({ error: "Picks are locked for this tournament" }, { status: 403 });
      }
    }

    const uid = authUser.id;

    const upsertRows = (await db.execute(sql`
      INSERT INTO public.picks (user_id, match_id, chosen_winner)
      VALUES (${uid}, ${matchId}, ${chosenWinner})
      ON CONFLICT (user_id, match_id)
      DO UPDATE SET chosen_winner = EXCLUDED.chosen_winner
      RETURNING id
    `)) as Array<{ id: string | number }>;

    const savedId = Array.isArray(upsertRows) && upsertRows[0] ? upsertRows[0].id : null;
    return NextResponse.json({ ok: true, id: savedId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
