import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function pickDisplayName(user) {
  const meta = user.user_metadata || {};
  return (
    meta.display_name ||
    meta.full_name ||
    meta.name ||
    (user.email ? user.email.split("@")[0] : null) ||
    "Player"
  );
}

function pickAvatar(user) {
  const meta = user.user_metadata || {};
  return meta.avatar_url || meta.picture || null;
}

async function listAllUsers() {
  const perPage = 1000; // max supported by Admin API
  let page = 1;
  let all = [];

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw error;

    const users = data?.users ?? [];
    all = all.concat(users);

    console.log(`Fetched page ${page}: ${users.length} users (total so far: ${all.length})`);

    if (users.length < perPage) break;
    page += 1;
  }

  return all;
}

async function upsertProfiles(users) {
  const rows = users.map((u) => ({
    user_id: u.id,
    display_name: pickDisplayName(u),
    avatar_url: pickAvatar(u),
  }));

  // Batch upserts to avoid large payloads
  const batchSize = 200;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    const { error } = await supabase
      .from("profiles")
      .upsert(batch, { onConflict: "user_id" });

    if (error) throw error;

    console.log(`Upserted profiles ${i + 1}-${Math.min(i + batchSize, rows.length)} of ${rows.length}`);
  }
}

async function main() {
  console.log("Starting profile backfill...");
  const users = await listAllUsers();

  if (!users.length) {
    console.log("No users found in auth. Nothing to do.");
    return;
  }

  console.log(`Total auth users: ${users.length}`);
  await upsertProfiles(users);

  console.log("✅ Done. Go check the profiles table in Supabase.");
  console.log("Next: refresh your leaderboard — names should appear.");
}

main().catch((err) => {
  console.error("❌ Backfill failed:", err);
  process.exit(1);
});
