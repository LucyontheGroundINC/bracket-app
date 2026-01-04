// app/api/scores/recalc/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  // For now, leaderboard is calculated live from matches + picks.
  // This endpoint exists just so the Admin "Recalculate" button doesn't error.
  return NextResponse.json({ ok: true, note: "Recalc is handled live now." });
}
