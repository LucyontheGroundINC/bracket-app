import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS public.pick_save_telemetry (
      id serial PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now(),
      user_id text,
      match_id text,
      tournament_id integer,
      error_text text NOT NULL,
      error_type text NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS pick_save_telemetry_created_at_idx
    ON public.pick_save_telemetry (created_at DESC)
  `);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const hoursRaw = Number(searchParams.get("hours") ?? 24);
    const hours = Number.isFinite(hoursRaw) && hoursRaw > 0 ? Math.min(hoursRaw, 168) : 24;

    await ensureTable();

    const grouped = await db.execute(sql`
      SELECT error_type, COUNT(*)::int AS count
      FROM public.pick_save_telemetry
      WHERE created_at >= now() - (${hours} || ' hours')::interval
      GROUP BY error_type
      ORDER BY count DESC
    `);

    const total = await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM public.pick_save_telemetry
      WHERE created_at >= now() - (${hours} || ' hours')::interval
    `);

    const latest = await db.execute(sql`
      SELECT created_at, error_type, error_text
      FROM public.pick_save_telemetry
      ORDER BY created_at DESC
      LIMIT 5
    `);

    return NextResponse.json({
      ok: true,
      hours,
      total: Array.isArray(total) && total[0] ? Number((total[0] as { count: number }).count) : 0,
      byType: Array.isArray(grouped) ? grouped : [],
      latest: Array.isArray(latest) ? latest : [],
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
