#!/usr/bin/env tsx
/**
 * Refresh basic YouTube statistics (subscribers, views, video count, title,
 * thumbnail) for the channels whose metrics are oldest. channels.list costs
 * 1 unit per 50 channels, so ~8,000 channels/day ≈ 160 units and the whole
 * library is refreshed about every 30 days (metrics_expires_at = +30d).
 *
 * Never deletes rows and never touches emails, niches or quality scores.
 * Channels YouTube no longer returns are marked not sellable
 * (quality_pass=false, reason "channel_unavailable").
 *
 *   npm run refresh:stats -- --limit 8000
 *   npm run refresh:stats -- --limit 200 --dry-run
 */
import { loadEnv } from "./lib/env";
loadEnv();

import { createClient } from "@supabase/supabase-js";
import { classifyTier } from "../src/lib/scoring";
import { youtubeMetricsExpiry } from "../src/lib/youtube-metrics";

const API = "https://www.googleapis.com/youtube/v3";
const PAGE = 1000;
const WRITE_CONCURRENCY = 10;

function parseArgs(argv: string[]) {
  let limit = 8000;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--limit" && argv[i + 1]) limit = Math.max(1, parseInt(argv[++i]!, 10) || 8000);
    else if (argv[i] === "--dry-run") dryRun = true;
  }
  return { limit, dryRun };
}

function apiKey(): string {
  const key =
    (process.env.YOUTUBE_API_KEY || "").trim() ||
    (process.env.YOUTUBE_API_KEYS || "").split(",").map((s) => s.trim()).find(Boolean) ||
    "";
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  return key;
}

interface Row {
  id: string;
  quality_pass: boolean | null;
  quality_fail_reasons: string[] | null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Oldest metrics first. Rows get a fresh metrics_expires_at as we go, so
  // collect the whole batch before writing to keep paging stable.
  const rows: Row[] = [];
  for (let from = 0; rows.length < args.limit; from += PAGE) {
    const want = Math.min(PAGE, args.limit - rows.length);
    const { data, error } = await db
      .from("channels")
      .select("id, quality_pass, quality_fail_reasons")
      .order("metrics_expires_at", { ascending: true, nullsFirst: true })
      .order("id")
      .range(from, from + want - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < want) break;
  }
  console.log(`[refresh:stats] ${rows.length} channels with the oldest metrics · dryRun=${args.dryRun}`);

  let units = 0;
  let refreshed = 0;
  let unavailable = 0;
  let quotaHit = false;
  const now = new Date().toISOString();
  const expiry = youtubeMetricsExpiry(now);

  for (let i = 0; i < rows.length && !quotaHit; i += 50) {
    const batch = rows.slice(i, i + 50);
    const qs = new URLSearchParams({
      part: "snippet,statistics",
      id: batch.map((r) => r.id).join(","),
      maxResults: "50",
      key: apiKey(),
    });
    const res = await fetch(`${API}/channels?${qs}`);
    units++;
    if (res.status === 403 && /quota/i.test(await res.clone().text())) {
      console.log("\n  ⏹ quota exhausted — stopping early");
      quotaHit = true;
      break;
    }
    if (!res.ok) {
      console.warn(`\n  channels.list ${res.status} — skipping batch`);
      continue;
    }
    const data = await res.json();
    const byId = new Map<string, any>((data.items ?? []).map((it: any) => [it.id, it]));

    const writes = batch.map((row) => async () => {
      const item = byId.get(row.id);
      if (!item) {
        unavailable++;
        if (args.dryRun) return;
        const reasons = Array.from(new Set([...(row.quality_fail_reasons ?? []), "channel_unavailable"]));
        await db
          .from("channels")
          .update({ quality_pass: false, quality_fail_reasons: reasons, ...expiry, updated_at: now })
          .eq("id", row.id);
        return;
      }
      const subs = item.statistics?.subscriberCount != null ? Number(item.statistics.subscriberCount) : null;
      const views = Number(item.statistics?.viewCount ?? 0);
      const videos = Number(item.statistics?.videoCount ?? 0);
      const patch: Record<string, unknown> = {
        title: item.snippet?.title || undefined,
        thumbnail_url:
          item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? undefined,
        view_count: views,
        video_count: videos,
        avg_views_per_video: videos > 0 ? Math.round(views / videos) : 0,
        ...expiry,
        last_updated: now,
        updated_at: now,
      };
      if (subs != null) {
        patch.subscriber_count = subs;
        patch.tier = subs > 0 ? classifyTier(subs) : null;
      }
      if (item.snippet?.country) patch.country = item.snippet.country;
      Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

      refreshed++;
      if (args.dryRun) return;
      const { error } = await db.from("channels").update(patch).eq("id", row.id);
      if (error) {
        refreshed--;
        console.warn(`\n  update ${row.id}: ${error.message}`);
        return;
      }
      // Growth history for sellable creators only (keeps storage small).
      if (row.quality_pass && subs != null) {
        await db.from("channel_analytics").insert({
          channel_id: row.id,
          subscriber_count: subs,
          view_count: views,
          video_count: videos,
        });
      }
    });

    for (let w = 0; w < writes.length; w += WRITE_CONCURRENCY) {
      await Promise.all(writes.slice(w, w + WRITE_CONCURRENCY).map((fn) => fn()));
    }
    process.stdout.write(`\r  refreshed ${refreshed}, unavailable ${unavailable}, ~${units} units`);
  }

  console.log(
    `\n[refresh:stats] done · refreshed=${refreshed} unavailable=${unavailable} units=${units}` +
      (args.dryRun ? "  (dry run)" : "")
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
