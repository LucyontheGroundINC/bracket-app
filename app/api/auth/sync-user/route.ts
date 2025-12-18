// app/api/auth/sync-user/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SyncUserBody = {
  id: string;
  email: string;
  displayName?: string | null;
};

export async function GET() {
  return NextResponse.json({ ok: true, route: "sync-user" });
}

export async function POST(req: Request) {
  try {
    await db.execute(sql`select 1`);

    const body = (await req.json()) as SyncUserBody;

    const id = body.id?.trim();
    const email = body.email?.trim();

    if (!id || !email) {
      return NextResponse.json(
        { ok: false, error: "Missing id or email" },
        { status: 400 }
      );
    }

    // ✅ Always provide a displayName to satisfy your Drizzle insert types
    // Priority: request body displayName -> auth metadata displayName -> email prefix
    const cleaned =
      body.displayName != null ? body.displayName.trim() : "";

    const fallbackFromEmail = email.split("@")[0] || "Player";
    const finalDisplayName = cleaned.length ? cleaned : fallbackFromEmail;

    await db
      .insert(users)
      .values({
        id,
        email,
        displayName: finalDisplayName,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email,
          displayName: finalDisplayName,
        },
      });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[sync-user] error:", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
