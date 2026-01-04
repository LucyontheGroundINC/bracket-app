// app/api/scores/leaderboard/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function roundPoints(round: number) {
  return Math.pow(2, Math.max(0, round - 1)); // 1,2,4,8,16,32
}

type MatchRow = {
  id: number | string;
  round: number | null;
  winner: "team1" | "team2" | null;
};

type PickRow = {
  user_id: string | number;
  match_id: string | number;
  chosen_winner: "team1" | "team2" | null;
};

type UserRow = {
  id: string | number;
  display_name?: string | null;
  displayName?: string | null;
  name?: string | null;
  username?: string | null;
  full_name?: string | null;
};

// GET /api/scores/leaderboard
export async function GET() {
  try {
    if (!supabaseAdmin) {
      console.error("[leaderboard] supabaseAdmin is not configured");
      return NextResponse.json(
        {
          error:
            "Supabase admin client not configured. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 }
      );
    }

    // 1) Load matches that have winners set
    const { data: matches, error: matchesError } = await supabaseAdmin
      .from("matches")
      .select("id, round, winner")
      .not("winner", "is", null);

    if (matchesError) {
      console.error("[leaderboard] Error loading matches:", matchesError);
      return NextResponse.json({ error: "Failed to load matches" }, { status: 500 });
    }

    const matchRows = (matches ?? []) as MatchRow[];
    if (matchRows.length === 0) return NextResponse.json([]);

    const matchMeta = new Map<string, { round: number; winner: "team1" | "team2" }>();

    for (const m of matchRows) {
      if (!m.winner) continue;
      matchMeta.set(String(m.id), {
        round: m.round ?? 1,
        winner: m.winner,
      });
    }

    if (matchMeta.size === 0) return NextResponse.json([]);

    const matchIds = Array.from(matchMeta.keys());

    // 2) All picks for those matches
    const { data: picks, error: picksError } = await supabaseAdmin
      .from("picks")
      .select("user_id, match_id, chosen_winner")
      .in("match_id", matchIds);

    if (picksError) {
      console.error("[leaderboard] Error loading picks:", picksError);
      return NextResponse.json({ error: "Failed to load picks" }, { status: 500 });
    }

    const pickRows = (picks ?? []) as PickRow[];
    if (pickRows.length === 0) return NextResponse.json([]);

    // 3) Aggregate score + correct picks per user
    const totalsByUser = new Map<string, { totalScore: number; correctCount: number }>();

    for (const p of pickRows) {
      const meta = matchMeta.get(String(p.match_id));
      if (!meta) continue;

      const isCorrect = p.chosen_winner === meta.winner;
      if (!isCorrect) continue;

      const points = roundPoints(meta.round);
      const userId = String(p.user_id);

      const prev = totalsByUser.get(userId) ?? { totalScore: 0, correctCount: 0 };
      prev.totalScore += points;
      prev.correctCount += 1;
      totalsByUser.set(userId, prev);
    }

    if (totalsByUser.size === 0) return NextResponse.json([]);

    // 4) Look up display names from your "users" table
    const userIds = Array.from(totalsByUser.keys());
    const userInfo = new Map<string, { displayName: string | null }>();

    if (userIds.length) {
      const { data: dbUsers, error: dbUsersError } = await supabaseAdmin
        .from("users")
        .select("id, display_name, displayName, name, username, full_name")
        .in("id", userIds);

      if (dbUsersError) {
        console.warn("[leaderboard] Could not load users table:", dbUsersError);
      } else {
        const rows = (dbUsers ?? []) as UserRow[];
        for (const raw of rows) {
          const id = String(raw.id);
          const displayName =
            raw.display_name ??
            raw.displayName ??
            raw.name ??
            raw.username ??
            raw.full_name ??
            null;

          userInfo.set(id, { displayName });
        }
      }
    }

    // 5) Build leaderboard response (NO EMAILS)
    const leaderboard = Array.from(totalsByUser.entries())
      .map(([userId, { totalScore, correctCount }]) => {
        const info = userInfo.get(userId) ?? { displayName: null };
        return { userId, displayName: info.displayName, totalScore, correctCount };
      })
      .sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        const nameA = (a.displayName ?? "").toLowerCase();
        const nameB = (b.displayName ?? "").toLowerCase();
        return nameA.localeCompare(nameB);
      });

    return NextResponse.json(leaderboard);
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

