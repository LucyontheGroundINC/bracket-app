import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const raw = process.env.DATABASE_URL;

  if (!raw) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL missing" }, { status: 500 });
  }

  const trimmed = raw.trim();

  let parsed: any = null;
  try {
    const u = new URL(trimmed);
    parsed = {
      protocol: u.protocol,
      host: u.host,
      hostname: u.hostname,
      port: u.port || null,
      hasUsername: !!u.username,
      hasPassword: !!u.password,
      pathname: u.pathname,
      rawLen: raw.length,
      trimmedLen: trimmed.length,
      hadWhitespace: raw.length !== trimmed.length,
    };
  } catch (e) {
    parsed = {
      error: "DATABASE_URL is not a valid URL",
      rawLen: raw.length,
      trimmedLen: trimmed.length,
      hadWhitespace: raw.length !== trimmed.length,
      startsWith: trimmed.slice(0, 40),
    };
  }

  return NextResponse.json({ ok: true, parsed });
}
