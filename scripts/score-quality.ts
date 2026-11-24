#!/usr/bin/env tsx
/**
 * Backfill last-5 quality scores on existing library (soft — no deletes).
 *
 * Quota model (per channel):
 *   playlistItems.list  1 unit each   (unavoidable — one playlist per call)
 *   videos.list         1 unit / 50 video ids, SHARED across channels
 *   → ~1.1 units/channel when grouped 10 channels at a time (was 2.0)
 *
 * Plus a free pre-filter (0 units) that skips channels that cannot pass.
 *
 *   npm run quality:db                                   # existing library
 *   npm run score:quality -- --all-countries --max-units 9000
 *   npm run score:quality -- --limit 5000 --all-countries
 *   npm run score:quality -- --country US --rescore
 *   npm run score:quality -- --all-countries --refresh-pass --refresh-days 30
 *   npm run score:quality -- --all-countries --min-subs 10000
 *   npm run score:quality -- --no-prefilter
 *   npm run score:quality -- --min-lifetime-views 500
 *   npm run score:quality -- --dry-run
 */
import { loadEnv } from "./lib/env";
loadEnv();

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  scoreChannelsBatched,
  QuotaExhaustedError,
  keyPoolSize,
  type BatchScoreInput,
} from "./lib/score-activity";
import {
  isMissingQualityColumnError,
  locationTier,
} from "../src/lib/quality-gate";

interface Row {
  id: string;
  title: string;
  country: string | null;
  subscriber_count: number | null;
  view_count: number | null;
  video_count: number | null;
  primary_niche: string | null;
}

function parseArgs(argv: string[]) {
  let limit = 50;
  let country: string | null = "US";
  let unscoredOnly = true;
  let dryRun = false;
  let maxUnits = 9000;
  let videosPerChannel = 5;
  let prefilter = true;
  let minLifetimeViews = 0; // 0 = disabled (lossy filter, opt-in)
  let refreshPass = false;
  let refreshDays = 30;
  let minSubs = 0;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit" && argv[i + 1])
      limit = Math.max(1, parseInt(argv[++i]!, 10) || 50);
    else if (a === "--country" && argv[i + 1]) country = argv[++i]!.toUpperCase();
    else if (a === "--all-countries") country = null;
    else if (a === "--rescore") unscoredOnly = false;
    else if (a === "--refresh-pass") {
      // Re-check passing creators whose score is older than --refresh-days, oldest first
      refreshPass = true;
      unscoredOnly = false;
    } else if (a === "--min-subs" && argv[i + 1])
      // Skip small channels: below ~10k subs almost none become sellable leads
      minSubs = Math.max(0, parseInt(argv[++i]!, 10) || 0);
    else if (a === "--refresh-days" && argv[i + 1])
      refreshDays = Math.max(1, parseInt(argv[++i]!, 10) || 30);
    else if (a === "--max-units" && argv[i + 1])
      maxUnits = Math.max(11, parseInt(argv[++i]!, 10) || 9000);
    else if (a === "--videos" && argv[i + 1])
      videosPerChannel = Math.max(3, Math.min(10, parseInt(argv[++i]!, 10) || 5));
    else if (a === "--no-prefilter") prefilter = false;
    else if (a === "--min-lifetime-views" && argv[i + 1])
      minLifetimeViews = Math.max(0, parseInt(argv[++i]!, 10) || 0);
    else if (a === "--dry-run") dryRun = true;
  }
  return {
    limit,
    country,
    unscoredOnly,
    dryRun,
    maxUnits,
    videosPerChannel,
    prefilter,
    minLifetimeViews,
    refreshPass,
    refreshDays,
    minSubs,
  };
}

/**
 * Zero-quota pre-filter. Only rejects on conditions that make a pass
 * mathematically impossible, so there are no false negatives:
 *   - fewer total uploads than the gate's minimum recent videos
 *   - a country that is explicitly outside tier1/tier2 (blank stays in)
 * `--min-lifetime-views` adds an optional lossy heuristic on top.
 */
function preFilterReason(
  row: Row,
  opts: { videosRequired: number; minLifetimeViews: number }
): string | null {
  if ((row.video_count ?? 0) < opts.videosRequired) return "prefilter_few_videos";
  if (row.country && locationTier(row.country) === "other")
    return "prefilter_location";
  if (opts.minLifetimeViews > 0 && row.video_count && row.view_count) {
    const lifetimeAvg = row.view_count / row.video_count;
    if (lifetimeAvg < opts.minLifetimeViews) return "prefilter_low_views";
  }
  return null;
}

/**
 * Mark definitive fails without deleting them: stamp quality_pass=false and
 * the fail reasons directly on the `channels` row, same as a passing
 * channel gets its fields updated. This is the dataset's actual product —
 * failed channels stay visible/filterable (e.g. as a lower tier) instead of
 * being discarded. quality_scored_at being set is what stops the
 * scorer/validator from re-spending quota on it, no separate seed marker
 * needed.
 */
async function markFailed(
  supabase: SupabaseClient,
  ids: string[],
  reasons: Map<string, string[]> | string[] | string
) {
  const now = new Date().toISOString();
  const reasonsFor = (id: string): string[] => {
    if (typeof reasons === "string") return [reasons];
    if (Array.isArray(reasons)) return reasons;
    return reasons.get(id) ?? [];
  };
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300);

    const groups = new Map<string, string[]>();
    for (const id of chunk) {
      const key = JSON.stringify(reasonsFor(id));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(id);
    }

    for (const [key, groupIds] of groups) {
      const { error } = await supabase
        .from("channels")
        .update({
          quality_scored_at: now,
          quality_pass: false,
          quality_fail_reasons: JSON.parse(key),
        })
        .in("id", groupIds);
      if (error) console.warn(`  mark-failed: ${error.message}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 50 video ids per videos.list call → this many channels share one call
  const GROUP = Math.max(1, Math.floor(50 / args.videosPerChannel));
  const unitsPerGroup = GROUP + 1; // playlistItems × GROUP + 1 videos.list
  const PAGE = 1000; // PostgREST caps a select at ~1000 rows

  let noQualityCol = false;
  let offset = 0;

  const fetchPage = async (want: number): Promise<Row[]> => {
    const base =
      "id, title, country, subscriber_count, view_count, video_count, primary_niche";
    const cols = noQualityCol ? base : `${base}, quality_scored_at`;
    let q = supabase.from("channels").select(cols);
    if (args.refreshPass && !noQualityCol) {
      const cutoff = new Date(Date.now() - args.refreshDays * 86_400_000).toISOString();
      q = q
        .eq("quality_pass", true)
        .lt("quality_scored_at", cutoff)
        .order("quality_scored_at", { ascending: true });
    } else {
      q = q.order("subscriber_count", { ascending: false, nullsFirst: false });
    }
    if (args.minSubs > 0) q = q.gte("subscriber_count", args.minSubs);
    q = q.range(offset, offset + want - 1);
    if (args.country) q = q.eq("country", args.country);
    if (args.unscoredOnly && !noQualityCol) q = q.is("quality_scored_at", null);

    const { data, error } = await q;
    if (error && /quality_scored_at/i.test(error.message)) {
      console.warn("Migration 019 not applied — scoring without filter.");
      noQualityCol = true;
      return fetchPage(want);
    }
    if (error) throw new Error(error.message);
    return (data as unknown as Row[]) ?? [];
  };

  console.log(
    `[score:quality] budget ${args.maxUnits} units · ${GROUP} channels/videos-call ` +
      `· ~${(unitsPerGroup / GROUP).toFixed(2)} units/channel ` +
      `· ≈${Math.floor((args.maxUnits / unitsPerGroup) * GROUP)} channels this run ` +
      `· ${keyPoolSize()} API key(s)`
  );

  let pass = 0;
  let fail = 0;
  let scored = 0;
  let errored = 0;
  let prefiltered = 0;
  let unitsUsed = 0;
  let quotaHit = false;
  let budgetHit = false;

  while (
    !quotaHit &&
    !budgetHit &&
    unitsUsed < args.maxUnits &&
    scored + errored + prefiltered < args.limit
  ) {
    const want = Math.min(
      PAGE,
      args.limit - (scored + errored + prefiltered)
    );
    const rows = await fetchPage(want);
    if (rows.length === 0) break;

    // --- Free pass: drop channels that cannot possibly clear the gate ---
    const survivors: Row[] = [];
    const byReason = new Map<string, string[]>();
    for (const row of rows) {
      const reason = args.prefilter
        ? preFilterReason(row, {
            videosRequired: 3,
            minLifetimeViews: args.minLifetimeViews,
          })
        : null;
      if (reason) {
        if (!byReason.has(reason)) byReason.set(reason, []);
        byReason.get(reason)!.push(row.id);
      } else {
        survivors.push(row);
      }
    }
    for (const [reason, ids] of byReason) {
      prefiltered += ids.length;
      console.log(`  ⊘ ${ids.length} skipped (${reason}) — 0 units`);
      if (!args.dryRun && !noQualityCol) {
        await markFailed(supabase, ids, reason);
      }
    }

    let progressed = 0;

    // --- Paid pass: group channels so videos.list is shared ---
    for (let g = 0; g < survivors.length; g += GROUP) {
      if (unitsUsed + unitsPerGroup > args.maxUnits) {
        console.log(`\nReached --max-units budget (${args.maxUnits}).`);
        budgetHit = true;
        break;
      }
      const group = survivors.slice(g, g + GROUP);
      const inputs: BatchScoreInput[] = group.map((r) => ({
        id: r.id,
        country: r.country,
        subscriberCount: r.subscriber_count,
        primaryNiche: r.primary_niche,
      }));
      const titleById = new Map(group.map((r) => [r.id, r.title]));

      let batch;
      try {
        batch = await scoreChannelsBatched(inputs, args.videosPerChannel);
      } catch (err) {
        if (err instanceof QuotaExhaustedError) {
          quotaHit = true;
          console.warn(`\nYouTube quota exhausted — stopping cleanly.`);
          break;
        }
        throw err;
      }
      unitsUsed += batch.units;

      for (const r of batch.results) {
        const title = titleById.get(r.id) ?? r.id;
        if (r.error || !r.score || !r.dbFields) {
          errored++;
          console.warn(`  skip ${title}: ${r.error ?? "no score"}`);
          if (!args.dryRun && !noQualityCol && args.unscoredOnly) {
            // Keep transient errors unscored so the next run retries them.
            // An API failure must not turn an existing lead into a quality failure.
            await supabase
              .from("channels")
              .update({
                quality_fail_reasons: ["score_error"],
              })
              .eq("id", r.id)
              .is("quality_scored_at", null);
          }
          continue;
        }
        scored++;
        progressed++;
        if (r.score.quality_pass) pass++;
        else fail++;
        process.stdout.write(
          `  ${r.score.quality_pass ? "✓" : "✗"} ${title} avg=${r.score.avg_views_last5} eng=${r.score.engagement_last5 != null ? (r.score.engagement_last5 * 100).toFixed(1) + "%" : "?"} days=${r.score.days_since_upload} ${r.score.quality_fail_reasons.join(",") || "ok"}\n`
        );
        if (args.dryRun) continue;

        // r.dbFields already carries quality_pass/quality_fail_reasons either
        // way (qualityFieldsForDb runs regardless of pass/fail) — failed
        // channels get the same update as passing ones, just kept visible
        // and filterable instead of deleted.
        const { error: up } = await supabase
          .from("channels")
          .update(r.dbFields)
          .eq("id", r.id);
        if (up && isMissingQualityColumnError(up.message)) {
          console.error("Run migration 019_quality_activity_gates.sql first.");
          process.exit(1);
        }
        if (up) console.warn(`  update ${r.id}:`, up.message);
      }
    }

    // In real unscored-only mode processed rows leave the filter, so stay at
    // offset 0; otherwise page forward.
    // Refresh mode also self-consumes: rescored rows get a fresh quality_scored_at.
    const windowSelfConsumes =
      (args.unscoredOnly || args.refreshPass) && !noQualityCol && !args.dryRun;
    if (!windowSelfConsumes || progressed + prefiltered === 0) {
      offset += rows.length;
    }
  }

  const perChannel = scored > 0 ? (unitsUsed / scored).toFixed(2) : "0";
  console.log(
    `\nDone. scored=${scored} pass=${pass} fail=${fail} errored=${errored} ` +
      `prefiltered=${prefiltered} · ${unitsUsed} units (${perChannel}/scored channel)`
  );
  if (quotaHit || budgetHit) {
    console.log(`Re-run to continue scoring the rest of the library.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
