import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { isAdminEmail } from "@/lib/admin";

type Body = {
  pickId?: string;
  chosenWinner?: "team1" | "team2";
};

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token;
}

function getAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const authClient = getAuthClient();
    if (!authClient) {
      return NextResponse.json({ error: "Supabase auth client not configured" }, { status: 500 });
    }

    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const authRes = await authClient.auth.getUser(token);
    const authUser = authRes.data.user;

    if (authRes.error || !authUser) {
      return NextResponse.json({ error: authRes.error?.message ?? "Unauthorized" }, { status: 401 });
    }

    if (!isAdminEmail(authUser.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const pickId = (body.pickId ?? "").trim();
    const chosenWinner = body.chosenWinner;

    if (!pickId || (chosenWinner !== "team1" && chosenWinner !== "team2")) {
      return NextResponse.json(
        { error: "pickId and chosenWinner(team1|team2) are required" },
        { status: 400 }
      );
    }

    const rows = (await db.execute(sql`
      UPDATE public.picks
      SET chosen_winner = ${chosenWinner}
      WHERE id::text = ${pickId}
      RETURNING id, chosen_winner
    `)) as Array<{ id: string | number; chosen_winner: "team1" | "team2" }>;

    if (!Array.isArray(rows) || !rows[0]) {
      return NextResponse.json({ error: "Pick not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, pick: rows[0] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
