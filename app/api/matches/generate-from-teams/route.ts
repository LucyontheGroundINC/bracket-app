export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const REGIONS = ["East", "West", "South", "Midwest"] as const;
type Region = (typeof REGIONS)[number];

type TeamRow = {
  id: number;
  name: string;
  seed: number | null;
  tournament_id: number;
};

type MatchInsert = {
  region: string;
  round: number;
  match_order: number;
  team1_name: string | null;
  team2_name: string | null;
  team1_seed: number | null;
  team2_seed: number | null;
  winner: "team1" | "team2" | null;
};

function getErrorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Unknown error";
}

function getSupabaseAdmin(): { client: SupabaseClient; projectRef: string | null } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const projectRef =
    url.includes("https://") ? url.replace("https://", "").split(".")[0] : null;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Restart dev server after adding."
    );
  }

  return {
    client: createClient(url, serviceKey, { auth: { persistSession: false } }),
    projectRef,
  };
}

/* -------------------- GET (diagnostic) -------------------- */
export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    const projectRef =
      url.includes("https://") ? url.replace("https://", "").split(".")[0] : null;

    if (!url || !hasServiceKey) {
      return NextResponse.json({
        ok: false,
        marker: "matches-generate-from-teams:diag",
        projectRef,
        hasUrl: !!url,
        hasServiceKey,
        message:
          "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Restart dev server after adding.",
      });
    }

    const { client: supabaseAdmin } = getSupabaseAdmin();

    const { count: teamCount, error: teamCountErr } = await supabaseAdmin
      .from("teams")
      .select("*", { count: "exact", head: true });

    if (teamCountErr) {
      return NextResponse.json({ ok: false, error: teamCountErr.message }, { status: 500 });
    }

    const { count: matchCount, error: matchCountErr } = await supabaseAdmin
      .from("matches")
      .select("*", { count: "exact", head: true });

    if (matchCountErr) {
      return NextResponse.json({ ok: false, error: matchCountErr.message }, { status: 500 });
    }

    const { data: latestMatch, error: latestErr } = await supabaseAdmin
      .from("matches")
      .select("id,region,round,match_order,team1_name,team2_name,created_at")
      .order("created_at", { ascending: false })
      .limit(1);

    if (latestErr) {
      return NextResponse.json({ ok: false, error: latestErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      marker: "matches-generate-from-teams:diag",
      projectRef,
      teamCount,
      matchCount,
      latestMatch: latestMatch?.[0] ?? null,
    });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: getErrorMessage(e) }, { status: 500 });
  }
}

/* -------------------- POST (generator) -------------------- */
export async function POST(req: Request) {
  try {
    const body: unknown = await req.json().catch(() => ({}));

    const obj =
      typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

    const tournamentId = Number(obj.tournamentId);
    const mode = (obj.mode === "random" ? "random" : "seeded") as "seeded" | "random";
    const wipeAll = obj.wipeAll === false ? false : true; // default true

    if (!Number.isFinite(tournamentId)) {
      return NextResponse.json({ error: "tournamentId must be a number" }, { status: 400 });
    }

    const { client: supabaseAdmin } = getSupabaseAdmin();

    // Load teams for this tournament
    const { data: teamsRaw, error: teamErr } = await supabaseAdmin
      .from("teams")
      .select("id,name,seed,tournament_id")
      .eq("tournament_id", tournamentId);

    if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 500 });

    const teams = (teamsRaw ?? []) as TeamRow[];

    if (teams.length === 0) {
      return NextResponse.json({ error: "No teams found for this tournament" }, { status: 400 });
    }

    if (teams.length !== 64) {
      return NextResponse.json(
        { error: `Expected exactly 64 teams for this bracket UI. Found ${teams.length}.` },
        { status: 400 }
      );
    }

    // Order teams
    const ordered = [...teams];

    if (mode === "random") {
      // Fisher–Yates shuffle
      for (let i = ordered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
      }
    } else {
      // seeded: seed asc (nulls last), stable by id
      ordered.sort((a, b) => {
        const as = a.seed ?? 9999;
        const bs = b.seed ?? 9999;
        if (as !== bs) return as - bs;
        return a.id - b.id;
      });
    }

    // Wipe matches first (your bracket UI reads only this table)
    if (wipeAll) {
      const { error: wipeErr } = await supabaseAdmin
        .from("matches")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (wipeErr) return NextResponse.json({ error: wipeErr.message }, { status: 500 });
    }

    // Build full skeleton inserts
    const inserts: MatchInsert[] = [];

    // 64 teams => 16 per region
    const perRegion = 16;

    // Round 1 per region: 8 matches, standard pairing 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15
    const pairings: ReadonlyArray<readonly [number, number]> = [
      [0, 15], // 1 vs 16 (if sorted by seed)
      [7, 8], // 8 vs 9
      [4, 11], // 5 vs 12
      [3, 12], // 4 vs 13
      [5, 10], // 6 vs 11
      [2, 13], // 3 vs 14
      [6, 9], // 7 vs 10
      [1, 14], // 2 vs 15
    ] as const;

    for (let r = 0; r < 4; r++) {
      const region: Region = REGIONS[r];
      const chunk = ordered.slice(r * perRegion, (r + 1) * perRegion);

      // Round 1 (8 matches)
      pairings.forEach(([aIdx, bIdx], i) => {
        const a = chunk[aIdx];
        const b = chunk[bIdx];

        inserts.push({
          region,
          round: 1,
          match_order: i + 1,
          team1_name: a?.name ?? null,
          team2_name: b?.name ?? null,
          team1_seed: a?.seed ?? null,
          team2_seed: b?.seed ?? null,
          winner: null,
        });
      });

      // Round 2 (4 matches placeholders)
      for (let i = 1; i <= 4; i++) {
        inserts.push({
          region,
          round: 2,
          match_order: i,
          team1_name: `Winner ${region} R1 M${(i - 1) * 2 + 1}`,
          team2_name: `Winner ${region} R1 M${(i - 1) * 2 + 2}`,
          team1_seed: null,
          team2_seed: null,
          winner: null,
        });
      }

      // Round 3 (2 matches placeholders)
      for (let i = 1; i <= 2; i++) {
        inserts.push({
          region,
          round: 3,
          match_order: i,
          team1_name: `Winner ${region} R2 M${(i - 1) * 2 + 1}`,
          team2_name: `Winner ${region} R2 M${(i - 1) * 2 + 2}`,
          team1_seed: null,
          team2_seed: null,
          winner: null,
        });
      }

      // Round 4 (1 match placeholder) = region champion
      inserts.push({
        region,
        round: 4,
        match_order: 1,
        team1_name: `Winner ${region} R3 M1`,
        team2_name: `Winner ${region} R3 M2`,
        team1_seed: null,
        team2_seed: null,
        winner: null,
      });
    }

    // Final Four region (round 5 semis, round 6 championship)
    inserts.push(
      {
        region: "Final Four",
        round: 5,
        match_order: 1,
        team1_name: "East Champion",
        team2_name: "West Champion",
        team1_seed: null,
        team2_seed: null,
        winner: null,
      },
      {
        region: "Final Four",
        round: 5,
        match_order: 2,
        team1_name: "South Champion",
        team2_name: "Midwest Champion",
        team1_seed: null,
        team2_seed: null,
        winner: null,
      },
      {
        region: "Final Four",
        round: 6,
        match_order: 1,
        team1_name: "Semifinal Winner 1",
        team2_name: "Semifinal Winner 2",
        team1_seed: null,
        team2_seed: null,
        winner: null,
      }
    );

    const { error: insertErr } = await supabaseAdmin.from("matches").insert(inserts);

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, inserted: inserts.length });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}
