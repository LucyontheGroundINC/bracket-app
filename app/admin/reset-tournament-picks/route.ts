// app/api/admin/reset-tournament-picks/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { picks, brackets } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

/**
 * POST /api/admin/reset-tournament-picks
 * Body: { tournamentId: number }
 *
 * Deletes ALL picks whose brackets belong to the given tournament.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const tournamentId = Number(body?.tournamentId);

    if (!tournamentId || Number.isNaN(tournamentId)) {
      return NextResponse.json(
        { error: "Missing or invalid tournamentId" },
        { status: 400 }
      );
    }

    // find all bracket IDs for this tournament
    const bracketRows = await db
      .select({ id: brackets.id })
      .from(brackets)
      .where(eq(brackets.tournamentId, tournamentId));

    if (!bracketRows.length) {
      return NextResponse.json({
        ok: true,
        deleted: 0,
        message: "No brackets found for this tournament.",
      });
    }

    const bracketIds = bracketRows.map((b) => b.id);

    const deletedRows = await db
      .delete(picks)
      .where(inArray(picks.bracketId, bracketIds))
      .returning({ id: picks.id });

    return NextResponse.json({
      ok: true,
      deleted: deletedRows.length,
    });
  } catch (err: any) {
    console.error("reset-tournament-picks failed:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
