export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { tournaments } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.isActive, true))
      .orderBy(desc(tournaments.createdAt))
      .limit(2);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No active tournament. Set one tournament is_active=true." },
        { status: 500 }
      );
    }

    if (rows.length > 1) {
      return NextResponse.json(
        { error: "Multiple active tournaments. Only one can be active." },
        { status: 500 }
      );
    }

    return NextResponse.json(rows[0]);
  } catch (e: any) {
    console.error("GET /api/tournaments/active failed:", e);
    return NextResponse.json(
      { error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
