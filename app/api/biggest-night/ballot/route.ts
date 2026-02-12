// app/api/biggest-night/ballot/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SeasonRow = {
  id: string;
  name: string;
  year: number | null;
  is_active: boolean;
  lock_at: string | null;
};

type CategoryRow = {
  id: string;
  season_id: string;
  name: string;
  sort_order: number;
};

type NomineeRow = {
  id: string;
  category_id: string;
  name: string;
  subtitle: string | null;
  image_url: string | null;
  weight_points: number | null;
  sort_order: number;
};

export async function GET(req: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "supabaseAdmin not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const seasonIdParam = searchParams.get("seasonId");

    // 1) Resolve season (explicit seasonId OR active season)
    let season: SeasonRow | null = null;

    if (seasonIdParam) {
      const { data, error } = await supabaseAdmin
        .from("biggest_night_seasons")
        .select("id, name, year, is_active, lock_at")
        .eq("id", seasonIdParam)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      season = (data as SeasonRow) ?? null;
    } else {
      const { data, error } = await supabaseAdmin
        .from("biggest_night_seasons")
        .select("id, name, year, is_active, lock_at")
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      season = (data as SeasonRow) ?? null;
    }

    if (!season) return NextResponse.json({ season: null, categories: [] });

    // 2) Load categories for season
    const { data: categoriesData, error: categoriesError } = await supabaseAdmin
      .from("biggest_night_categories")
      .select("id, season_id, name, sort_order")
      .eq("season_id", season.id)
      .order("sort_order", { ascending: true });

    if (categoriesError) {
      return NextResponse.json(
        { error: categoriesError.message },
        { status: 500 }
      );
    }

    const categories = (categoriesData ?? []) as CategoryRow[];
    if (categories.length === 0) {
      return NextResponse.json({ season, categories: [] });
    }

    const categoryIds = categories.map((c) => c.id);

    // 3) Load nominees for those categories
    const { data: nomineesData, error: nomineesError } = await supabaseAdmin
      .from("biggest_night_nominees")
      .select("id, category_id, name, subtitle, image_url, weight_points, sort_order")
      .in("category_id", categoryIds)
      .order("sort_order", { ascending: true });

    if (nomineesError) {
      return NextResponse.json(
        { error: nomineesError.message },
        { status: 500 }
      );
    }

    const nominees = (nomineesData ?? []) as NomineeRow[];

    // 4) Shape response: categories with nested nominees
    const nomineesByCategory = new Map<string, NomineeRow[]>();
    for (const n of nominees) {
      const key = String(n.category_id);
      const list = nomineesByCategory.get(key) ?? [];
      list.push(n);
      nomineesByCategory.set(key, list);
    }

    const payload = {
      season: {
        id: season.id,
        name: season.name,
        year: season.year,
        lockAt: season.lock_at,
        isActive: season.is_active,
      },
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        sortOrder: c.sort_order,
        nominees:
          (nomineesByCategory.get(String(c.id)) ?? []).sort((a, b) => {
            const aPoints = a.weight_points ?? 0;
            const bPoints = b.weight_points ?? 0;
            if (aPoints !== bPoints) return aPoints - bPoints;
            return (a.sort_order ?? 0) - (b.sort_order ?? 0);
          }),
      })),
    };

    return NextResponse.json(payload);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
