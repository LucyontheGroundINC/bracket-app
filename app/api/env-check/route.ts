import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeHost(urlString: string | undefined) {
  if (!urlString) return null;

  try {
    const u = new URL(urlString);
    return {
      host: u.host,         // hostname:port
      hostname: u.hostname, // hostname only
      port: u.port || null,
      user: u.username || null,
      hasPassword: !!u.password,
      db: u.pathname,
      hasSslMode: u.searchParams.has("sslmode"),
    };
  } catch {
    return { rawPrefix: urlString.slice(0, 50) + "..." };
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    DATABASE_URL: safeHost(process.env.DATABASE_URL),
  });
}
