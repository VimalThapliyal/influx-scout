#!/usr/bin/env tsx
/**
 * Import unique channel IDs from videos_main.parquet → YouTube API → channels table.
 * Parquet already has UC IDs; no search.list needed (cheap: ~1 unit / 50 channels).
 *
 * Note: channel_country in the parquet is empty — country is taken from the live API.
 *
 *   npm run import:parquet
 *   npm run import:parquet -- --limit 200
 *   npm run import:parquet -- --dry-run
 *   npm run import:parquet -- --min-subs 10000
 */
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
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

function parseArgs(argv: string[]) {
  let limit = 0; // 0 = all
  let offset = 0;
  let dryRun = false;
  let minSubs = 0;
  let refreshIds = false;
  let parquet = resolve(process.cwd(), "videos_main.parquet");
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--limit" && argv[i + 1]) {
      limit = Math.max(0, parseInt(argv[++i]!, 10) || 0);
    } else if (argv[i] === "--offset" && argv[i + 1]) {
      offset = Math.max(0, parseInt(argv[++i]!, 10) || 0);
    } else if (argv[i] === "--min-subs" && argv[i + 1]) {
      minSubs = Math.max(0, parseInt(argv[++i]!, 10) || 0);
    } else if (argv[i] === "--parquet" && argv[i + 1]) {
      parquet = resolve(process.cwd(), argv[++i]!);
    } else if (argv[i] === "--dry-run") dryRun = true;
    else if (argv[i] === "--refresh-ids") refreshIds = true;
  }
  return { limit, offset, dryRun, minSubs, refreshIds, parquet };
}

function extractChannelIds(
  parquetPath: string,
  cachePath: string,
  refreshIds: boolean
): string[] {
  if (existsSync(cachePath) && !refreshIds) {
    const cached = JSON.parse(readFileSync(cachePath, "utf8")) as {
      channel_ids?: string[];
    };
    if (cached.channel_ids?.length) {
      console.log(
        `[parquet] using cached ${cached.channel_ids.length} IDs from ${cachePath}`
      );
      return cached.channel_ids;
    }
  }

  if (!existsSync(parquetPath)) {
    throw new Error(`Parquet not found: ${parquetPath}`);
  }

  console.log(`[parquet] extracting unique channel_id from ${parquetPath}…`);
  const py = `
import json, sys
import pyarrow.parquet as pq
path = sys.argv[1]
pf = pq.ParquetFile(path)
ids = set()
subs = {}
cols = ['channel_id']
schema = set(pf.schema_arrow.names)
if 'channel_subscriber_count' in schema:
    cols.append('channel_subscriber_count')
for i in range(pf.num_row_groups):
    rg = pf.read_row_group(i, columns=cols)
    cids = rg.column('channel_id').to_pylist()
    scount = (
        rg.column('channel_subscriber_count').to_pylist()
        if 'channel_subscriber_count' in cols else [None]*len(cids)
    )
    for cid, sub in zip(cids, scount):
        if not cid or not str(cid).startswith('UC'):
            continue
        cid = str(cid)
        ids.add(cid)
        if sub is not None:
            try:
                n = int(sub)
            except Exception:
                n = 0
            if cid not in subs or n > subs[cid]:
                subs[cid] = n
# Prefer higher-sub channels first when limiting
ordered = sorted(ids, key=lambda c: (-subs.get(c, 0), c))
print(json.dumps({"channel_ids": ordered, "count": len(ordered)}))
`;
  const out = execFileSync("python3", ["-c", py, parquetPath], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const parsed = JSON.parse(out) as { channel_ids: string[]; count: number };
  mkdirSync(resolve(cachePath, ".."), { recursive: true });
  writeFileSync(
    cachePath,
    JSON.stringify(
      {
        source: parquetPath,
        extracted_at: new Date().toISOString(),
        count: parsed.count,
        channel_ids: parsed.channel_ids,
      },
      null,
      2
    )
  );
  console.log(`[parquet] wrote ${parsed.count} unique IDs → ${cachePath}`);
  return parsed.channel_ids;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cachePath = resolve(process.cwd(), "data/parquet-channel-ids.json");
  let ids = extractChannelIds(args.parquet, cachePath, args.refreshIds);
  if (args.offset) ids = ids.slice(args.offset);
  if (args.limit > 0) ids = ids.slice(0, args.limit);

  console.log(
    `[parquet] importing ${ids.length} channels (offset=${args.offset}, min-subs filter after API=${args.minSubs})`
  );
  if (args.dryRun) {
    console.log("Dry run sample:", ids.slice(0, 10));
    return;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let upserted = 0;
  let skippedSubs = 0;
  let apiItems = 0;

  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    let data: {
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
    };
    try {
      data = await youtubeGet("channels", {
        part: "snippet,statistics",
        id: batch.join(","),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        /quotaExceeded|dailyLimitExceeded|exceeded your[\s\S]*quota/i.test(msg)
      ) {
        console.error(
          `\nYouTube quota exceeded at offset ${args.offset + i}. Resume with:\n  npm run import:parquet -- --offset ${args.offset + i}`
        );
        throw err;
      }
      console.warn(`  batch ${i}:`, msg);
      continue;
    }

    const now = new Date().toISOString();
    for (const item of data.items ?? []) {
      apiItems++;
      const subs = item.statistics?.subscriberCount
        ? parseInt(item.statistics.subscriberCount, 10)
        : null;
      if (args.minSubs > 0 && (subs == null || subs < args.minSubs)) {
        skippedSubs++;
        continue;
      }
      const custom = item.snippet?.customUrl;
      const handle = custom
        ? custom.startsWith("@")
          ? custom
          : `@${custom}`
        : null;
      const payload = withYoutubeMetricsExpiry(
        withChannelClassification(
          {
            id: item.id,
            handle,
            title: item.snippet?.title || "Unknown",
            description: item.snippet?.description || null,
            thumbnail_url:
              item.snippet?.thumbnails?.medium?.url ??
              item.snippet?.thumbnails?.default?.url ??
              null,
            subscriber_count: subs,
            view_count: item.statistics?.viewCount
              ? parseInt(item.statistics.viewCount, 10)
              : 0,
            video_count: item.statistics?.videoCount
              ? parseInt(item.statistics.videoCount, 10)
              : 0,
            country: item.snippet?.country ?? null,
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
    console.log(
      `  … ${Math.min(i + 50, ids.length)}/${ids.length} (upserted=${upserted})`
    );
  }

  console.log(
    `Done. API items=${apiItems}, upserted=${upserted}, skipped low-subs=${skippedSubs}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
