// app/api/tournaments/active/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { tournaments } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.isActive, true))
      .orderBy(desc(tournaments.createdAt))
      .limit(2);

    // Return the newest active (or null)
    return NextResponse.json(rows?.[0] ?? null);
  } catch (e: unknown) {
    const err = e as any;

    // This is the part you NEED — it will tell you column missing / perms / etc.
    console.error("[tournaments/active] error:", err);

    return NextResponse.json(
      {
        ok: false,
        marker: "tournaments-active-v2",
        message: err?.message ?? String(err),
        code: err?.code ?? null,
        detail: err?.detail ?? null,
        cause: err?.cause?.message ?? err?.cause ?? null,
      },
      { status: 500 }
    );
  }
}
