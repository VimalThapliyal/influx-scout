#!/usr/bin/env tsx
/**
 * Demo: import YouTube channel links from external roundup pages (seed-lists.json).
 *
 *   npm run import:lists -- --dry-run
 *   npm run import:lists -- --dry-run --niche finance
 *   npm run import:lists -- --limit 2
 *   npm run import:lists              # light-save to API (needs WORKER_KEY)
 *
 * Agent tip: ask ChatGPT/Claude/Cursor to refresh data/seed-lists.json with new URLs.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { loadEnv } from "./lib/env";
import {
  markSeedUrlsUsed,
  seedsLookExhausted,
  setSeedsNeedRefresh,
  clearSeedsNeedRefresh,
  filterUnusedSeedEntries,
  loadSeedHistory,
  saveSeedHistory,
} from "./lib/seed-history";

loadEnv();

interface SeedList {
  niche: string;
  title: string;
  url: string;
  notes?: string;
}

interface SeedFile {
  lists: SeedList[];
  updated_at?: string;
}

interface CliArgs {
  dryRun: boolean;
  niche?: string;
  limit: number;
  seedPath: string;
  workerKey?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    dryRun: false,
    limit: 50,
    seedPath: resolve(process.cwd(), "data/seed-lists.json"),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--niche" && argv[i + 1]) args.niche = argv[++i];
    else if (a === "--limit" && argv[i + 1]) {
      args.limit = Math.max(1, parseInt(argv[++i], 10) || 50);
    } else if (a === "--seed" && argv[i + 1]) {
      args.seedPath = resolve(process.cwd(), argv[++i]);
    } else if ((a === "--key" || a === "--worker-key") && argv[i + 1]) {
      args.workerKey = argv[++i];
    } else if (a === "--help" || a === "-h") {
      console.log(`
Import external list pages → light-save queue

  --dry-run            Fetch + extract only (no API write)
  --niche <id>         Only this niche (e.g. finance)
  --limit <n>          Max seed pages to process (default 50)
  --seed <path>        Path to seed-lists.json
  --key iw_…           Same worker key as the Chrome extension

Or set INFLUX_WORKER_KEY=iw_… in .env.local
`);
      process.exit(0);
    }
  }
  return args;
}

const YT_URL_RE =
  /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:@[\w.-]+|channel\/UC[\w-]+|c\/[\w.-]+|user\/[\w.-]+)(?:\/[^\s"'<>]*)?|youtu\.be\/[\w-]+)/gi;

const HANDLE_RE = /(?:^|[^\w/])@([A-Za-z0-9._-]{3,30})\b/g;

function normalizeChannelUrl(raw: string): string | null {
  try {
    const u = new URL(raw.split(/[?#]/)[0]);
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "youtube.com" && host !== "youtu.be" && host !== "m.youtube.com") {
      return null;
    }
    if (host === "youtu.be") return null; // video, skip
    const path = u.pathname.replace(/\/$/, "");
    if (/^\/(watch|shorts|playlist|results|feed)/i.test(path)) return null;
    if (/^\/@[^/]+/.test(path)) {
      // path is "/@Handle" → join keeps leading slash; do not add another
      return `https://www.youtube.com${path.split("/").slice(0, 2).join("/")}`;
    }
    if (/^\/channel\/UC[\w-]+/i.test(path)) {
      return `https://www.youtube.com${path.split("/").slice(0, 3).join("/")}`;
    }
    if (/^\/(c|user)\/[^/]+/i.test(path)) {
      return `https://www.youtube.com${path.split("/").slice(0, 3).join("/")}`;
    }
    return null;
  } catch {
    return null;
  }
}

function extractYouTubeChannels(html: string): string[] {
  const found = new Set<string>();

  for (const match of Array.from(html.matchAll(YT_URL_RE))) {
    const n = normalizeChannelUrl(match[0]);
    if (n) found.add(n);
  }

  // Common patterns in roundup articles without full URLs
  for (const match of Array.from(
    html.matchAll(/youtube\.com\/(@[\w.-]+|channel\/UC[\w-]+)/gi)
  )) {
    const n = normalizeChannelUrl(`https://www.youtube.com/${match[1]}`);
    if (n) found.add(n);
  }

  // Bare @handles that look like creators (heuristic)
  for (const match of Array.from(html.matchAll(HANDLE_RE))) {
    const h = match[1];
    if (/^(media|font|keyframes|import|charset|supports)$/i.test(h)) continue;
    if (h.length < 4 || h.length > 30) continue;
    if (/\.(com|org|net|io|co|ca|ph|uk|in|au|tv|me)$/i.test(h)) continue;
    found.add(`https://www.youtube.com/@${h}`);
  }

  return Array.from(found);
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; InfluxSeedBot/1.0; +https://influencer-platform-mu.vercel.app)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

async function lightSaveBatch(
  urls: string[],
  apiUrl: string,
  workerKey: string
): Promise<{ queued: number; already: number; error?: string }> {
  const channels = urls.map((url) => ({ url }));
  let queued = 0;
  let already = 0;

  for (let i = 0; i < channels.length; i += 50) {
    const batch = channels.slice(i, i + 50);
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/worker/submit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${workerKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "light",
        channels: batch,
        usa_only: true,
        min_subscribers: 0,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        queued,
        already,
        error: data.error || `HTTP ${res.status}`,
      };
    }
    queued += Number(data.queued || 0);
    already +=
      Number(data.already_saved || 0) + Number(data.already_pending || 0);
  }

  return { queued, already };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const raw = readFileSync(args.seedPath, "utf8");
  const seed = JSON.parse(raw) as SeedFile;
  let lists = seed.lists || [];
  if (args.niche) {
    lists = lists.filter(
      (l) => l.niche.toLowerCase() === args.niche!.toLowerCase()
    );
  }
  lists = lists.slice(0, args.limit);

  // Never re-import roundup URLs already in seed-history.json
  const beforeFilter = lists.length;
  const { unused, skipped } = filterUnusedSeedEntries(lists);
  lists = unused;
  if (skipped.length > 0) {
    console.log(
      `\n⏭  Skipping ${skipped.length}/${beforeFilter} seed URL(s) already in seed-history.json`
    );
    skipped.slice(0, 5).forEach((s) => console.log(`     · ${s.url}`));
    if (skipped.length > 5) console.log(`     … +${skipped.length - 5} more`);
  }

  // Persist normalized history file on each import run
  saveSeedHistory(loadSeedHistory());

  if (lists.length === 0) {
    console.log(`
╔══════════════════════════════════════════╗
║  Influx external list import             ║
╚══════════════════════════════════════════╝
  All seed URLs were already used.
  Refresh: npm run grow:loop  (loads next unused batch)
  Or:      npm run seed:refill
`);
    setSeedsNeedRefresh("seed-lists.json had 0 unused URLs");
    return;
  }

  console.log(`
╔══════════════════════════════════════════╗
║  Influx external list import (demo)      ║
╚══════════════════════════════════════════╝
  seed: ${args.seedPath}
  pages: ${lists.length} unique (skipped ${skipped.length} used)
  mode: ${args.dryRun ? "DRY-RUN (extract only)" : "LIGHT-SAVE"}
`);

  const apiUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://influencer-platform-mu.vercel.app";
  const workerKey =
    args.workerKey ||
    process.env.INFLUX_WORKER_KEY ||
    process.env.WORKER_SUBMIT_TOKEN ||
    "";

  if (!args.dryRun && !workerKey) {
    console.error(`
Missing worker key (same iw_… key as your Chrome extension).

  Option A — one-shot:
    npm run import:lists -- --key iw_YOUR_KEY_HERE

  Option B — save in .env.local:
    INFLUX_WORKER_KEY=iw_YOUR_KEY_HERE

  Option C — extract only (no write):
    npm run import:lists -- --dry-run
`);
    process.exit(1);
  }

  let totalLinks = 0;
  let totalQueued = 0;
  const processedUrls: string[] = [];

  for (const list of lists) {
    console.log(`\n── ${list.niche}: ${list.title}`);
    console.log(`   ${list.url}`);
    processedUrls.push(list.url);
    try {
      const html = await fetchPage(list.url);
      const channels = extractYouTubeChannels(html);
      totalLinks += channels.length;
      console.log(`   extracted ${channels.length} channel URL(s)`);
      channels.slice(0, 8).forEach((u) => console.log(`     • ${u}`));
      if (channels.length > 8) {
        console.log(`     … +${channels.length - 8} more`);
      }

      if (args.dryRun || channels.length === 0) continue;

      const result = await lightSaveBatch(channels, apiUrl, workerKey);
      if (result.error) {
        console.log(`   ✗ save failed: ${result.error}`);
      } else {
        totalQueued += result.queued;
        console.log(
          `   ✓ light-saved queued=${result.queued} already=${result.already}`
        );
      }
    } catch (err) {
      console.log(
        `   ✗ ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  if (!args.dryRun && processedUrls.length > 0) {
    markSeedUrlsUsed(processedUrls, {
      queued: totalQueued,
      links: totalLinks,
    });
    if (seedsLookExhausted(totalQueued, totalLinks)) {
      setSeedsNeedRefresh(
        `Import yield low: queued=${totalQueued} links=${totalLinks}. Need fresh seed-lists.json.`
      );
      console.log(
        "\n⚠ Seed lists look exhausted (few new channels). Say \"grow\" in Cursor to refresh URLs."
      );
    } else {
      clearSeedsNeedRefresh();
    }
  }

  console.log(`
──────────────────────────────────────────
Done. Links found: ${totalLinks}${
    args.dryRun
      ? " (dry-run — nothing written)"
      : ` · queued: ${totalQueued}`
  }

Next:
  npm run enrich:pending -- --limit 200
  # or: npm run grow
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
