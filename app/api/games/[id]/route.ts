import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { picks, games, teams } from "@/db/schema";

import { eq } from 'drizzle-orm';


// GET /api/games/:id
export async function GET(_req: NextRequest, context: any) {
  try {
    const { id } = await context.params;
    const bracketId = Number(id);

    if (Number.isNaN(bracketId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

     // 👉 Replace this block with whatever you currently do:
    // For example, something like:
    const rows = await db
      .select()
      .from(picks)
      .where(eq(picks.bracketId, bracketId));

    if (!rows.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}

// PUT /api/games/:id
// Body can include: round, gameIndex, teamAId, teamBId, winnerId
export async function PUT(req: NextRequest, context: any) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);

    if (Number.isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const body = (await req.json()) as Partial<{
      round: number;
      gameIndex: number;
      teamAId: number | null;
      teamBId: number | null;
      winnerId: number | null;
    }>;

    const patch: any = {};
    if (body.round !== undefined) patch.round = Number(body.round);
    if (body.gameIndex !== undefined) patch.gameIndex = Number(body.gameIndex);
    if (body.teamAId !== undefined) patch.teamAId = body.teamAId ?? null;
    if (body.teamBId !== undefined) patch.teamBId = body.teamBId ?? null;
    if (body.winnerId !== undefined) patch.winnerId = body.winnerId ?? null;

    if (!Object.keys(patch).length) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const updated = await db
      .update(games)
      .set(patch)
      .where(eq(games.id, numericId))
      .returning();

    if (!updated.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(updated[0]);
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}

// DELETE /api/games/:id
export async function DELETE(_req: NextRequest, context: any) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);

    if (Number.isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const del = await db
      .delete(games)
      .where(eq(games.id, numericId))
      .returning();

    if (!del.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id: numericId });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
