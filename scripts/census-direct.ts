#!/usr/bin/env tsx
/**
 * Direct census check: read the next TubeCensus channel IDs, look them up with
 * channels.list (1 unit per 50 IDs), and insert only channels that could pass
 * the quality gate for USA & Europe buyers. Nothing is written for rejected IDs;
 * the cursor in Storage guarantees each census line is read once.
 *
 *   npm run census:direct -- --limit 250000 --max-units 5000
 *   npm run census:direct -- --limit 2000 --dry-run
 *
 * Kept: >= --min-subs subscribers (default 5000), >= 3 videos, >= 3,000 lifetime
 * average views per video (--min-lifetime-avg), and a channel
 * country in the US/UK/CA/AU/Europe tiers or no country set (soft keep, same
 * rule as the quality gate).
 */
import { loadEnv } from "./lib/env";
loadEnv();

import { createClient } from "@supabase/supabase-js";
import { fetchCensusIds } from "./lib/census-source";
import { QuotaError, buildChannelPayload, channelCounts, youtubeGet, type ChannelItem } from "./lib/channel-payload";
import { MICRO_MAX_SUBS, locationTier } from "../src/lib/quality-gate";

const argv = process.argv.slice(2);
function numberArg(name: string, fallback: number) {
  const i = argv.indexOf(name);
  if (i < 0) return fallback;
  const value = Number(argv[i + 1]);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${name}`);
  return value;
}

const BUCKET = "discovery-state";
const KEY = "tubecensus-cursor.json";
const CHUNK = 10_000; // census lines per download + checkpoint

interface Cursor {
  nextOffset: number;
  /** Running total of census IDs looked up on YouTube ("channels analyzed"). */
  checkedTotal?: number;
  updated_at?: string;
}

async function main() {
  const dry = argv.includes("--dry-run");
  const limit = numberArg("--limit", 250_000);
  const maxUnits = numberArg("--max-units", 5000);
  const minSubs = numberArg("--min-subs", 5000);
  const minVideos = numberArg("--min-videos", 3);
  // Lifetime views ÷ videos (free in channels.list). Under 3,000 almost nobody
  // clears the recent-views floor: 0.8% of passing creators vs 19% of failures.
  const minLifetimeAvg = numberArg("--min-lifetime-avg", 3000);
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: saved, error: readErr } = await db.storage.from(BUCKET).download(KEY);
  if (readErr && !/not found/i.test(readErr.message)) throw readErr;
  const cursor: Cursor = saved ? JSON.parse(await saved.text()) : { nextOffset: 0 };
  if (!Number.isSafeInteger(cursor.nextOffset) || cursor.nextOffset < 0) throw new Error("Invalid saved cursor");
  const startOffset = cursor.nextOffset;
  console.log(`[census:direct] from line ${startOffset}, up to ${limit} IDs / ${maxUnits} units${dry ? " (dry run)" : ""}`);

  let units = 0;
  let checked = 0;
  let kept = 0;
  let inserted = 0;
  let small = 0;
  let outside = 0;
  let dead = 0;
  let quotaHit = false;

  const insert = async (rows: Record<string, unknown>[]) => {
    if (dry || !rows.length) return;
    for (let attempt = 1; ; attempt++) {
      const { data, error } = await db
        .from("channels")
        .upsert(rows, { onConflict: "id", ignoreDuplicates: true })
        .select("id");
      if (!error) {
        inserted += data?.length ?? 0;
        return;
      }
      if (attempt >= 3 || !/statement timeout|fetch failed|terminated/i.test(error.message)) {
        throw new Error(`channels insert failed: ${error.message}`);
      }
      await new Promise((r) => setTimeout(r, attempt * 5000));
    }
  };

  try {
    while (checked < limit && units < maxUnits) {
      const want = Math.min(CHUNK, limit - checked);
      const ids = await fetchCensusIds(cursor.nextOffset, want);
      if (!ids.length) break;

      let used = 0; // census lines fully processed in this chunk
      for (let i = 0; i < ids.length; i += 50) {
        if (units >= maxUnits) break;
        const batch = ids.slice(i, i + 50);
        let res: { items?: ChannelItem[] };
        try {
          res = await youtubeGet<{ items?: ChannelItem[] }>("channels", {
            part: "snippet,statistics,topicDetails",
            id: batch.join(","),
            maxResults: "50",
          });
        } catch (err) {
          if (!(err instanceof QuotaError)) throw err;
          quotaHit = true; // save the progress made in this chunk, then stop
          console.warn(`Quota exhausted: ${err.message}`);
          break;
        }
        units++;
        const now = new Date().toISOString();
        const rows: Record<string, unknown>[] = [];
        for (const item of res.items ?? []) {
          const { subs, videos, views } = channelCounts(item);
          // Small channels pass on 1,500 recent views, so their lifetime floor is lower.
          const lifetimeFloor = subs < MICRO_MAX_SUBS ? Math.min(minLifetimeAvg, 800) : minLifetimeAvg;
          if (subs < minSubs || videos < minVideos || views / Math.max(videos, 1) < lifetimeFloor) {
            small++;
            continue;
          }
          if (locationTier(item.snippet?.country) === "other") {
            outside++;
            continue;
          }
          rows.push(buildChannelPayload(item, now));
        }
        dead += batch.length - (res.items?.length ?? 0);
        kept += rows.length;
        await insert(rows);
        used += batch.length;
        checked += batch.length;
      }

      cursor.nextOffset += used;
      cursor.checkedTotal = (cursor.checkedTotal ?? 0) + used;
      cursor.updated_at = new Date().toISOString();
      if (!dry) {
        const up = await db.storage
          .from(BUCKET)
          .upload(KEY, JSON.stringify(cursor), { upsert: true, contentType: "application/json" });
        if (up.error) throw up.error;
      }
      console.log(`  checked ${checked} · kept ${kept} · small ${small} · outside US/EU ${outside} · dead ${dead} · ~${units}u`);
      if (quotaHit || used < ids.length) break; // stopped mid-chunk (unit cap or quota)
    }
  } catch (err) {
    if (!(err instanceof QuotaError)) throw err;
    quotaHit = true;
    console.warn(`Quota exhausted: ${err.message}`);
  }

  console.log("\nDirect census summary");
  console.log("---------------------");
  console.log(`IDs checked     ${checked} (lines ${startOffset}–${cursor.nextOffset})`);
  console.log(`kept            ${kept} (inserted ${inserted}, rest already saved)`);
  console.log(`too small       ${small} (< ${minSubs} subs, < ${minVideos} videos or < ${minLifetimeAvg} lifetime avg views)`);
  console.log(`outside US/EU   ${outside}`);
  console.log(`dead/hidden     ${dead}`);
  console.log(`units used      ~${units}`);
  console.log(`analyzed total  ${cursor.checkedTotal ?? 0}`);
  if (quotaHit) console.log("Stopped early: YouTube quota hit.");
  if (dry) console.log("DRY RUN: no database or cursor writes.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
