// app/api/brackets/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { brackets } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    // Minimal select (matches your UI expectations)
    const rows = await db
      .select({
        id: brackets.id,
        name: brackets.name,
        tournamentId: brackets.tournamentId,
        totalPoints: brackets.totalPoints,
      })
      .from(brackets)
      .where(eq(brackets.userId, userId));

    // rows can be [], and that's OK
    return NextResponse.json(rows, { status: 200 });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown DB error";

    console.error("[/api/brackets] DB error:", message, e);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}


