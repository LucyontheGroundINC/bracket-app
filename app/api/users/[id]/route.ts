// app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/users/:id
export async function GET(_req: NextRequest, context: any) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing id" },
        { status: 400 }
      );
    }

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!rows.length) {
      return NextResponse.json(
        { ok: false, error: "Not found" },
        { status: 404 }
      );
    }

    const u = rows[0];

    return NextResponse.json({
      ok: true,
      user: {
        id: u.id,
        email: u.email,
        displayName: u.displayName ?? null,
        avatarUrl: u.avatarUrl ?? null,
        createdAt: u.createdAt ?? null,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}

// PUT /api/users/:id
// Used by EditProfileCard to update displayName/avatarUrl
export async function PUT(req: NextRequest, context: any) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing id" },
        { status: 400 }
      );
    }

    const body = (await req.json()) as Partial<{
      displayName: string | null;
      avatarUrl: string | null;
    }>;

    const patch: any = {};
    if (body.displayName !== undefined) patch.displayName = body.displayName;
    if (body.avatarUrl !== undefined) patch.avatarUrl = body.avatarUrl;

    if (!Object.keys(patch).length) {
      return NextResponse.json(
        { ok: false, error: "No fields to update" },
        { status: 400 }
      );
    }

    const updated = await db
      .update(users)
      .set(patch)
      .where(eq(users.id, id))
      .returning();

    if (!updated.length) {
      return NextResponse.json(
        { ok: false, error: "Not found" },
        { status: 404 }
      );
    }

    const u = updated[0];

    return NextResponse.json({
      ok: true,
      user: {
        id: u.id,
        email: u.email,
        displayName: u.displayName ?? null,
        avatarUrl: u.avatarUrl ?? null,
        createdAt: u.createdAt ?? null,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
