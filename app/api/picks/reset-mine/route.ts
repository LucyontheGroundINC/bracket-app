import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

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

    const uid = authUser.id;

    const rows = (await db.execute(sql`
      DELETE FROM public.picks
      WHERE user_id = ${uid}
      RETURNING id
    `)) as Array<{ id: string | number }>;

    return NextResponse.json({ ok: true, deleted: Array.isArray(rows) ? rows.length : 0 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
