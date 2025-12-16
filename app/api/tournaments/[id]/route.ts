// app/api/tournaments/[id]/route.ts
export const runtime = "nodejs"; // keep Node runtime for DB clients

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { tournaments } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/tournaments/:id
export async function GET(_req: NextRequest, context: any) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);

    if (Number.isNaN(numericId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, numericId))
      .limit(1);

    if (!rows.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (err: any) {
    console.error("GET /api/tournaments/[id] failed:", err);
    return NextResponse.json(
      { error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

// PUT /api/tournaments/:id
// Body can include: name, isLockedManual, lockAt (ISO string)
export async function PUT(req: NextRequest, context: any) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);

    if (Number.isNaN(numericId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = (await req.json()) as Partial<{
      name: string;
      isLockedManual: boolean | null;
      lockAt: string | null; // ISO string
    }>;

    const patch: any = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.isLockedManual !== undefined)
      patch.isLockedManual = body.isLockedManual;
    if (body.lockAt !== undefined)
      patch.lockAt = body.lockAt ? new Date(body.lockAt) : null;

    if (!Object.keys(patch).length) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const updated = await db
      .update(tournaments)
      .set(patch)
      .where(eq(tournaments.id, numericId))
      .returning();

    if (!updated.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated[0]);
  } catch (err: any) {
    console.error("PUT /api/tournaments/[id] failed:", err);
    return NextResponse.json(
      { error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

