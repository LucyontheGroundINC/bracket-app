import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { tournaments } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/tournaments/active
export async function GET() {
  try {
    // quick sanity check that the DB is reachable
    await db.execute(sql`select 1`);

    const rows = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.isActive, true))
      .orderBy(desc(tournaments.createdAt))
      .limit(1);

    return NextResponse.json(rows[0] ?? null);
  } catch (e: unknown) {
    const err = e as any;

    console.error("[tournaments/active] error:", err);

    return NextResponse.json(
      {
        ok: false,
        marker: "tournaments-active-v3",
        message: err?.message ?? String(err),
        // These often contain the real Postgres error:
        cause: err?.cause?.message ?? err?.cause ?? null,
        code: err?.code ?? null,
        detail: err?.detail ?? null,
        hint: err?.hint ?? null,
        // Sometimes drizzle wraps the query:
        query: err?.query ?? null,
      },
      { status: 500 }
    );
  }
}

