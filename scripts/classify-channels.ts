#!/usr/bin/env tsx
/**
 * Backfill niche + country confidence on existing channels.
 *   npm run classify:channels
 *   npm run classify:channels -- --limit 500
 *   npm run classify:channels -- --force   (reclassify all)
 */
import { loadEnv } from "./lib/env";
loadEnv();

import { createClient } from "@supabase/supabase-js";
import { withChannelClassification } from "../src/lib/classify";

function parseArgs(argv: string[]) {
  let limit = 2000;
  let force = false;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--limit" && argv[i + 1]) {
      limit = Math.max(1, parseInt(argv[++i]!, 10) || 2000);
    } else if (argv[i] === "--force") {
      force = true;
    } else if (argv[i] === "--dry-run") {
      dryRun = true;
    }
  }
  return { limit, force, dryRun };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key);

  console.log(
    `[classify] limit=${args.limit} force=${args.force} dryRun=${args.dryRun}`
  );

  let query = supabase
    .from("channels")
    .select(
      "id, title, description, country, website, category, primary_niche"
    )
    .order("last_updated", { ascending: false })
    .limit(args.limit);

  if (!args.force) {
    query = query.is("primary_niche", null);
  }

  const { data, error } = await query;
  if (error) {
    if (/primary_niche|schema cache/i.test(error.message)) {
      console.error(
        "Run supabase/migrations/016_niche_country_confidence.sql in the SQL Editor first."
      );
    }
    throw new Error(error.message);
  }

  const rows = data ?? [];
  console.log(`Fetched ${rows.length} channel(s)`);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const classified = withChannelClassification({
      title: row.title,
      description: row.description,
      country: row.country,
      website: row.website,
      category: row.category,
    });

    if (!classified.primary_niche && classified.country_confidence === "unknown") {
      skipped++;
      continue;
    }

    if (args.dryRun) {
      console.log(
        `  ${row.id} → niche=${classified.primary_niche} (${classified.niche_confidence}) country=${classified.country_confidence}`
      );
      updated++;
      continue;
    }

    const { error: upErr } = await supabase
      .from("channels")
      .update({
        primary_niche: classified.primary_niche,
        niche_confidence: classified.niche_confidence,
        niche_method: classified.niche_method,
        niche_evidence: classified.niche_evidence,
        niche_classified_at: classified.niche_classified_at,
        category: classified.category,
        country_confidence: classified.country_confidence,
        country_evidence: classified.country_evidence,
        country_classified_at: classified.country_classified_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (upErr) {
      console.warn(`  fail ${row.id}:`, upErr.message);
      continue;
    }
    updated++;
  }

  console.log(`Done. updated=${updated} skipped_empty=${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
