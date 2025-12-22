// app/api/tournaments/active/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { tournaments } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toDto(row: any) {
  return {
    id: row.id,
    name: row.name,
    year: row.year ?? null,
    isActive: row.isActive ?? null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    isLockedManual: row.isLockedManual ?? null,
    lockAt: row.lockAt ? new Date(row.lockAt).toISOString() : null,
  };
}

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.isActive, true))
      .orderBy(desc(tournaments.createdAt))
      .limit(1);

    return NextResponse.json(rows?.[0] ? toDto(rows[0]) : null);
  } catch (e: unknown) {
    const err = e as any;
    console.error("[tournaments/active] error:", err);

    return NextResponse.json(
      {
        ok: false,
        marker: "tournaments-active-v3",
        message: err?.message ?? String(err),
        code: err?.code ?? null,
        detail: err?.detail ?? null,
        hint: err?.hint ?? null,
        cause: err?.cause?.message ?? err?.cause ?? null,
      },
      { status: 500 }
    );
  }
}
