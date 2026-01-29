import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "supabaseAdmin not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const seasonId = searchParams.get("seasonId");

    if (!seasonId) {
      return NextResponse.json({ error: "Missing seasonId" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("biggest_night_categories")
      .select("id, name, sort_order")
      .eq("season_id", seasonId)
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ error: "Failed to load categories" }, { status: 500 });
  }
}

