#!/usr/bin/env tsx
/**
 * Import SocialBlade US Top-100 (by names → YouTube IDs).
 * Does NOT scrape Google Search (ToS / CAPTCHA).
 * Source list: https://socialblade.com/youtube/lists/top/100/subscribers/all/US
 *
 *   npm run import:socialblade-us
 *   npm run import:socialblade-us -- --limit 30
 *   npm run import:socialblade-us -- --dry-run
 */
import { loadEnv } from "./lib/env";
loadEnv();

import { createClient } from "@supabase/supabase-js";
import { withChannelClassification } from "../src/lib/classify";
import {
  isMissingClassificationColumnError,
  stripClassificationFields,
} from "../src/lib/classify";
import {
  isMissingMetricsColumnError,
  stripYoutubeMetricsFields,
  withYoutubeMetricsExpiry,
} from "../src/lib/youtube-metrics";

/** Names from SocialBlade US Top 100 by subscribers (fetched mid‑2026). */
const US_TOP_100_NAMES = [
  "MrBeast",
  "Cocomelon - Nursery Rhymes",
  "Vlad and Niki",
  "Stokes Twins",
  "Kids Diana Show",
  "Like Nastya",
  "Alan's Universe",
  "Topper Guild",
  "A4",
  "Baby Shark - Pinkfong Kids' Songs & Stories",
  "Toys and Colors",
  "5-Minute Crafts",
  "Mark Rober",
  "Zhong",
  "Movieclips",
  "LooLoo Kids - Nursery Rhymes and Children's Songs",
  "Dude Perfect",
  "MrBeast 2",
  "Marshmello",
  "Billie Eilish",
  "MrBeast Gaming",
  "Billion Surprise Toys",
  "IShowSpeed",
  "Masha and The Bear",
  "Ben Azelart",
  "Maria Clara & JP",
  "Genevieve's Playhouse - Learning Videos for Kids",
  "Jesser",
  "skibidi",
  "Katy Perry",
  "Vlad và Niki",
  "YouTube",
  "MaviGadget",
  "Kids Roma Show",
  "TEDx Talks",
  "Like Nastya Show",
  "BabyBus - Preschool Songs & Learning Cartoons",
  "Like Nastya ESP",
  "LeoNata Family",
  "XXXTENTACION",
  "Brent Rivera",
  "Zach King",
  "Nick DiGiovanni",
  "NichLmao",
  "LankyBox",
  "Little Baby Bum - Nursery Rhymes & Kids Songs",
  "Daddy Yankee",
  "Marta and Rustam",
  "Diana and Roma ESP",
  "Mr DegrEE",
  "Ryan's World",
  "DisneyMusicVEVO",
  "Prime Video India",
  "Markiplier",
  "Vlad and Niki IDN",
  "That Little Puff",
  "Maroon 5",
  "TheEllenShow",
  "Cool Items Official",
  "Lucas and Marcus",
  "Jordan Matter",
  "D Billions",
  "Beast Reacts",
  "Masters Of Prophecy",
  "Bebefinn - Nursery Rhymes & Kids Songs",
  "Danny Fitt",
  "Yoeslan",
  "J House jr.",
  "Nick Jr.",
  "Chapitosiki",
  "SSSniperWolf",
  "The Royalty Family",
  "Dream",
  "Emmie's Wonder Wardrobe",
  "Justin Flom",
  "The Tonight Show Starring Jimmy Fallon",
  "DONA",
  "Zach Choi",
  "Alan Becker",
  "Talking Tom",
  "Netflix",
  "ImagineDragons",
  "7clouds",
  "Hamster Kombat",
  "_vector_",
  "BigSchool",
  "Luis Fonsi",
  "VaniMani",
  "Preston",
  "Vlad and Niki ESP",
  "Game9bit",
  "Boram Tube Vlog",
  "Filaretiki",
  "America's Got Talent",
  "Kidibli (Kinder Spielzeug Kanal)",
  "Sony AATH",
  "JustinBieberVEVO",
  "Maluma",
  "Diana and Roma ARA",
  "Wiz Khalifa",
];

/** Known handle overrides (avoids expensive search.list). */
const HANDLE_OVERRIDES: Record<string, string> = {
  MrBeast: "MrBeast",
  "MrBeast 2": "MrBeast2",
  "MrBeast Gaming": "MrBeastGaming",
  "Beast Reacts": "BeastReacts",
  "Cocomelon - Nursery Rhymes": "Cocomelon",
  "Vlad and Niki": "VladandNiki",
  "Stokes Twins": "StokesTwins",
  "Kids Diana Show": "KidsDianaShow",
  "Like Nastya": "LikeNastya",
  "Alan's Universe": "AlansUniverse",
  "Topper Guild": "TopperGuild",
  "5-Minute Crafts": "5MinuteCrafts",
  "Mark Rober": "MarkRober",
  Movieclips: "Movieclips",
  "Dude Perfect": "DudePerfect",
  Marshmello: "marshmello",
  "Billie Eilish": "BillieEilish",
  IShowSpeed: "IShowSpeed",
  "Masha and The Bear": "MashaBearEN",
  "Ben Azelart": "BenAzelart",
  Markiplier: "markiplier",
  "TEDx Talks": "TEDxTalks",
  "Brent Rivera": "BrentRivera",
  "Zach King": "ZachKing",
  "Nick DiGiovanni": "NickDiGiovanni",
  NichLmao: "NichLmao",
  LankyBox: "LankyBox",
  "Daddy Yankee": "DaddyYankee",
  "Ryan's World": "RyansWorld",
  DisneyMusicVEVO: "DisneyMusicVEVO",
  TheEllenShow: "TheEllenShow",
  "Jordan Matter": "JordanMatter",
  SSSniperWolf: "SSSniperWolf",
  Dream: "Dream",
  Netflix: "Netflix",
  ImagineDragons: "ImagineDragons",
  JustinBieberVEVO: "JustinBieberVEVO",
  Maluma: "Maluma",
  "Wiz Khalifa": "wizkhalifa",
  YouTube: "YouTube",
  Preston: "PrestonPlayz",
  "Alan Becker": "alanbecker",
  "Zach Choi": "zachchoiASMR",
  "_vector_": "vector",
  "Luis Fonsi": "LuisFonsi",
  XXXTENTACION: "XXXTENTACION",
  "Maroon 5": "Maroon5",
};

function parseArgs(argv: string[]) {
  let limit = 100;
  let dryRun = false;
  let maxSearch = 25;
  let skipSearch = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--limit" && argv[i + 1]) {
      limit = Math.max(1, parseInt(argv[++i]!, 10) || 100);
    } else if (argv[i] === "--max-search" && argv[i + 1]) {
      maxSearch = Math.max(0, parseInt(argv[++i]!, 10) || 25);
    } else if (argv[i] === "--dry-run") dryRun = true;
    else if (argv[i] === "--skip-search") skipSearch = true;
  }
  return { limit, dryRun, maxSearch, skipSearch };
}

function handleGuesses(name: string): string[] {
  const out: string[] = [];
  if (HANDLE_OVERRIDES[name]) out.push(HANDLE_OVERRIDES[name]!);
  const cleaned = name
    .replace(/[✿★]/g, "")
    .replace(/\([^)]*\)/g, "")
    .trim();
  const noPunct = cleaned.replace(/['’.]/g, "");
  const compact = noPunct.replace(/[^A-Za-z0-9]+/g, "");
  if (compact.length >= 3) out.push(compact);
  const camel = noPunct
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w, i) =>
      i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join("");
  if (camel.length >= 3) out.push(camel);
  return Array.from(new Set(out.map((h) => h.replace(/^@/, ""))));
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
    const msg = body?.error?.message || res.statusText;
    throw new Error(`YouTube ${path} ${res.status}: ${msg}`);
  }
  return body as T;
}

async function resolveByHandle(handle: string): Promise<{
  id: string;
  title: string;
  handle: string | null;
} | null> {
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

async function resolveBySearch(q: string): Promise<{
  id: string;
  title: string;
  handle: string | null;
} | null> {
  const data = await youtubeGet<{
    items?: Array<{ id?: { channelId?: string }; snippet?: { title?: string; channelId?: string; channelTitle?: string } }>;
  }>("search", {
    part: "snippet",
    type: "channel",
    maxResults: "1",
    q,
  });
  const item = data.items?.[0];
  const id = item?.id?.channelId || item?.snippet?.channelId;
  if (!id) return null;
  // Prefer channels.list for handle (1 unit)
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
  const names = US_TOP_100_NAMES.slice(0, args.limit);
  console.log(
    `[socialblade-us] resolving ${names.length} names (forHandle first, search fallback≤${args.maxSearch})`
  );

  const resolved: Array<{
    id: string;
    title: string;
    handle: string | null;
    name: string;
    via: string;
  }> = [];
  let searchUsed = 0;
  let failed = 0;

  for (const name of names) {
    let hit: { id: string; title: string; handle: string | null } | null = null;
    let via = "";
    for (const guess of handleGuesses(name)) {
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
        hit = await resolveBySearch(name);
        searchUsed++;
        via = "search";
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/quotaExceeded|dailyLimitExceeded/i.test(msg)) throw err;
        console.warn(`  search fail "${name}":`, msg);
      }
    }
    if (!hit) {
      failed++;
      console.log(`  ✗ ${name}`);
      continue;
    }
    resolved.push({ ...hit, name, via });
    console.log(`  ✓ ${hit.id}  ${hit.title}  (${via})`);
  }

  console.log(
    `\nResolved ${resolved.length}/${names.length} (search calls=${searchUsed}, failed=${failed})`
  );
  if (args.dryRun || resolved.length === 0) return;

  // Fetch full channel details in batches of 50 (cheap)
  const ids = resolved.map((r) => r.id);
  const byId = new Map(resolved.map((r) => [r.id, r]));
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

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
      const subs = item.statistics?.subscriberCount
        ? parseInt(item.statistics.subscriberCount, 10)
        : null;
      const views = item.statistics?.viewCount
        ? parseInt(item.statistics.viewCount, 10)
        : 0;
      const videos = item.statistics?.videoCount
        ? parseInt(item.statistics.videoCount, 10)
        : 0;
      const custom = item.snippet?.customUrl;
      const handle = custom
        ? custom.startsWith("@")
          ? custom
          : `@${custom}`
        : meta?.handle ?? null;

      const payload = withYoutubeMetricsExpiry(
        withChannelClassification({
          id: item.id,
          handle,
          title: item.snippet?.title || meta?.title || "Unknown",
          description: item.snippet?.description || null,
          thumbnail_url:
            item.snippet?.thumbnails?.medium?.url ??
            item.snippet?.thumbnails?.default?.url ??
            null,
          subscriber_count: subs,
          view_count: views,
          video_count: videos,
          country: item.snippet?.country ?? "US",
          published_at: item.snippet?.publishedAt ?? null,
          data_source: "api",
          last_updated: now,
          updated_at: now,
        }, now),
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
  console.log(
    "Tip: add more SocialBlade country lists the same way — do not scrape Google SERPs."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
