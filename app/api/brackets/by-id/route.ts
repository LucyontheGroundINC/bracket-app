// app/api/brackets/by-id/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { brackets } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

type BracketRow = typeof brackets.$inferSelect;

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Unknown error";
}

/**
 * GET /api/brackets/by-id?id=123
 * Returns a single bracket row (404 if not found)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    const id = Number(idParam);

    if (!idParam || !Number.isFinite(id)) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const rows: BracketRow[] = await db
      .select()
      .from(brackets)
      .where(eq(brackets.id, id))
      .limit(1);

    const row = rows[0] ?? null;

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(row);
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
