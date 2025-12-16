import { NextResponse } from "next/server";
import { db } from "../../../db/client";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cur = await db.execute(sql`select current_schema() as schema, current_user as db_user`);
    const tables = await db.execute(sql`
      select table_schema, table_name
      from information_schema.tables
      where table_schema in ('public','auth')
      order by 1,2
    `);
    return NextResponse.json({ ok: true, cur, tables });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
