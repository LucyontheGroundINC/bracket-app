import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { tournaments } from "@/db/schema";

// GET  →  list all tournaments
export async function GET() {
  try {
    const rows = await db.select().from(tournaments).orderBy(tournaments.id);
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: String(e.message) }, { status: 500 });
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
  } catch (e: any) {
    return NextResponse.json({ error: String(e.message) }, { status: 500 });
  }
}
