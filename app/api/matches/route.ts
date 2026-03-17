import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function isMissingTournamentColumnError(message: string) {
  const m = message.toLowerCase();
  return m.includes("tournament_id") && m.includes("schema cache");
}

export async function GET(req: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Supabase admin client not configured" }, { status: 500 });
    }

    const admin = supabaseAdmin;

    const { searchParams } = new URL(req.url);
    const tournamentIdParam = searchParams.get("tournamentId");
    const tournamentId =
      tournamentIdParam && Number.isFinite(Number(tournamentIdParam))
        ? Number(tournamentIdParam)
        : null;

    const runUnscoped = () =>
      admin
        .from("matches")
        .select("*")
        .order("region", { ascending: true })
        .order("round", { ascending: true })
        .order("match_order", { ascending: true });

    let query = runUnscoped();
    if (tournamentId !== null) {
      query = admin
        .from("matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("region", { ascending: true })
        .order("round", { ascending: true })
        .order("match_order", { ascending: true });
    }

    let { data, error } = await query;

    if (error && tournamentId !== null && isMissingTournamentColumnError(error.message)) {
      const fallback = await runUnscoped();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(Array.isArray(data) ? data : [], {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
