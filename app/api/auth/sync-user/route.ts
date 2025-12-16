import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { sql } from "drizzle-orm";

// force Node runtime (postgres driver doesn't work on Edge)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, route: "sync-user" });
}

export async function POST(req: Request) {
  try {
    // DB connectivity sanity check
    await db.execute(sql`select 1`);

    const body = (await req.json()) as {
      id?: string | null;
      email?: string | null;
      displayName?: string | null;
    };

    const id = body.id ?? "";
    const email = body.email ?? "";

    if (!id || !email) {
      return NextResponse.json(
        { ok: false, error: "Missing id or email" },
        { status: 400 }
      );
    }

    // ALWAYS provide a string to satisfy Drizzle's insert typings
    const safeDisplayName =
      (body.displayName ?? "").trim() ||
      email.split("@")[0] ||
      "Player";

    await db
      .insert(users)
      .values({
        id,
        email,
        displayName: safeDisplayName,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email,
          displayName: safeDisplayName,
        },
      });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const detail =
      e?.cause?.message ||
      e?.cause?.detail ||
      e?.message ||
      String(e);
    console.error("[sync-user] error:", e);
    return NextResponse.json({ ok: false, error: detail }, { status: 500 });
  }
}
