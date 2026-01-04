// app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

type RouteContext = { params: { id: string } };

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Unknown error";
}

// GET /api/users/:id
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = context.params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing id" },
        { status: 400 }
      );
    }

    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);

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
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: errorMessage(e) },
      { status: 500 }
    );
  }
}

// PUT /api/users/:id
// Used by EditProfileCard to update displayName/avatarUrl
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { id } = context.params;

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

    // NOTE: Drizzle will error if you try to set null on non-null columns.
    // So: null => "" (clear), undefined => "don't touch"
    const patch: Partial<typeof users.$inferInsert> = {};

    if (body.displayName !== undefined) {
      patch.displayName = body.displayName ?? "";
    }

    if (body.avatarUrl !== undefined) {
      patch.avatarUrl = body.avatarUrl ?? "";
    }

    if (Object.keys(patch).length === 0) {
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
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: errorMessage(e) },
      { status: 500 }
    );
  }
}

