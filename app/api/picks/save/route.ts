import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pool } from "@/db";

export const runtime = "nodejs";

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

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(label)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
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

    const authRes = await withTimeout(authClient.auth.getUser(token), 5000, "Auth request timed out");
    const authUser = authRes.data.user;

    if (authRes.error || !authUser) {
      return NextResponse.json({ error: authRes.error?.message ?? "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const matchId = (body.matchId ?? "").trim();
    const chosenWinner = body.chosenWinner;

    if (!matchId || (chosenWinner !== "team1" && chosenWinner !== "team2")) {
      return NextResponse.json(
        { error: "matchId and chosenWinner(team1|team2) are required" },
        { status: 400 }
      );
    }

    const matchLookup = await pool.query<{
      id: string;
      tournament_id: number | null;
      is_locked_manual: boolean | null;
      lock_at: string | null;
    }>(
      `
        SELECT
          m.id,
          m.tournament_id,
          t.is_locked_manual,
          t.lock_at
        FROM public.matches m
        LEFT JOIN public.tournaments t ON t.id = m.tournament_id
        WHERE m.id = $1
        LIMIT 1
      `,
      [matchId]
    );

    const matchRow = matchLookup.rows[0] ?? null;

    if (!matchRow) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    if (typeof matchRow.tournament_id === "number") {
      const isManualLock = !!matchRow.is_locked_manual;
      const lockAt = matchRow.lock_at ? new Date(matchRow.lock_at) : null;
      const isTimeLock = !!lockAt && lockAt <= new Date();

      if (isManualLock || isTimeLock) {
        return NextResponse.json({ error: "Picks are locked for this tournament" }, { status: 403 });
      }
    }

    const uid = authUser.id;

    const upsert = await pool.query<{ id: string | number }>(
      `
        INSERT INTO public.picks (user_id, match_id, chosen_winner)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, match_id)
        DO UPDATE SET chosen_winner = EXCLUDED.chosen_winner
        RETURNING id
      `,
      [uid, matchId, chosenWinner]
    );

    const savedId = upsert.rows[0]?.id ?? null;
    return NextResponse.json({ ok: true, id: savedId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
