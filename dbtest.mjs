// dbtest.mjs
import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("DATABASE_URL is missing");
  process.exit(1);
}

const u = new URL(raw);

const pool = new Pool({
  host: u.hostname,
  port: Number(u.port || 5432),
  database: u.pathname.replace(/^\//, ""),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  ssl: { rejectUnauthorized: false },
});

const r = await pool.query("select now()");
console.log("DB time:", r.rows[0]);
await pool.end();



