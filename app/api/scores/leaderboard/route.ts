// app/api/scores/leaderboard/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function roundPoints(round: number) {
  return Math.pow(2, Math.max(0, round - 1)); // 1,2,4,8,16,32
}

// GET /api/scores/leaderboard
export async function GET(_req: Request) {
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
      return NextResponse.json(
        { error: "Failed to load matches" },
        { status: 500 }
      );
    }

    if (!matches || matches.length === 0) {
      return NextResponse.json([]);
    }

    const matchMeta = new Map<
      string,
      { round: number; winner: "team1" | "team2" }
    >();

    for (const m of matches as any[]) {
      if (!m.winner) continue;
      matchMeta.set(String(m.id), {
        round: m.round ?? 1,
        winner: m.winner as "team1" | "team2",
      });
    }

    if (matchMeta.size === 0) {
      return NextResponse.json([]);
    }

    const matchIds = Array.from(matchMeta.keys());

    // 2) All picks for those matches
    const { data: picks, error: picksError } = await supabaseAdmin
      .from("picks")
      .select("user_id, match_id, chosen_winner")
      .in("match_id", matchIds);

    if (picksError) {
      console.error("[leaderboard] Error loading picks:", picksError);
      return NextResponse.json(
        { error: "Failed to load picks" },
        { status: 500 }
      );
    }

    if (!picks || picks.length === 0) {
      return NextResponse.json([]);
    }

    // 3) Aggregate score + correct picks per user
    const totalsByUser = new Map<
      string,
      { totalScore: number; correctCount: number }
    >();

    for (const p of picks as any[]) {
      const meta = matchMeta.get(String(p.match_id));
      if (!meta) continue;

      const isCorrect = p.chosen_winner === meta.winner;
      if (!isCorrect) continue;

      const points = roundPoints(meta.round);
      const userId = String(p.user_id);

      const prev = totalsByUser.get(userId) ?? {
        totalScore: 0,
        correctCount: 0,
      };

      prev.totalScore += points;
      prev.correctCount += 1;
      totalsByUser.set(userId, prev);
    }

    if (totalsByUser.size === 0) {
      return NextResponse.json([]);
    }

    // 4) Look up display names from your "users" table
    const userIds = Array.from(totalsByUser.keys());
    const userInfo = new Map<string, { displayName: string | null }>();

    if (userIds.length) {
      const { data: dbUsers, error: dbUsersError } = await supabaseAdmin
        .from("users")
        .select("*")
        .in("id", userIds);

      if (dbUsersError) {
        console.warn("[leaderboard] Could not load users table:", dbUsersError);
      } else if (dbUsers) {
        for (const raw of dbUsers as any[]) {
          const id = String(raw.id);

          // Prefer your canonical display_name column
          const displayName =
            raw.display_name ??
            raw.displayName ?? // just in case
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
        const info =
          userInfo.get(userId) ?? ({ displayName: null } as const);

        return {
          userId,
          displayName: info.displayName,
          totalScore,
          correctCount,
        };
      })
      .sort((a, b) => {
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore;
        }
        const nameA = (a.displayName ?? "").toLowerCase();
        const nameB = (b.displayName ?? "").toLowerCase();
        return nameA.localeCompare(nameB);
      });

    return NextResponse.json(leaderboard);
  } catch (e: any) {
    console.error("[leaderboard] Unexpected error:", e);
    return NextResponse.json(
      { error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}

