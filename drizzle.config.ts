import type { Config } from "drizzle-kit";

export default {
  schema: "./db/schema.ts",         // path to your Drizzle schema file
  dialect: "postgresql",
  dbCredentials: {
    // this should be your Supabase/Postgres connection string
    // e.g. process.env.DATABASE_URL when running via CLI with env loaded
    url: process.env.DATABASE_URL!,
  },
  out: "./drizzle",                 // folder where migrations will live
} satisfies Config;
