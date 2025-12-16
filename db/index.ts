// db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
const { Pool } = pg;

const raw = process.env.DATABASE_URL;
if (!raw) throw new Error("DATABASE_URL is missing");

// Parse the URL and pass fields explicitly, ignoring query params like sslmode
const u = new URL(raw);

const pool = new Pool({
  host: u.hostname,
  port: Number(u.port || 5432),
  database: u.pathname.replace(/^\//, ""),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  // Force TLS but DO NOT verify certificate (fixes “self-signed certificate in chain”)
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool);
export { pool };


