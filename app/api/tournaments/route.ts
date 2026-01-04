// app/api/tournaments/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { tournaments } from "@/db/schema";
import { desc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TournamentDTO = {
  id: number;
  name: string;
  year: number | null;
  isActive: boolean | null;
  createdAt: string | null;
  isLockedManual: boolean | null;
  lockAt: string | null;
};

type TournamentRow = {
  id: number;
  name: string;
  year?: number | null;
  isActive?: boolean | null;
  createdAt?: string | Date | null;
  isLockedManual?: boolean | null;
  lockAt?: string | Date | null;
};

function toDto(row: unknown): TournamentDTO {
  const r = row as TournamentRow;

  return {
    id: r.id,
    name: r.name,
    year: r.year ?? null,
    isActive: r.isActive ?? null,
    createdAt: r.createdAt
      ? new Date(r.createdAt).toISOString()
      : null,
    isLockedManual: r.isLockedManual ?? null,
    lockAt: r.lockAt
      ? new Date(r.lockAt).toISOString()
      : null,
  };
}
;
// GET /api/tournaments  -> returns list (TournamentDTO[])
export async function GET() {
  try {
    const rows = await db.select().from(tournaments).orderBy(desc(tournaments.id));
    return NextResponse.json(rows.map(toDto));
} catch (e: unknown) {
  console.error(
    "[tournaments] error:",
    e instanceof Error ? e.message : e
  );
}

}

// POST /api/tournaments -> create tournament
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name?: string; year?: number | null };

    const name = (body?.name ?? "").trim();
    const year = body?.year ?? null;

    if (!name) {
      return NextResponse.json({ error: "Missing tournament name" }, { status: 400 });
    }

    // NOTE: if your DB column is NOT NULL for year, you must supply a year.
    // Your information_schema output showed year is NOT NULL.
    if (year == null) {
      return NextResponse.json(
        { error: "Missing year (required)" },
        { status: 400 }
      );
    }

    const created = await db
      .insert(tournaments)
      .values({
        name,
        year,
        // rely on DB defaults for isActive/isLockedManual/createdAt unless you want to set explicitly
      })
      .returning();

    const row = created?.[0];
    return NextResponse.json(row ? toDto(row) : null);
 } catch (e: unknown) {
  console.error(
    "[tournaments] error:",
    e instanceof Error ? e.message : e
  );
}

}
