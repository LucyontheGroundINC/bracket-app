import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeParse(url?: string) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return {
      host: u.host,
      hostname: u.hostname,
      port: u.port,
      user: u.username,
      hasPassword: !!u.password,
      db: u.pathname,
      sslmode: u.searchParams.get("sslmode"),
    };
  } catch (e) {
    return { parseError: true, valueStartsWith: url.slice(0, 40) };
  }
}

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL;
  const poolerUrl = process.env.DATABASE_URL_POOLER;

  return NextResponse.json(
    {
      ok: true,
      marker: "env-check-v2",
      now: new Date().toISOString(),
      DATABASE_URL: safeParse(databaseUrl),
      DATABASE_URL_POOLER: safeParse(poolerUrl),
      using:
        poolerUrl?.includes("pooler.supabase.com")
          ? "DATABASE_URL_POOLER"
          : "DATABASE_URL",
    },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    }
  );
}
