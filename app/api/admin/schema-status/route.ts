import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

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

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { tournamentId?: number };
    const tournamentId = Number(body?.tournamentId);

    if (!Number.isFinite(tournamentId)) {
      return NextResponse.json({ error: "tournamentId must be a number" }, { status: 400 });
    }

    await db.execute(sql`
      ALTER TABLE public.matches
      ADD COLUMN IF NOT EXISTS tournament_id integer
    `);

    await db.execute(sql`
      UPDATE public.matches
      SET tournament_id = ${tournamentId}
      WHERE tournament_id IS NULL
    `);

    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'matches_tournament_id_tournaments_id_fk'
        ) THEN
          ALTER TABLE public.matches
          ADD CONSTRAINT matches_tournament_id_tournaments_id_fk
          FOREIGN KEY (tournament_id)
          REFERENCES public.tournaments(id)
          ON DELETE NO ACTION
          ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS matches_tournament_region_round_order_idx
      ON public.matches (tournament_id, region, round, match_order)
    `);

    return NextResponse.json({ ok: true, repaired: true, tournamentId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
