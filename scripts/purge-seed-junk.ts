#!/usr/bin/env tsx
/**
 * Delete channel_seed rows that will never be revisited: dead, too-small
 * (skipped), or confirmed quality_failed. These exist purely so the
 * validator/scorer never re-spend quota re-checking the same id -- keeping
 * their full row costs storage for no benefit once that memory has served
 * its purpose. Safe to run daily; batched to avoid huge single requests.
 *
 *   npm run seeds:purge
 *   npm run seeds:purge -- --batch 1000
 */
import { loadEnv } from "./lib/env";
loadEnv();
import { createClient } from "@supabase/supabase-js";

function parseArgs(argv: string[]) {
  let batch = 500;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--batch" && argv[i + 1]) {
      batch = Math.max(50, parseInt(argv[++i]!, 10) || 500);
    }
  }
  return { batch };
}

const PURGEABLE_STATUSES = ["dead", "skipped", "quality_failed"];

async function main() {
  const { batch } = parseArgs(process.argv.slice(2));
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { count: before } = await supabase
    .from("channel_seed")
    .select("*", { count: "exact", head: true })
    .in("status", PURGEABLE_STATUSES);
  console.log(`[seeds:purge] ${before ?? 0} purgeable rows (dead/skipped/quality_failed)`);

  let totalDeleted = 0;
  for (;;) {
    const { data: rows, error: selErr } = await supabase
      .from("channel_seed")
      .select("seed_key")
      .in("status", PURGEABLE_STATUSES)
      .limit(batch);

    if (selErr) {
      console.error("select error:", selErr.message);
      break;
    }
    if (!rows || rows.length === 0) break;

    const keys = rows.map((r) => r.seed_key);
    const { error: delErr } = await supabase
      .from("channel_seed")
      .delete()
      .in("seed_key", keys);

    if (delErr) {
      console.error("delete error:", delErr.message);
      break;
    }
    totalDeleted += keys.length;
  }

  const { count: remaining } = await supabase
    .from("channel_seed")
    .select("*", { count: "exact", head: true });

  console.log(`[seeds:purge] deleted ${totalDeleted}. channel_seed rows remaining: ${remaining}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
