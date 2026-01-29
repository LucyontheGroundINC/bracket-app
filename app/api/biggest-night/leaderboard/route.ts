// app/api/biggest-night/leaderboard/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SeasonRow = { id: string; name: string; year: number | null; is_active: boolean };

type CategoryIdRow = { id: string };

type WinnerRow = {
  id: string; // nominee id
  category_id: string;
  weight_points: number;
};

type PickRow = {
  user_id: string;
  category_id: string;
  nominee_id: string;
};

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export async function GET(req: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "supabaseAdmin not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const seasonIdParam = searchParams.get("seasonId");

    // 1) Resolve season
    let season: SeasonRow | null = null;

    if (seasonIdParam) {
      const { data, error } = await supabaseAdmin
        .from("biggest_night_seasons")
        .select("id, name, year, is_active")
        .eq("id", seasonIdParam)
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      season = (data as SeasonRow) ?? null;
    } else {
      const { data, error } = await supabaseAdmin
        .from("biggest_night_seasons")
        .select("id, name, year, is_active")
        .eq("is_active", true)
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      season = (data as SeasonRow) ?? null;
    }

    if (!season) return NextResponse.json({ season: null, leaderboard: [] });

    // 2) Get categories for season (needed to scope winners)
    const { data: categories, error: catErr } = await supabaseAdmin
      .from("biggest_night_categories")
      .select("id")
      .eq("season_id", season.id);

    if (catErr) return NextResponse.json({ error: catErr.message }, { status: 500 });

    const catRows = (categories ?? []) as CategoryIdRow[];
    const categoryIds = catRows.map((c) => String(c.id));

    if (categoryIds.length === 0) return NextResponse.json({ season, leaderboard: [] });

    // 3) Get winners (nominees where is_winner=true) + their weight_points
    const { data: winners, error: winErr } = await supabaseAdmin
      .from("biggest_night_nominees")
      .select("id, category_id, weight_points")
      .in("category_id", categoryIds)
      .eq("is_winner", true);

    if (winErr) return NextResponse.json({ error: winErr.message }, { status: 500 });

    const winnerRows = (winners ?? []) as WinnerRow[];

    // Map category -> winner nominee id + points
    const winnerByCategory = new Map<string, { nomineeId: string; points: number }>();
    for (const w of winnerRows) {
      winnerByCategory.set(String(w.category_id), {
        nomineeId: String(w.id),
        points: Number(w.weight_points) || 0,
      });
    }

    // If no winners yet, leaderboard is empty
    if (winnerByCategory.size === 0) {
      return NextResponse.json({
        season,
        leaderboard: [],
        note: "No winners set yet.",
      });
    }

    // 4) Load picks for season
    const { data: picks, error: picksErr } = await supabaseAdmin
      .from("biggest_night_picks")
      .select("user_id, category_id, nominee_id")
      .eq("season_id", season.id);

    if (picksErr) return NextResponse.json({ error: picksErr.message }, { status: 500 });

    const pickRows = (picks ?? []) as PickRow[];
    if (pickRows.length === 0) return NextResponse.json({ season, leaderboard: [] });

    // 5) Score: points + correct count
    const totalsByUser = new Map<string, { totalScore: number; correctCount: number }>();

    for (const p of pickRows) {
      const catId = String(p.category_id);
      const winner = winnerByCategory.get(catId);
      if (!winner) continue;

      const isCorrect = String(p.nominee_id) === winner.nomineeId;
      if (!isCorrect) continue;

      const userId = String(p.user_id);
      const prev = totalsByUser.get(userId) ?? { totalScore: 0, correctCount: 0 };
      prev.totalScore += winner.points;
      prev.correctCount += 1;
      totalsByUser.set(userId, prev);
    }

    if (totalsByUser.size === 0) return NextResponse.json({ season, leaderboard: [] });

    // 6) Attach display_name + avatar_url from profiles (your schema uses user_id)
    const userIds = Array.from(totalsByUser.keys());

    const userInfo = new Map<string, { displayName: string | null; avatarUrl: string | null }>();
    const { data: profs, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", userIds);

    if (!profErr) {
      const profRows = (profs ?? []) as ProfileRow[];
      for (const raw of profRows) {
        userInfo.set(String(raw.user_id), {
          displayName: raw.display_name ?? null,
          avatarUrl: raw.avatar_url ?? null,
        });
      }
    }

    // 7) Build leaderboard + sort (points -> correct games -> name)
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
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
        const nameA = (a.displayName ?? "").toLowerCase();
        const nameB = (b.displayName ?? "").toLowerCase();
        return nameA.localeCompare(nameB);
      });

    return NextResponse.json({ season, leaderboard });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
