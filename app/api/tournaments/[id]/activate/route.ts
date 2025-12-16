export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { tournaments } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(_req: NextRequest, context: any) {
  try {
    const { id } = context.params;
    const numericId = Number(id);

    if (Number.isNaN(numericId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    // Deactivate all tournaments
    await db.update(tournaments).set({ isActive: false });

    // Activate selected tournament
    const updated = await db
      .update(tournaments)
      .set({ isActive: true })
      .where(eq(tournaments.id, numericId))
      .returning();

    if (!updated.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated[0]);
  } catch (err: any) {
    console.error("PUT /api/tournaments/[id]/activate failed:", err);
    return NextResponse.json(
      { error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

