#!/usr/bin/env tsx
/**
 * Discover public contact forms on creator websites (scrape.txt §20).
 * Targets channels with a website and no has_contact_form yet.
 * Never submits forms.
 *
 *   npm run enrich:forms -- --limit 100
 */

import { loadEnv } from "./lib/env";
loadEnv();

import { createClient } from "@supabase/supabase-js";
import { findPublicEmailFromWebsite } from "./lib/link-email";

function parseArgs(argv: string[]) {
  const args = { limit: 100, offset: 0, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit" && argv[i + 1]) args.limit = Math.max(1, parseInt(argv[++i], 10) || 100);
    else if (a === "--offset" && argv[i + 1]) args.offset = Math.max(0, parseInt(argv[++i], 10) || 0);
    else if (a === "--dry-run") args.dryRun = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from("channels")
    .select("id, title, website")
    .not("website", "is", null)
    .or("has_contact_form.is.null,has_contact_form.eq.false")
    .is("contact_form_checked_at", null)
    .order("subscriber_count", { ascending: false, nullsFirst: false })
    .range(args.offset, args.offset + args.limit - 1);

  if (error) {
    // Column may not exist yet — fall back to website-only sample
    if (/has_contact_form|contact_form|schema cache/i.test(error.message)) {
      console.warn("Run migration 013_contact_form.sql first:", error.message);
      process.exit(1);
    }
    throw new Error(error.message);
  }

  const rows = data ?? [];
  console.log(`[enrich:forms] ${rows.length} channels dryRun=${args.dryRun}`);
  let found = 0;
  let checked = 0;

  for (const ch of rows) {
    if (!ch.website) continue;
    checked++;
    try {
      const result = await findPublicEmailFromWebsite(ch.website, { maxPages: 8 });
      const now = new Date().toISOString();
      const form = result.contactForm;
      const patch: Record<string, unknown> = {
        contact_form_checked_at: now,
        website_robots_allowed: result.robots.anyAllowed,
        website_robots_checked_at: now,
        updated_at: now,
      };
      if (form?.found && form.pageUrl) {
        patch.has_contact_form = true;
        patch.contact_form_url = form.pageUrl;
        patch.contact_form_purpose = form.purpose;
        patch.contact_form_has_captcha = form.hasCaptcha;
        found++;
        console.log(`  form ${ch.title}: ${form.pageUrl} (${form.purpose})`);
      } else {
        patch.has_contact_form = false;
        console.log(
          `  none ${ch.title}` +
            (result.robots.blockedPages
              ? ` (robots blocked ${result.robots.blockedPages} paths)`
              : "")
        );
      }
      if (!args.dryRun) {
        const { error: upErr } = await supabase.from("channels").update(patch).eq("id", ch.id);
        if (upErr) console.warn(`  update failed: ${upErr.message}`);
      }
    } catch (err) {
      console.warn(`  skip ${ch.title}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[enrich:forms] done checked=${checked} forms=${found}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
