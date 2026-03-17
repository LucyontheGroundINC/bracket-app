import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Supabase admin client not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const tournamentIdParam = searchParams.get("tournamentId");
    const tournamentId =
      tournamentIdParam && Number.isFinite(Number(tournamentIdParam))
        ? Number(tournamentIdParam)
        : null;

    const probe = await supabaseAdmin.from("matches").select("tournament_id").limit(1);
    const hasTournamentIdColumn = !probe.error;

    const allCountRes = await supabaseAdmin
      .from("matches")
      .select("id", { head: true, count: "exact" });

    let selectedTournamentMatchCount: number | null = null;
    let selectedTournamentError: string | null = null;

    if (tournamentId !== null) {
      const scoped = await supabaseAdmin
        .from("matches")
        .select("id", { head: true, count: "exact" })
        .eq("tournament_id", tournamentId);

      if (scoped.error) {
        selectedTournamentError = scoped.error.message;
      } else {
        selectedTournamentMatchCount = scoped.count ?? 0;
      }
    }

    return NextResponse.json({
      ok: true,
      hasTournamentIdColumn,
      probeError: probe.error?.message ?? null,
      allMatchesCount: allCountRes.count ?? 0,
      allMatchesError: allCountRes.error?.message ?? null,
      selectedTournamentId: tournamentId,
      selectedTournamentMatchCount,
      selectedTournamentError,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
