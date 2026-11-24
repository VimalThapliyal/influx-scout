#!/usr/bin/env tsx
/**
 * Import US-trending channels from Kaggle "Trending YouTube Video Statistics"
 * (datasnaek/youtube-new → USvideos.csv). Titles only — resolve via forHandle then search.
 *
 *   npm run import:kaggle-us -- --download          # fetch CSV online, then import
 *   npm run import:kaggle-us -- --download-only     # fetch CSV only (no YouTube API)
 *   npm run import:kaggle-us -- --limit 200
 *   npm run import:kaggle-us -- --max-search 40
 *   npm run import:kaggle-us -- --dry-run
 *   npm run import:kaggle-us -- --countries US,CA,GB
 *
 * Online source (same Kaggle dataset, public GitHub mirror — no Kaggle login needed):
 *   https://github.com/ZhaoyiW/YouTube-Trending-Video-Analysis (USvideos.csv)
 * Optional: KAGGLE_USERNAME + KAGGLE_KEY → downloads via Kaggle API instead.
 */
import {
  createReadStream,
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  createWriteStream,
} from "fs";
import { createInterface } from "readline";
import { resolve } from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
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

/** Public mirror of Kaggle datasnaek/youtube-new USvideos.csv (~62MB). */
const US_VIDEOS_MIRROR =
  "https://raw.githubusercontent.com/ZhaoyiW/YouTube-Trending-Video-Analysis/main/USvideos.csv";

function parseArgs(argv: string[]) {
  let limit = 2207;
  let offset = 0;
  let dryRun = false;
  let maxSearch = 40;
  let skipSearch = false;
  let countries = ["US"];
  let refresh = false;
  let download = false;
  let downloadOnly = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--limit" && argv[i + 1]) {
      limit = Math.max(1, parseInt(argv[++i]!, 10) || 2207);
    } else if (argv[i] === "--offset" && argv[i + 1]) {
      offset = Math.max(0, parseInt(argv[++i]!, 10) || 0);
    } else if (argv[i] === "--max-search" && argv[i + 1]) {
      maxSearch = Math.max(0, parseInt(argv[++i]!, 10) || 40);
    } else if (argv[i] === "--countries" && argv[i + 1]) {
      countries = argv[++i]!
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);
    } else if (argv[i] === "--dry-run") dryRun = true;
    else if (argv[i] === "--skip-search") skipSearch = true;
    else if (argv[i] === "--refresh") refresh = true;
    else if (argv[i] === "--download") download = true;
    else if (argv[i] === "--download-only") {
      download = true;
      downloadOnly = true;
    }
  }
  return {
    limit,
    offset,
    dryRun,
    maxSearch,
    skipSearch,
    countries,
    refresh,
    download,
    downloadOnly,
  };
}

async function downloadViaKaggleApi(destPath: string): Promise<boolean> {
  const user = process.env.KAGGLE_USERNAME;
  const key = process.env.KAGGLE_KEY;
  if (!user || !key) return false;

  const auth = Buffer.from(`${user}:${key}`).toString("base64");
  const url =
    "https://www.kaggle.com/api/v1/datasets/download/datasnaek/youtube-new";
  console.log(`[kaggle] downloading datasnaek/youtube-new via Kaggle API…`);
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
    redirect: "follow",
  });
  if (!res.ok || !res.body) {
    console.warn(`  Kaggle API ${res.status} — falling back to mirror`);
    return false;
  }

  const zipPath = resolve(destPath, "..", "youtube-new.zip");
  mkdirSync(resolve(destPath, ".."), { recursive: true });
  await pipeline(
    Readable.fromWeb(res.body as import("stream/web").ReadableStream),
    createWriteStream(zipPath)
  );

  // Extract USvideos.csv with Python (unzip may not be on PATH the same way)
  const { execFileSync } = await import("child_process");
  execFileSync(
    "python3",
    [
      "-c",
      `
import zipfile, sys
z=zipfile.ZipFile(sys.argv[1])
names=[n for n in z.namelist() if n.endswith('USvideos.csv') or n=='USvideos.csv']
if not names: raise SystemExit('USvideos.csv not in zip')
with z.open(names[0]) as src, open(sys.argv[2],'wb') as dst:
    dst.write(src.read())
print('extracted', names[0], '->', sys.argv[2])
`,
      zipPath,
      destPath,
    ],
    { stdio: "inherit" }
  );
  return existsSync(destPath);
}

async function downloadUsVideosCsv(destPath: string): Promise<void> {
  mkdirSync(resolve(destPath, ".."), { recursive: true });

  if (await downloadViaKaggleApi(destPath)) {
    console.log(`[kaggle] wrote ${destPath}`);
    return;
  }

  console.log(`[kaggle] downloading USvideos.csv from public mirror…`);
  console.log(`  ${US_VIDEOS_MIRROR}`);
  const res = await fetch(US_VIDEOS_MIRROR);
  if (!res.ok || !res.body) {
    throw new Error(`Download failed: HTTP ${res.status}`);
  }
  await pipeline(
    Readable.fromWeb(res.body as import("stream/web").ReadableStream),
    createWriteStream(destPath)
  );
  const bytes = readFileSync(destPath).byteLength;
  console.log(`[kaggle] wrote ${destPath} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
}

/** Minimal CSV line parser that respects quoted fields. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function loadTitlesFromCsv(
  csvPath: string
): Promise<Map<string, { title: string; maxViews: number; hits: number }>> {
  const byTitle = new Map<
    string,
    { title: string; maxViews: number; hits: number }
  >();
  const rl = createInterface({
    input: createReadStream(csvPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let header: string[] | null = null;
  let titleIdx = -1;
  let viewsIdx = -1;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    if (!header) {
      header = cols.map((c) => c.trim());
      titleIdx = header.indexOf("channel_title");
      viewsIdx = header.indexOf("views");
      if (titleIdx < 0) throw new Error(`channel_title missing in ${csvPath}`);
      continue;
    }
    const title = (cols[titleIdx] || "").trim();
    if (!title) continue;
    const views = viewsIdx >= 0 ? parseInt(cols[viewsIdx] || "0", 10) || 0 : 0;
    const key = title.toLowerCase();
    const prev = byTitle.get(key);
    if (!prev) {
      byTitle.set(key, { title, maxViews: views, hits: 1 });
    } else {
      prev.hits++;
      if (views > prev.maxViews) prev.maxViews = views;
    }
  }
  return byTitle;
}

function titleToHandleGuesses(title: string): string[] {
  const clean = title
    .replace(/[✿★™®©]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .trim();
  const compact = clean.replace(/[^A-Za-z0-9]+/g, "");
  const noSpaces = clean.replace(/\s+/g, "");
  const pascal = clean
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
  const firstToken = clean.split(/[^A-Za-z0-9]+/).filter(Boolean)[0] || "";
  return Array.from(
    new Set(
      [compact, noSpaces, pascal, firstToken, clean.replace(/\s+/g, "")]
        .map((h) => h.replace(/^@/, ""))
        .filter((h) => h.length >= 3 && h.length <= 30)
    )
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
    regionCode: "US",
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

  const usCsvPath = resolve(
    process.cwd(),
    "Youtube_data/Countries_data/USvideos.csv"
  );
  if (args.download && args.countries.includes("US")) {
    await downloadUsVideosCsv(usCsvPath);
    args.refresh = true; // rebuild title cache from fresh CSV
  }
  if (args.downloadOnly) {
    console.log("[kaggle] download-only done. Import later with:");
    console.log("  npm run import:kaggle-us -- --max-search 40");
    return;
  }

  const cachePath = resolve(
    process.cwd(),
    `data/kaggle-${args.countries.join("-").toLowerCase()}-titles.json`
  );

  let ranked: Array<{ title: string; maxViews: number; hits: number }>;

  if (existsSync(cachePath) && !args.refresh) {
    const cached = JSON.parse(readFileSync(cachePath, "utf8")) as {
      channels: Array<{ title: string; maxViews: number; hits: number }>;
    };
    ranked = cached.channels;
    console.log(`[kaggle] cached ${ranked.length} titles from ${cachePath}`);
  } else {
    const merged = new Map<
      string,
      { title: string; maxViews: number; hits: number }
    >();
    for (const cc of args.countries) {
      const csvPath = resolve(
        process.cwd(),
        `Youtube_data/Countries_data/${cc}videos.csv`
      );
      if (!existsSync(csvPath)) {
        if (cc === "US" && args.download) {
          // already attempted
        }
        console.warn(`  skip missing ${csvPath}`);
        continue;
      }
      console.log(`[kaggle] reading ${csvPath}…`);
      const map = await loadTitlesFromCsv(csvPath);
      for (const [key, val] of map) {
        const prev = merged.get(key);
        if (!prev) merged.set(key, { ...val });
        else {
          prev.hits += val.hits;
          if (val.maxViews > prev.maxViews) prev.maxViews = val.maxViews;
        }
      }
    }
    ranked = Array.from(merged.values()).sort(
      (a, b) => b.maxViews - a.maxViews || b.hits - a.hits
    );
    mkdirSync(resolve(cachePath, ".."), { recursive: true });
    writeFileSync(
      cachePath,
      JSON.stringify(
        {
          source: args.countries.map((c) => `${c}videos.csv`),
          extracted_at: new Date().toISOString(),
          count: ranked.length,
          channels: ranked,
        },
        null,
        2
      )
    );
    console.log(`[kaggle] wrote ${ranked.length} titles → ${cachePath}`);
  }

  const slice = ranked.slice(args.offset, args.offset + args.limit);
  console.log(
    `[kaggle] resolving ${slice.length} (offset=${args.offset}, forHandle first, search≤${args.maxSearch})`
  );

  if (args.dryRun) {
    console.log(
      "Dry run sample:",
      slice.slice(0, 15).map((c) => `${c.title} (views≤${c.maxViews})`)
    );
    return;
  }

  const resolved: Array<{
    id: string;
    title: string;
    handle: string | null;
    name: string;
    via: string;
  }> = [];
  let searchUsed = 0;
  let failed = 0;
  let skipSearch = args.skipSearch;

  for (let i = 0; i < slice.length; i++) {
    const entry = slice[i]!;
    let hit: { id: string; title: string; handle: string | null } | null = null;
    let via = "";
    for (const guess of titleToHandleGuesses(entry.title)) {
      try {
        hit = await resolveByHandle(guess);
        if (hit) {
          via = `forHandle:${guess}`;
          break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          /quotaExceeded|dailyLimitExceeded|exceeded your[\s\S]*quota/i.test(msg)
        )
          throw err;
      }
    }
    if (!hit && !skipSearch && searchUsed < args.maxSearch) {
      try {
        hit = await resolveBySearch(entry.title);
        searchUsed++;
        via = "search";
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          /quotaExceeded|dailyLimitExceeded|exceeded your[\s\S]*quota/i.test(msg)
        )
          throw err;
        if (/Search Queries|Queries per day/i.test(msg)) {
          console.warn(
            `  search quota hit — disabling further search.list (${msg.slice(0, 120)})`
          );
          skipSearch = true;
        } else {
          console.warn(`  search fail "${entry.title}":`, msg);
        }
      }
    }
    if (!hit) {
      failed++;
      console.log(`  ✗ ${entry.title}`);
      continue;
    }
    resolved.push({ ...hit, name: entry.title, via });
    console.log(
      `  ✓ ${i + 1}/${slice.length} ${hit.id}  ${hit.title}  (${via})`
    );
  }

  console.log(
    `\nResolved ${resolved.length}/${slice.length} (search=${searchUsed}, failed=${failed})`
  );
  if (resolved.length === 0) return;

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
            // Prefer live country; US trending list is not proof of US domicile
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
  }

  console.log(`Upserted ${upserted} channels into library.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
