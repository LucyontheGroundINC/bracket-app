// scripts/runMigrations.ts
require("dotenv/config");

const { db, client } = require("../db/client");
const { sql } = require("drizzle-orm");

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
  } catch (err) {
    console.error("❌ Migration error:", err);
    console.error(err);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

main();
