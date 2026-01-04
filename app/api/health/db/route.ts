import { NextResponse } from "next/server";
import { pool } from "@/db";

export async function GET() {
  try {
    const { rows } = await pool.query("select now() as now");
    return NextResponse.json({ ok: true, now: rows[0].now });
} catch (e: unknown) {
  let message = "Unknown error";

  if (e instanceof Error) {
    message = e.message;
  } else if (typeof e === "string") {
    message = e;
  }

  return NextResponse.json(
    { error: message },
    { status: 500 }
  );
}

}

