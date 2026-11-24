#!/usr/bin/env tsx
/**
 * Backfill email_validation_status for channels that already have email.
 * Syntax + disposable + MX (scrape.txt §19). 0 YouTube quota.
 *
 *   npm run validate:emails
 *   npm run validate:emails -- --limit 200 --dry-run
 */

import { loadEnv } from "./lib/env";
loadEnv();

import { createClient } from "@supabase/supabase-js";
import { validatePublicEmail } from "./lib/email-validate";

function parseArgs(argv: string[]) {
  const args = { limit: 200, offset: 0, dryRun: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit" && argv[i + 1]) args.limit = Math.max(1, parseInt(argv[++i], 10) || 200);
    else if (a === "--offset" && argv[i + 1]) args.offset = Math.max(0, parseInt(argv[++i], 10) || 0);
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--force") args.force = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  const supabase = createClient(url, key);

  let query = supabase
    .from("channels")
    .select("id, title, email, email_validation_status")
    .not("email", "is", null)
    .order("subscriber_count", { ascending: false, nullsFirst: false });

  if (!args.force) {
    query = query.is("email_validation_status", null);
  }

  const { data, error } = await query.range(args.offset, args.offset + args.limit - 1);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  console.log(`[validate:emails] ${rows.length} channels (force=${args.force} dryRun=${args.dryRun})`);

  const counts: Record<string, number> = {};
  let updated = 0;

  for (const ch of rows) {
    if (!ch.email) continue;
    const result = await validatePublicEmail(ch.email, {
      hasPublicSource: true,
      checkMx: true,
    });
    counts[result.status] = (counts[result.status] || 0) + 1;
    console.log(`  ${ch.title}: ${ch.email} → ${result.status} (${result.reason})`);

    if (!args.dryRun) {
      const { error: upErr } = await supabase
        .from("channels")
        .update({
          email: result.normalized ?? ch.email,
          email_validation_status: result.status,
          email_is_role: result.isRole,
          email_validated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", ch.id);
      if (upErr) {
        console.warn(`  update failed: ${upErr.message}`);
      } else {
        updated++;
      }
    }
  }

  console.log(`[validate:emails] done updated=${updated} byStatus=${JSON.stringify(counts)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
