import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  matchId?: string;
  chosenWinner?: "team1" | "team2";
};

function isDuplicateError(message: string) {
  const m = message.toLowerCase();
  return m.includes("duplicate") || m.includes("unique");
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token;
}

export async function POST(req: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Supabase admin client not configured" }, { status: 500 });
    }

    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const authRes = await supabaseAdmin.auth.getUser(token);
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

    const { data: matchRow, error: matchError } = await supabaseAdmin
      .from("matches")
      .select("id,tournament_id")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError) {
      return NextResponse.json({ error: matchError.message }, { status: 500 });
    }

    if (!matchRow) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const tournamentId =
      typeof matchRow.tournament_id === "number" ? matchRow.tournament_id : null;

    if (tournamentId !== null) {
      const { data: tournament, error: tournamentError } = await supabaseAdmin
        .from("tournaments")
        .select("is_locked_manual,lock_at")
        .eq("id", tournamentId)
        .maybeSingle();

      if (tournamentError) {
        return NextResponse.json({ error: tournamentError.message }, { status: 500 });
      }

      const isManualLock = !!tournament?.is_locked_manual;
      const lockAt = tournament?.lock_at ? new Date(tournament.lock_at) : null;
      const isTimeLock = !!lockAt && lockAt <= new Date();

      if (isManualLock || isTimeLock) {
        return NextResponse.json({ error: "Picks are locked for this tournament" }, { status: 403 });
      }
    }

    const uid = authUser.id;

    const upsert = await supabaseAdmin
      .from("picks")
      .upsert(
        { user_id: uid, match_id: matchId, chosen_winner: chosenWinner },
        { onConflict: "user_id,match_id" }
      )
      .select("id")
      .maybeSingle();

    if (!upsert.error) {
      return NextResponse.json({ ok: true, id: upsert.data?.id ?? null });
    }

    const update = await supabaseAdmin
      .from("picks")
      .update({ chosen_winner: chosenWinner })
      .eq("user_id", uid)
      .eq("match_id", matchId)
      .select("id");

    if (!update.error && Array.isArray(update.data) && update.data.length > 0) {
      return NextResponse.json({ ok: true, id: update.data[0]?.id ?? null });
    }

    const insert = await supabaseAdmin
      .from("picks")
      .insert({ user_id: uid, match_id: matchId, chosen_winner: chosenWinner })
      .select("id")
      .maybeSingle();

    if (!insert.error) {
      return NextResponse.json({ ok: true, id: insert.data?.id ?? null });
    }

    if (isDuplicateError(insert.error.message)) {
      const retry = await supabaseAdmin
        .from("picks")
        .update({ chosen_winner: chosenWinner })
        .eq("user_id", uid)
        .eq("match_id", matchId)
        .select("id");

      if (!retry.error && Array.isArray(retry.data) && retry.data.length > 0) {
        return NextResponse.json({ ok: true, id: retry.data[0]?.id ?? null });
      }

      if (retry.error) {
        return NextResponse.json({ error: retry.error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ error: insert.error.message }, { status: 500 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
