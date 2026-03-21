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

type UserScoreRow = {
  user_id: string | number;
  total_points: number | null;
  correct_picks: number | null;
};

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
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

    const totalsByUser = new Map<string, { totalScore: number; correctCount: number }>();

    // 1) Primary source: canonical user_scores view/table for the active tournament.
    // If a non-active tournament is requested, we fall back to live aggregation.
    let useLiveFallback = true;

    const { data: activeTournamentRows, error: activeTournamentError } = await supabaseAdmin
      .from("tournaments")
      .select("id")
      .eq("is_active", true)
      .limit(1);

    if (activeTournamentError) {
      console.warn("[leaderboard] Could not load active tournament:", activeTournamentError);
    } else {
      const activeTournamentId = Number(activeTournamentRows?.[0]?.id ?? NaN);
      const targetsActiveTournament =
        Number.isFinite(activeTournamentId) &&
        (tournamentId === null || tournamentId === activeTournamentId);

      if (targetsActiveTournament) {
        const { data: userScores, error: userScoresError } = await supabaseAdmin
          .from("user_scores")
          .select("user_id, total_points, correct_picks");

        if (userScoresError) {
          console.warn("[leaderboard] Could not load user_scores; using live fallback:", userScoresError);
        } else {
          for (const row of (userScores ?? []) as UserScoreRow[]) {
            const userId = String(row.user_id);
            totalsByUser.set(userId, {
              totalScore: Number(row.total_points ?? 0),
              correctCount: Number(row.correct_picks ?? 0),
            });
          }
          useLiveFallback = false;
        }
      }
    }

    // 1b) Fallback: live aggregation from matches + picks
    if (useLiveFallback) {
      let matchesQuery = supabaseAdmin
        .from("matches")
        .select("id, round, winner")
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (tournamentId !== null) {
        matchesQuery = matchesQuery.eq("tournament_id", tournamentId);
      }

      const { data: matches, error: matchesError } = await matchesQuery;

      if (matchesError) {
        console.error("[leaderboard] Error loading matches:", matchesError);
        return NextResponse.json({ error: "Failed to load matches" }, { status: 500 });
      }

      const matchRows = (matches ?? []) as MatchRow[];
      if (matchRows.length === 0) return NextResponse.json([]);

      const allMatchIds = matchRows.map((m) => String(m.id));

      const matchMeta = new Map<string, { round: number; winner: "team1" | "team2" }>();
      for (const m of matchRows) {
        if (!m.winner) continue;
        matchMeta.set(String(m.id), { round: m.round ?? 1, winner: m.winner });
      }

      // 2) Load picks for all matches in scope so users with 0 points are still listed
      const { data: picks, error: picksError } = await supabaseAdmin
        .from("picks")
        .select("user_id, match_id, chosen_winner")
        .in("match_id", allMatchIds);

      if (picksError) {
        console.error("[leaderboard] Error loading picks:", picksError);
        return NextResponse.json({ error: "Failed to load picks" }, { status: 500 });
      }

      const pickRows = (picks ?? []) as PickRow[];
      if (pickRows.length === 0) return NextResponse.json([]);

      // 3) Aggregate score + correct picks per user
      // Start by registering every user that has at least one pick in scope.
      for (const p of pickRows) {
        const userId = String(p.user_id);
        if (!totalsByUser.has(userId)) {
          totalsByUser.set(userId, { totalScore: 0, correctCount: 0 });
        }
      }

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
    }

    if (totalsByUser.size === 0) return NextResponse.json([]);

    // 3.5) Exclude admin users from public leaderboard
    const candidateUserIds = Array.from(totalsByUser.keys());
    const adminUserIds = new Set<string>();
    for (const userIdBatch of chunkArray(candidateUserIds, 150)) {
      const { data: adminProfiles, error: adminProfilesError } = await supabaseAdmin
        .from("profiles")
        .select("user_id, is_admin")
        .in("user_id", userIdBatch)
        .eq("is_admin", true);

      if (adminProfilesError) {
        console.warn("[leaderboard] Could not load admin profile flags:", adminProfilesError);
      } else {
        for (const row of (adminProfiles ?? []) as Array<{ user_id: string | number }>) {
          adminUserIds.add(String(row.user_id));
        }
      }
    }

    for (const adminUserId of adminUserIds) {
      totalsByUser.delete(adminUserId);
    }

    if (totalsByUser.size === 0) return NextResponse.json([]);

    // 4) Look up display names + avatars (users first, profiles fallback)
    const userIds = Array.from(totalsByUser.keys());
    const userInfo = new Map<string, { displayName: string | null; avatarUrl: string | null }>();

    for (const userIdBatch of chunkArray(userIds, 150)) {
      const { data: dbUsers, error: dbUsersError } = await supabaseAdmin
        .from("users")
        .select("id, display_name, avatar_url")
        .in("id", userIdBatch);

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
    }

    for (const userIdBatch of chunkArray(userIds, 150)) {
      const { data: dbProfiles, error: dbProfilesError } = await supabaseAdmin
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIdBatch);

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
    }

    // NOTE: profiles table uses user_id + display_name (NOT username)

    // 5) Build leaderboard response (NO EMAILS)
    const leaderboard = Array.from(totalsByUser.entries())
      .map(([userId, { totalScore, correctCount }]) => {
        const info = userInfo.get(userId) ?? { displayName: null, avatarUrl: null };
        const fallbackName = `Player ${userId.slice(0, 8)}`;
        return {
          userId,
          displayName: info.displayName ?? fallbackName,
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
