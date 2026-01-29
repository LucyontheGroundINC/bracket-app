import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "supabaseAdmin not configured" },
        { status: 500 }
      );
    }

    const body = (await req.json().catch(() => null)) as
      | { userId?: string; displayName?: string }
      | null;

    const userId = body?.userId?.trim();
    const displayName = body?.displayName?.trim();

    if (!userId || !displayName) {
      return NextResponse.json(
        { error: "Missing userId or displayName" },
        { status: 400 }
      );
    }

    // Upsert profile row (your schema uses user_id)
    const { error } = await supabaseAdmin
      .from("profiles")
      .upsert(
        { user_id: userId, display_name: displayName },
        { onConflict: "user_id" }
      );

    if (error) {
      return NextResponse.json(
        { error: error.message ?? "Failed to upsert profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
