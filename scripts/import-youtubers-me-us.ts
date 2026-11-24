#!/usr/bin/env tsx
/**
 * Import YouTubers.me US Top 1000 → YouTube IDs → channels table.
 * Source: https://us.youtubers.me/united-states/all/top-1000-youtube-channels-in-united-states
 *
 *   npm run import:youtubers-me-us
 *   npm run import:youtubers-me-us -- --limit 200
 *   npm run import:youtubers-me-us -- --max-search 40
 *   npm run import:youtubers-me-us -- --dry-run
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { loadEnv } from "./lib/env";
loadEnv();

import { createClient } from "@supabase/supabase-js";
import {
  isMissingClassificationColumnError,
  stripClassificationFields,
  withChannelClassification,
} from "../src/lib/classify";
import {
  isMissingMetricsColumnError,
  stripYoutubeMetricsFields,
  withYoutubeMetricsExpiry,
} from "../src/lib/youtube-metrics";

interface ListEntry {
  rank: number;
  name: string;
  slug: string;
}

interface ListFile {
  source: string;
  channels: ListEntry[];
}

function parseArgs(argv: string[]) {
  let limit = 1000;
  let dryRun = false;
  let maxSearch = 40;
  let skipSearch = false;
  let offset = 0;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--limit" && argv[i + 1]) {
      limit = Math.max(1, parseInt(argv[++i]!, 10) || 1000);
    } else if (argv[i] === "--offset" && argv[i + 1]) {
      offset = Math.max(0, parseInt(argv[++i]!, 10) || 0);
    } else if (argv[i] === "--max-search" && argv[i + 1]) {
      maxSearch = Math.max(0, parseInt(argv[++i]!, 10) || 40);
    } else if (argv[i] === "--dry-run") dryRun = true;
    else if (argv[i] === "--skip-search") skipSearch = true;
  }
  return { limit, offset, dryRun, maxSearch, skipSearch };
}

function slugToHandleGuesses(slug: string, name: string): string[] {
  const out: string[] = [];
  const parts = slug.split("-").filter(Boolean);
  // mrbeast → MrBeast; kids-diana-show → KidsDianaShow
  const pascal = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
  const compact = parts.join("");
  const camel = parts
    .map((p, i) =>
      i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
    )
    .join("");
  out.push(pascal, compact, camel, slug.replace(/-/g, ""));

  const cleanName = name
    .replace(/[✿★]/g, "")
    .replace(/\([^)]*\)/g, "")
    .trim();
  const nameCompact = cleanName.replace(/[^A-Za-z0-9]+/g, "");
  if (nameCompact.length >= 3) out.push(nameCompact);

  // Known slug → handle aliases
  const ALIAS: Record<string, string> = {
    "abckidtv-nursery-rhymes": "Cocomelon",
    mrbeast: "MrBeast",
    "kids-diana-show": "KidsDianaShow",
    "toys-and-colors": "ToysandColors",
    wwe: "WWE",
    movieclips: "Movieclips",
    "ryan-toysreview": "RyansWorld",
    "alan-chikin-chow": "AlansUniverse",
    "pinkfong-kids-songs-stories": "BabySharkOfficial",
    markiplierGAME: "markiplier",
  };
  if (ALIAS[slug]) out.unshift(ALIAS[slug]!);

  return Array.from(
    new Set(out.map((h) => h.replace(/^@/, "")).filter((h) => h.length >= 3 && h.length <= 30))
  );
}

async function youtubeGet<T>(
  path: string,
  params: Record<string, string>
): Promise<T> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY missing");
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key);
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(
      `YouTube ${path} ${res.status}: ${body?.error?.message || res.statusText}`
    );
  }
  return body as T;
}

async function resolveByHandle(handle: string) {
  const data = await youtubeGet<{
    items?: Array<{
      id: string;
      snippet?: { title?: string; customUrl?: string };
    }>;
  }>("channels", { part: "id,snippet", forHandle: handle });
  const item = data.items?.[0];
  if (!item) return null;
  const custom = item.snippet?.customUrl;
  return {
    id: item.id,
    title: item.snippet?.title || handle,
    handle: custom
      ? custom.startsWith("@")
        ? custom
        : `@${custom}`
      : `@${handle}`,
  };
}

async function resolveBySearch(q: string) {
  const data = await youtubeGet<{
    items?: Array<{
      id?: { channelId?: string };
      snippet?: { channelId?: string; title?: string };
    }>;
  }>("search", {
    part: "snippet",
    type: "channel",
    maxResults: "1",
    q,
  });
  const item = data.items?.[0];
  const id = item?.id?.channelId || item?.snippet?.channelId;
  if (!id) return null;
  const details = await youtubeGet<{
    items?: Array<{
      id: string;
      snippet?: { title?: string; customUrl?: string };
    }>;
  }>("channels", { part: "snippet", id });
  const ch = details.items?.[0];
  const custom = ch?.snippet?.customUrl;
  return {
    id,
    title: ch?.snippet?.title || item?.snippet?.title || q,
    handle: custom
      ? custom.startsWith("@")
        ? custom
        : `@${custom}`
      : null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const listPath = resolve(
    process.cwd(),
    "data/youtubers-me-us-top1000.json"
  );
  const list = JSON.parse(readFileSync(listPath, "utf8")) as ListFile;
  const slice = list.channels.slice(args.offset, args.offset + args.limit);
  console.log(
    `[youtubers.me US] resolving ${slice.length} (offset=${args.offset}, forHandle first, search≤${args.maxSearch})`
  );
  console.log(`Source: ${list.source}`);

  const resolved: Array<{
    id: string;
    title: string;
    handle: string | null;
    name: string;
    via: string;
  }> = [];
  let searchUsed = 0;
  let failed = 0;

  for (const entry of slice) {
    let hit: { id: string; title: string; handle: string | null } | null = null;
    let via = "";
    for (const guess of slugToHandleGuesses(entry.slug, entry.name)) {
      try {
        hit = await resolveByHandle(guess);
        if (hit) {
          via = `forHandle:${guess}`;
          break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/quotaExceeded|dailyLimitExceeded/i.test(msg)) throw err;
      }
    }
    if (!hit && !args.skipSearch && searchUsed < args.maxSearch) {
      try {
        hit = await resolveBySearch(entry.name);
        searchUsed++;
        via = "search";
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/quotaExceeded|dailyLimitExceeded/i.test(msg)) throw err;
        // Google also caps Search Queries per day separately — stop burning attempts
        if (/Search Queries|Queries per day/i.test(msg)) {
          console.warn(
            `  search quota hit — disabling further search.list calls (${msg.slice(0, 120)})`
          );
          args.skipSearch = true;
        } else {
          console.warn(`  search fail "${entry.name}":`, msg);
        }
      }
    }
    if (!hit) {
      failed++;
      console.log(`  ✗ #${entry.rank} ${entry.name}`);
      continue;
    }
    resolved.push({ ...hit, name: entry.name, via });
    console.log(`  ✓ #${entry.rank} ${hit.id}  ${hit.title}  (${via})`);
  }

  console.log(
    `\nResolved ${resolved.length}/${slice.length} (search=${searchUsed}, failed=${failed})`
  );
  if (args.dryRun || resolved.length === 0) return;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const ids = resolved.map((r) => r.id);
  const byId = new Map(resolved.map((r) => [r.id, r]));
  let upserted = 0;

  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const data = await youtubeGet<{
      items?: Array<{
        id: string;
        snippet?: {
          title?: string;
          description?: string;
          customUrl?: string;
          publishedAt?: string;
          country?: string;
          thumbnails?: { medium?: { url: string }; default?: { url: string } };
        };
        statistics?: {
          subscriberCount?: string;
          viewCount?: string;
          videoCount?: string;
        };
      }>;
    }>("channels", {
      part: "snippet,statistics",
      id: batch.join(","),
    });

    const now = new Date().toISOString();
    for (const item of data.items ?? []) {
      const meta = byId.get(item.id);
      const custom = item.snippet?.customUrl;
      const handle = custom
        ? custom.startsWith("@")
          ? custom
          : `@${custom}`
        : meta?.handle ?? null;
      const payload = withYoutubeMetricsExpiry(
        withChannelClassification(
          {
            id: item.id,
            handle,
            title: item.snippet?.title || meta?.title || "Unknown",
            description: item.snippet?.description || null,
            thumbnail_url:
              item.snippet?.thumbnails?.medium?.url ??
              item.snippet?.thumbnails?.default?.url ??
              null,
            subscriber_count: item.statistics?.subscriberCount
              ? parseInt(item.statistics.subscriberCount, 10)
              : null,
            view_count: item.statistics?.viewCount
              ? parseInt(item.statistics.viewCount, 10)
              : 0,
            video_count: item.statistics?.videoCount
              ? parseInt(item.statistics.videoCount, 10)
              : 0,
            country: item.snippet?.country ?? "US",
            published_at: item.snippet?.publishedAt ?? null,
            data_source: "api",
            last_updated: now,
            updated_at: now,
          },
          now
        ),
        now
      );

      let { error } = await supabase
        .from("channels")
        .upsert(payload, { onConflict: "id" });
      if (error && isMissingMetricsColumnError(error.message)) {
        ({ error } = await supabase
          .from("channels")
          .upsert(stripYoutubeMetricsFields(payload), { onConflict: "id" }));
      }
      if (error && isMissingClassificationColumnError(error.message)) {
        ({ error } = await supabase.from("channels").upsert(
          stripClassificationFields(stripYoutubeMetricsFields(payload)),
          { onConflict: "id" }
        ));
      }
      if (error) {
        console.warn(`  upsert ${item.id}:`, error.message);
        continue;
      }
      upserted++;
    }
  }

  console.log(`Upserted ${upserted} channels into library.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
