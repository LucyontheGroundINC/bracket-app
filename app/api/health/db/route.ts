import { NextResponse } from "next/server";
import { pool } from "@/db";

export async function GET() {
  try {
    const { rows } = await pool.query("select now() as now");
    return NextResponse.json({ ok: true, now: rows[0].now });
  } catch (e: any) {
    console.error("[/api/health/db] pool error:", e?.message);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}

