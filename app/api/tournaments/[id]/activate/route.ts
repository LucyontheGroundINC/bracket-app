export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { tournaments } from "@/db/schema";
import { eq } from "drizzle-orm";

type TournamentDTO = {
  id: number;
  name: string;
  year: number | null;
  isActive: boolean | null;
  createdAt: string | null;
  isLockedManual: boolean | null;
  lockAt: string | null;
};

function toDto(row: unknown): TournamentDTO {
  const r = row as {
    id: number;
    name: string;
    year?: number | null;
    isActive?: boolean | null;
    createdAt?: string | Date | null;
    isLockedManual?: boolean | null;
    lockAt?: string | Date | null;
  };

  return {
    id: r.id,
    name: r.name,
    year: r.year ?? null,
    isActive: r.isActive ?? null,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
    isLockedManual: r.isLockedManual ?? null,
    lockAt: r.lockAt ? new Date(r.lockAt).toISOString() : null,
  };
}


// PUT /api/tournaments/:id/activate
export async function PUT(
  _req: Request,
  ctx: { params: Promise<{ id: string }> } // Next 15 params are async
) {
  try {
    const { id } = await ctx.params;
    const tournamentId = Number(id);

    if (!Number.isFinite(tournamentId)) {
      return NextResponse.json({ error: "Invalid tournament id" }, { status: 400 });
    }

    // Optional: verify tournament exists
    const existing = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId));

    if (!existing.length) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    // Make all inactive, then set selected active.
    // Use a transaction if your db client supports it.
    await db.transaction(async (tx) => {
      await tx.update(tournaments).set({ isActive: false });
      await tx.update(tournaments).set({ isActive: true }).where(eq(tournaments.id, tournamentId));
    });

    const updated = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId));

    return NextResponse.json(updated[0] ? toDto(updated[0]) : null, {
      status: 200,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
} catch (e: unknown) {
  const message =
    e instanceof Error
      ? e.message
      : typeof e === "string"
      ? e
      : "Unknown error";

  return NextResponse.json(
    { error: message },
    { status: 500 }
  );
}

}
