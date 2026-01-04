export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { teams } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/teams?tournamentId=1
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tid = searchParams.get("tournamentId");

    // If tournamentId is provided, filter by it
    if (tid != null && tid !== "") {
      const tournamentId = Number(tid);
      if (!Number.isFinite(tournamentId)) {
        return NextResponse.json(
          { error: "tournamentId must be a number" },
          { status: 400 }
        );
      }

      const rows = await db
        .select()
        .from(teams)
        .where(eq(teams.tournamentId, tournamentId));

      // Server log (remove later if you want)
      console.log("GET /api/teams", {
        tournamentId,
        count: rows.length,
      });

      return NextResponse.json(rows, {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    // Otherwise return all teams
    const rows = await db.select().from(teams);

    console.log("GET /api/teams (all)", { count: rows.length });

    return NextResponse.json(rows, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
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

// POST /api/teams  → create team(s)
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Bulk insert: { tournamentId, teams: [{name, seed?}, ...] }
    if (Array.isArray(body?.teams) && body?.tournamentId != null) {
      const tournamentId = Number(body.tournamentId);
      if (!Number.isFinite(tournamentId)) {
        return NextResponse.json(
          { error: "tournamentId must be a number" },
          { status: 400 }
        );
      }

      const values = (body.teams as Array<{ name: string; seed?: number | null }>)
        .filter((t) => t?.name && typeof t.name === "string")
        .map((t) => ({
          name: t.name.trim(),
          seed: t.seed ?? null,
          tournamentId,
        }));

      if (values.length === 0) {
        return NextResponse.json(
          { error: "No valid teams provided" },
          { status: 400 }
        );
      }

      const inserted = await db.insert(teams).values(values).returning();

      return NextResponse.json(inserted, {
        status: 201,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    // Single insert: { name, seed?, tournamentId }
    if (!body?.name || body?.tournamentId == null) {
      return NextResponse.json(
        { error: "Required: name, tournamentId" },
        { status: 400 }
      );
    }

    const tournamentId = Number(body.tournamentId);
    if (!Number.isFinite(tournamentId)) {
      return NextResponse.json(
        { error: "tournamentId must be a number" },
        { status: 400 }
      );
    }

    const [row] = await db
      .insert(teams)
      .values({
        name: String(body.name).trim(),
        seed: body.seed ?? null,
        tournamentId,
      })
      .returning();

    return NextResponse.json(row, {
      status: 201,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
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
