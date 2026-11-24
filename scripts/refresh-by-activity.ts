#!/usr/bin/env tsx
/**
 * Activity-tiered refresh (one-pager cadence):
 *   hot (upload ≤30d)  → every 2 weeks
 *   warm (≤60d)        → monthly
 *   cold (>60d)        → flag inactive, skip until new upload
 *
 *   npm run refresh:activity -- --limit 40
 *   npm run refresh:activity -- --force-cold --limit 10
 */
import { loadEnv } from "./lib/env";
loadEnv();

import { createClient } from "@supabase/supabase-js";
import { getChannelDetails, mapYouTubeChannelToDb } from "../src/lib/youtube";
import { withYoutubeMetricsExpiry } from "../src/lib/youtube-metrics";
import { scoreChannelById } from "./lib/score-activity";
import {
  isMissingQualityColumnError,
  stripQualityFields,
} from "../src/lib/quality-gate";

function parseArgs(argv: string[]) {
  let limit = 40;
  let dryRun = false;
  let forceCold = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit" && argv[i + 1])
      limit = Math.max(1, parseInt(argv[++i]!, 10) || 40);
    else if (a === "--dry-run") dryRun = true;
    else if (a === "--force-cold") forceCold = true;
  }
  return { limit, dryRun, forceCold };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date().toISOString();
  let query = supabase
    .from("channels")
    .select("id, title, is_inactive, next_refresh_at, activity_bucket")
    .order("next_refresh_at", { ascending: true, nullsFirst: true })
    .limit(args.limit);

  if (!args.forceCold) {
    query = query.or("is_inactive.is.null,is_inactive.eq.false");
  }

  // Due for refresh: next_refresh_at null or past
  query = query.or(`next_refresh_at.is.null,next_refresh_at.lte.${now}`);

  let { data, error } = await query;
  if (error && /next_refresh_at|is_inactive|activity_bucket/i.test(error.message)) {
    console.warn("Migration 019 missing — falling back to oldest last_updated.");
    ({ data, error } = await supabase
      .from("channels")
      .select("id, title")
      .order("last_updated", { ascending: true })
      .limit(args.limit));
  }
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  console.log(`[refresh:activity] ${rows.length} due (limit=${args.limit})`);
  if (!rows.length) return;

  if (args.dryRun) {
    for (const r of rows.slice(0, 20)) {
      console.log(`  ${r.title} (${r.id}) bucket=${(r as { activity_bucket?: string }).activity_bucket ?? "?"}`);
    }
    return;
  }

  const ids = rows.map((r) => r.id);
  const details = await getChannelDetails(ids);
  let updated = 0;

  for (const item of details) {
    const mapped = mapYouTubeChannelToDb(item);
    let patch: Record<string, unknown> = {};
    try {
      const { dbFields } = await scoreChannelById(mapped.id, {
        country: mapped.country,
        subscriberCount: mapped.subscriber_count,
      });
      patch = dbFields;
    } catch (err) {
      console.warn(
        `  score ${mapped.id}:`,
        err instanceof Error ? err.message : err
      );
    }

    const row = withYoutubeMetricsExpiry(
      {
        ...mapped,
        ...patch,
        last_updated: now,
        updated_at: now,
      },
      now
    );
    let { error: upErr } = await supabase
      .from("channels")
      .upsert(row, { onConflict: "id" });
    if (upErr && isMissingQualityColumnError(upErr.message)) {
      ({ error: upErr } = await supabase
        .from("channels")
        .upsert(stripQualityFields(row), { onConflict: "id" }));
    }
    if (upErr) console.warn(`  upsert ${mapped.id}:`, upErr.message);
    else {
      updated++;
      console.log(
        `  ✓ ${mapped.title} bucket=${patch.activity_bucket} inactive=${patch.is_inactive}`
      );
    }
  }

  console.log(`\nRefreshed ${updated}/${ids.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
