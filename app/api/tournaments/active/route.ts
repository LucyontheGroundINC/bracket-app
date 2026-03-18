import { NextResponse } from "next/server";
import { pool } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/tournaments/active
export async function GET() {
  try {
    const { rows } = await pool.query(
      `
        select
          id,
          name,
          year,
          is_active,
          created_at,
          is_locked_manual,
          lock_at
        from public.tournaments
        where is_active = true
        order by created_at desc
        limit 1
      `
    );

    return NextResponse.json(rows[0] ?? null);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[tournaments] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

}

