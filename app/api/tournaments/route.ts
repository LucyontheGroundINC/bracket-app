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

function toDto(row: any): TournamentDTO {
  return {
    id: row.id,
    name: row.name,
    year: row.year ?? null,
    isActive: row.isActive ?? null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    isLockedManual: row.isLockedManual ?? null,
    lockAt: row.lockAt ? new Date(row.lockAt).toISOString() : null,
  };
}

// GET /api/tournaments  -> returns list (TournamentDTO[])
export async function GET() {
  try {
    const rows = await db.select().from(tournaments).orderBy(desc(tournaments.id));
    return NextResponse.json(rows.map(toDto));
  } catch (e: unknown) {
    const err = e as any;
    console.error("[tournaments] error:", err);

    return NextResponse.json(
      {
        ok: false,
        marker: "tournaments-v2",
        message: err?.message ?? String(err),
        code: err?.code ?? null,
        detail: err?.detail ?? null,
        hint: err?.hint ?? null,
        cause: err?.cause?.message ?? err?.cause ?? null,
      },
      { status: 500 }
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
    const err = e as any;
    console.error("[tournaments POST] error:", err);

    return NextResponse.json(
      {
        ok: false,
        marker: "tournaments-post-v2",
        message: err?.message ?? String(err),
        code: err?.code ?? null,
        detail: err?.detail ?? null,
        hint: err?.hint ?? null,
        cause: err?.cause?.message ?? err?.cause ?? null,
      },
      { status: 500 }
    );
  }
}
