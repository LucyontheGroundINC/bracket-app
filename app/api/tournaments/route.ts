import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { tournaments } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET  →  list all tournaments
export async function GET() {
  try {
    const rows = await db.select().from(tournaments).orderBy(tournaments.id);
    return NextResponse.json(rows);
  } catch (e: unknown) {
    const err = e as any;
    console.error("[tournaments GET] error:", err);

    return NextResponse.json(
      {
        ok: false,
        marker: "tournaments-v2",
        message: err?.message ?? String(err),
        code: err?.code ?? null,
        detail: err?.cause?.detail ?? null,
        cause: err?.cause?.message ?? err?.cause ?? null,
      },
      { status: 500 }
    );
  }
}

// POST  →  create a new tournament
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const [newTournament] = await db
      .insert(tournaments)
      .values({
        name: body.name,
        year: body.year,
      })
      .returning();

    return NextResponse.json(newTournament);
  } catch (e: unknown) {
    const err = e as any;
    console.error("[tournaments POST] error:", err);

    return NextResponse.json(
      {
        ok: false,
        marker: "tournaments-post-v2",
        message: err?.message ?? String(err),
        code: err?.code ?? null,
        detail: err?.cause?.detail ?? null,
        cause: err?.cause?.message ?? err?.cause ?? null,
      },
      { status: 500 }
    );
  }
}
