#!/usr/bin/env tsx
/**
 * Backfill niche + country confidence on existing channels (0 YouTube quota).
 * Uses the channel title/description plus the titles and tags of the last-5
 * videos stored by quality scoring (recent_videos), which classifies far more
 * channels than the bio alone.
 *
 *   npm run classify:channels
 *   npm run classify:channels -- --pass-only          (quality-pass creators only)
 *   npm run classify:channels -- --limit 500
 *   npm run classify:channels -- --force              (reclassify all)
 *   npm run classify:channels -- --dry-run
 */
import { loadEnv } from "./lib/env";
loadEnv();

import { createClient } from "@supabase/supabase-js";
import { withChannelClassification } from "../src/lib/classify";

// recent_videos is a large JSON column; bigger pages hit the statement timeout.
const PAGE = 100;

function parseArgs(argv: string[]) {
  let limit = Number.POSITIVE_INFINITY;
  let force = false;
  let dryRun = false;
  let passOnly = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--limit" && argv[i + 1]) {
      limit = Math.max(1, parseInt(argv[++i]!, 10) || 2000);
    } else if (argv[i] === "--force") {
      force = true;
    } else if (argv[i] === "--dry-run") {
      dryRun = true;
    } else if (argv[i] === "--pass-only") {
      passOnly = true;
    }
  }
  return { limit, force, dryRun, passOnly };
}

interface RecentVideo {
  title?: string | null;
  tags?: string[] | null;
}

/** Last-5 video titles + tags as extra classification text. */
function videoText(recent: unknown): string {
  if (!Array.isArray(recent)) return "";
  return (recent as RecentVideo[])
    .map((v) => [v?.title ?? "", ...(Array.isArray(v?.tags) ? v.tags : [])].join(" "))
    .join(" ");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log(
    `[classify] limit=${args.limit} force=${args.force} passOnly=${args.passOnly} dryRun=${args.dryRun}`
  );

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let usedVideos = 0;
  const byNiche: Record<string, number> = {};
  // Keyset paging on id: rows we can't classify stay null, so offset/limit
  // without a cursor would re-fetch the same unclassifiable rows forever.
  let lastId = "";

  while (processed < args.limit) {
    let query = supabase
      .from("channels")
      .select("id, title, description, country, website, category, primary_niche, recent_videos, topic_categories")
      .gt("id", lastId)
      .order("id")
      .limit(Math.min(PAGE, args.limit - processed));
    if (!args.force) query = query.is("primary_niche", null);
    if (args.passOnly) query = query.eq("quality_pass", true);

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
    if (rows.length === 0) break;
    lastId = rows[rows.length - 1]!.id;

    for (const row of rows) {
      processed++;
      const extra = videoText(row.recent_videos);
      const classified = withChannelClassification({
        title: row.title,
        description: extra ? `${row.description ?? ""}\n${extra}` : row.description,
        country: row.country,
        website: row.website,
        category: row.category,
        topic_categories: row.topic_categories,
      });
      const hasTopics = Array.isArray(row.topic_categories) && row.topic_categories.length > 0;

      if (!classified.primary_niche && !hasTopics && classified.country_confidence === "unknown") {
        skipped++;
        continue;
      }
      if (classified.primary_niche) {
        byNiche[classified.primary_niche] = (byNiche[classified.primary_niche] ?? 0) + 1;
        if (extra) usedVideos++;
      }

      if (args.dryRun) {
        updated++;
        continue;
      }

      const patch: Record<string, unknown> = {
        country_confidence: classified.country_confidence,
        country_evidence: classified.country_evidence,
        country_classified_at: classified.country_classified_at,
        updated_at: new Date().toISOString(),
      };
      // Never replace an existing niche with "no niche" on keywords alone; with
      // YouTube topics we trust a "none of our niches" answer and clear it.
      if (classified.primary_niche || (hasTopics && row.primary_niche)) {
        Object.assign(patch, {
          primary_niche: classified.primary_niche,
          niche_confidence: classified.niche_confidence,
          niche_method: classified.primary_niche && extra ? `${classified.niche_method}+videos` : classified.niche_method,
          niche_evidence: classified.niche_evidence,
          niche_classified_at: classified.niche_classified_at,
          category: classified.category,
        });
      }

      const { error: upErr } = await supabase.from("channels").update(patch).eq("id", row.id);
      if (upErr) {
        console.warn(`  fail ${row.id}:`, upErr.message);
        continue;
      }
      updated++;
    }
    process.stdout.write(`\r  processed ${processed}, updated ${updated}`);
  }

  const nicheTotal = Object.values(byNiche).reduce((a, b) => a + b, 0);
  console.log(
    `\nDone. processed=${processed} updated=${updated} skipped_empty=${skipped} ` +
      `niche_found=${nicheTotal} (via videos ${usedVideos})${args.dryRun ? "  (dry run)" : ""}`
  );
  console.log("  by niche:", JSON.stringify(byNiche));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
