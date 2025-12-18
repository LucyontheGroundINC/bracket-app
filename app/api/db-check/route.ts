// app/api/db-check/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await db.execute(
      sql`select current_schema() as schema, current_user as db_user`
    );

    return NextResponse.json({ ok: true, result });
  } catch (e: unknown) {
    const err = e as any;

    // IMPORTANT: log full object so Vercel logs show the real reason
    console.error("[db-check] error:", err);

    return NextResponse.json(
      {
        ok: false,
        message: err?.message ?? String(err),
        cause: err?.cause?.message ?? err?.cause ?? null,
        code: err?.code ?? null,
        name: err?.name ?? null,
      },
      { status: 500 }
    );
  }
}
