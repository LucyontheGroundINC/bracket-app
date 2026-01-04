export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const tournamentId = Number(body?.tournamentId);
    const wipeMatches = body?.wipeMatches !== false; // default true

    if (!Number.isFinite(tournamentId)) {
      return NextResponse.json({ ok: false, error: "tournamentId must be a number" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    // 1) Delete games first (they reference teams)
    const { error: delGamesErr } = await supabaseAdmin
      .from("games")
      .delete()
      .eq("tournament_id", tournamentId);

    if (delGamesErr) {
      return NextResponse.json(
        { ok: false, step: "delete_games", error: delGamesErr.message },
        { status: 500 }
      );
    }

    // 2) Delete teams
    const { error: delTeamsErr } = await supabaseAdmin
      .from("teams")
      .delete()
      .eq("tournament_id", tournamentId);

    if (delTeamsErr) {
      return NextResponse.json(
        { ok: false, step: "delete_teams", error: delTeamsErr.message },
        { status: 500 }
      );
    }

    // 3) Optional: wipe matches (your bracket UI reads Supabase matches)
    if (wipeMatches) {
      const { error: delMatchesErr } = await supabaseAdmin
        .from("matches")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all

      if (delMatchesErr) {
        return NextResponse.json(
          { ok: false, step: "delete_matches", error: delMatchesErr.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { ok: true, tournamentId, wiped: { games: true, teams: true, matches: wipeMatches } },
      { status: 200 }
    );
} catch (e: unknown) {
  const message =
    e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";

  console.error("[generate-round1 games] error:", message, e);

  return NextResponse.json({ error: message }, { status: 500 });
}


}
