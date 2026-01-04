// scripts/runMigrations.ts
import "dotenv/config";

import { db, client } from "../db/client";
import { sql } from "drizzle-orm";

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Unknown error";
}

async function main() {
  try {
    console.log("Running display_name backfill + NOT NULL constraint...");

    // 1) Backfill display_name for existing users
    await db.execute(sql`
      UPDATE users
      SET display_name = split_part(email, '@', 1)
      WHERE display_name IS NULL;
    `);

    // 2) Enforce NOT NULL on display_name
    await db.execute(sql`
      ALTER TABLE users
      ALTER COLUMN display_name SET NOT NULL;
    `);

    console.log("✅ users.display_name migration completed successfully");
  } catch (e: unknown) {
    console.error("❌ Migration error:", errorMessage(e));
    if (e instanceof Error) console.error(e);
    process.exitCode = 1;
  } finally {
    // Close the DB client if your db/client exports one
    if (client) {
      await client.end();
    }
  }
}

void main();
