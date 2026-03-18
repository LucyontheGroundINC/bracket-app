import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

type Body = {
  userId?: string;
  matchId?: string;
  error?: string;
  tournamentId?: number | null;
};

function classifyErrorType(message: string) {
  const m = message.toLowerCase();
  if (m.includes("locked")) return "locked";
  if (m.includes("permission") || m.includes("not allowed") || m.includes("policy") || m.includes("rls")) {
    return "permission";
  }
  if (m.includes("duplicate") || m.includes("unique")) return "conflict";
  if (m.includes("schema") || m.includes("column") || m.includes("relation")) return "schema";
  if (m.includes("network") || m.includes("fetch") || m.includes("timeout")) return "network";
  return "unknown";
}

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

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS pick_save_telemetry_error_type_idx
    ON public.pick_save_telemetry (error_type)
  `);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    const userId = (body.userId ?? "").trim().slice(0, 120);
    const matchId = (body.matchId ?? "").trim().slice(0, 120);
    const errorText = (body.error ?? "Unknown error").trim().slice(0, 800);
    const tournamentId = Number.isFinite(Number(body.tournamentId)) ? Number(body.tournamentId) : null;

    await ensureTable();

    const errorType = classifyErrorType(errorText);

    await db.execute(sql`
      INSERT INTO public.pick_save_telemetry (user_id, match_id, tournament_id, error_text, error_type)
      VALUES (${userId || null}, ${matchId || null}, ${tournamentId}, ${errorText}, ${errorType})
    `);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
