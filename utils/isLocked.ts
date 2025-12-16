import { db } from "@/db/client";
import { tournaments } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function isTournamentLocked(tournamentId: number) {
  const [t] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  if (!t) return false;

  if (t.isLockedManual) return true;
  if (t.lockAt && new Date() >= new Date(t.lockAt)) return true;

  return false;
}
