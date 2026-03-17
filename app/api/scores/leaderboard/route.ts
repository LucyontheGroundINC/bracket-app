// app/api/scores/leaderboard/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function roundPoints(round: number) {
  // 1, 2, 4, 8, 16, 32 ...
  return Math.pow(2, Math.max(0, round - 1));
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
  display_name: string | null;
  avatar_url: string | null;
};

function isMissingTournamentColumnError(message: string) {
  const m = message.toLowerCase();
  return m.includes("tournament_id") && m.includes("schema cache");
}

// GET /api/scores/leaderboard?tournamentId=...
export async function GET(req: Request) {
  try {
    if (!supabaseAdmin) {
      console.error("[leaderboard] supabaseAdmin is not configured");
      return NextResponse.json(
        {
          error:
            "Supabase admin client not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const tournamentIdParam = searchParams.get("tournamentId");
    const tournamentId =
      tournamentIdParam && Number.isFinite(Number(tournamentIdParam))
        ? Number(tournamentIdParam)
        : null;

    // 1) Load matches that have winners set
    let matchesQuery = supabaseAdmin
      .from("matches")
      .select("id, round, winner")
      .not("winner", "is", null);

    if (tournamentId !== null) {
      matchesQuery = matchesQuery.eq("tournament_id", tournamentId);
    }

    let { data: matches, error: matchesError } = await matchesQuery;

    if (matchesError && tournamentId !== null && isMissingTournamentColumnError(matchesError.message)) {
      const fallback = await supabaseAdmin
        .from("matches")
        .select("id, round, winner")
        .not("winner", "is", null);

      matches = fallback.data;
      matchesError = fallback.error;
    }

    if (matchesError) {
      console.error("[leaderboard] Error loading matches:", matchesError);
      return NextResponse.json({ error: "Failed to load matches" }, { status: 500 });
    }

    const matchRows = (matches ?? []) as MatchRow[];
    if (matchRows.length === 0) return NextResponse.json([]);

    const matchMeta = new Map<string, { round: number; winner: "team1" | "team2" }>();
    for (const m of matchRows) {
      if (!m.winner) continue;
      matchMeta.set(String(m.id), { round: m.round ?? 1, winner: m.winner });
    }

    if (matchMeta.size === 0) return NextResponse.json([]);

    const matchIds = Array.from(matchMeta.keys());

    // 2) Load picks for those matches
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

    // 4) Look up display names + avatars (users first, profiles fallback)
    const userIds = Array.from(totalsByUser.keys());
    const userInfo = new Map<string, { displayName: string | null; avatarUrl: string | null }>();

    const { data: dbUsers, error: dbUsersError } = await supabaseAdmin
      .from("users")
      .select("id, display_name, avatar_url")
      .in("id", userIds);

    if (dbUsersError) {
      console.warn("[leaderboard] Could not load users:", dbUsersError);
    } else {
      for (const raw of (dbUsers ?? []) as UserRow[]) {
        const id = String(raw.id);
        userInfo.set(id, {
          displayName: raw.display_name?.trim() || null,
          avatarUrl: raw.avatar_url ?? null,
        });
      }
    }

    const { data: dbProfiles, error: dbProfilesError } = await supabaseAdmin
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", userIds);

    if (dbProfilesError) {
      console.warn("[leaderboard] Could not load profiles:", dbProfilesError);
    } else {
      for (const raw of (dbProfiles ?? []) as Array<{
        user_id: string | number;
        display_name: string | null;
        avatar_url: string | null;
      }>) {
        const id = String(raw.user_id);
        const existing = userInfo.get(id);
        userInfo.set(id, {
          displayName: existing?.displayName ?? raw.display_name?.trim() ?? null,
          avatarUrl: existing?.avatarUrl ?? raw.avatar_url ?? null,
        });
      }
    }

    // NOTE: profiles table uses user_id + display_name (NOT username)

    // 5) Build leaderboard response (NO EMAILS)
    const leaderboard = Array.from(totalsByUser.entries())
      .map(([userId, { totalScore, correctCount }]) => {
        const info = userInfo.get(userId) ?? { displayName: null, avatarUrl: null };
        return {
          userId,
          displayName: info.displayName,
          avatarUrl: info.avatarUrl,
          totalScore,
          correctCount,
        };
      })
      .sort((a, b) => {
  // 1) Total points (primary)
  if (b.totalScore !== a.totalScore) {
    return b.totalScore - a.totalScore;
  }

  // 2) Total correct games (tie-breaker)
  if (b.correctCount !== a.correctCount) {
    return b.correctCount - a.correctCount;
  }

  // 3) Alphabetical fallback (stable order)
  const nameA = (a.displayName ?? "").toLowerCase();
  const nameB = (b.displayName ?? "").toLowerCase();
  return nameA.localeCompare(nameB);
});


    return NextResponse.json(leaderboard);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
    console.error("[leaderboard] Unhandled error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
