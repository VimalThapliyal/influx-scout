#!/usr/bin/env tsx
/**
 * Lookalike discovery: creators who pass the quality gate feature similar
 * creators on their channel ("Featured channels" sections). Those IDs are far
 * better seeds than random census IDs, so we queue them into channel_seed
 * (source='lookalike') for the normal validate → score pipeline.
 *
 * Cost: channelSections.list = 1 unit per creator expanded.
 * Stateless rotation: each day expands the next slice of passing creators
 * (ordered by id), so the whole set is covered every ~passing/limit days.
 *
 *   npm run discover:lookalikes -- --dry-run --limit 200 --stats
 *   npm run discover:lookalikes -- --limit 1000
 */
import { loadEnv } from "./lib/env";
loadEnv();

import { createClient } from "@supabase/supabase-js";

const API = "https://www.googleapis.com/youtube/v3";
const CONCURRENCY = 8;
const UC_ID = /^UC[A-Za-z0-9_-]{22}$/;
const TIER_COUNTRIES = new Set([
  "US", "GB", "CA", "AU", "DE", "FR", "NL", "IE", "AT", "BE", "CH", "DK", "ES", "FI",
  "IT", "NO", "PL", "PT", "SE", "CZ", "GR", "HU", "RO", "LU",
]);

interface Args {
  limit: number;
  maxUnits: number;
  dryRun: boolean;
  stats: boolean;
  /** Share of the daily budget spent on creators who have a public email. */
  emailShare: number;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { limit: 1000, maxUnits: 1500, dryRun: false, stats: false, emailShare: 0.5 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--limit" && argv[i + 1]) a.limit = Math.max(1, parseInt(argv[++i]!, 10) || 1000);
    else if (argv[i] === "--max-units" && argv[i + 1]) a.maxUnits = Math.max(1, parseInt(argv[++i]!, 10) || 1500);
    else if (argv[i] === "--email-share" && argv[i + 1]) a.emailShare = Math.min(1, Math.max(0, parseFloat(argv[++i]!) || 0));
    else if (argv[i] === "--dry-run") a.dryRun = true;
    else if (argv[i] === "--stats") a.stats = true;
  }
  return a;
}

function apiKey(): string {
  const key =
    (process.env.YOUTUBE_API_KEY || "").trim() ||
    (process.env.YOUTUBE_API_KEYS || "").split(",").map((s) => s.trim()).find(Boolean) ||
    "";
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  return key;
}

class QuotaError extends Error {}

async function yt(path: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ ...params, key: apiKey() });
  const res = await fetch(`${API}/${path}?${qs}`);
  if (res.status === 403) {
    const body = await res.text();
    if (/quota/i.test(body)) throw new QuotaError(body.slice(0, 200));
    return null;
  }
  if (!res.ok) return null;
  return res.json();
}

/** Channel IDs featured on a creator's channel page. */
async function featuredChannels(channelId: string): Promise<string[]> {
  const data = await yt("channelSections", { part: "contentDetails", channelId });
  const ids: string[] = [];
  for (const item of data?.items ?? []) {
    for (const id of item?.contentDetails?.channels ?? []) {
      if (typeof id === "string" && UC_ID.test(id) && id !== channelId) ids.push(id);
    }
  }
  return ids;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Rotating slice of passing creators (ids only — cheap).
  const { count: passCount, error: cErr } = await db
    .from("channels")
    .select("id", { count: "exact", head: true })
    .eq("quality_pass", true);
  if (cErr) throw new Error(cErr.message);
  const total = passCount ?? 0;
  if (total === 0) return console.log("[lookalikes] no passing creators yet");
  const want = Math.min(args.limit, args.maxUnits, total);
  const day = Math.floor(Date.now() / 86_400_000);

  /** Next rotating slice of passing creators, optionally only those with a public email. */
  const slice = async (count: number, emailOnly: boolean): Promise<string[]> => {
    if (count <= 0) return [];
    const filtered = (sel: any) => (emailOnly ? sel.eq("quality_pass", true).not("email", "is", null) : sel.eq("quality_pass", true));
    const { count: n, error } = await filtered(db.from("channels").select("id", { count: "exact", head: true }));
    if (error) throw new Error(error.message);
    const size = n ?? 0;
    if (size === 0) return [];
    const take = Math.min(count, size);
    const ids: string[] = [];
    for (let from = (day * take) % size; ids.length < take; ) {
      const to = Math.min(from + 999, from + (take - ids.length) - 1);
      const { data, error: e } = await filtered(db.from("channels").select("id")).order("id").range(from, to);
      if (e) throw new Error(e.message);
      if (!data?.length) {
        if (from === 0) break;
        from = 0; // wrap around
        continue;
      }
      ids.push(...data.map((r: any) => r.id as string));
      from = to + 1;
    }
    return ids;
  };

  // Creators who publish a business email tend to feature others who do too,
  // so part of each day's budget goes to them (they cycle faster).
  const fromEmail = await slice(Math.floor(want * args.emailShare), true);
  const seen = new Set(fromEmail);
  const rest = (await slice(want - fromEmail.length, false)).filter((id) => !seen.has(id));
  const sources = [...fromEmail, ...rest];
  const start = `${fromEmail.length} with email + ${rest.length} others`;
  console.log(`[lookalikes] expanding ${sources.length} of ${total} passing creators (${start}) dryRun=${args.dryRun}`);

  // Expand (1 unit each).
  const found = new Set<string>();
  let units = 0;
  let withFeatured = 0;
  let quotaHit = false;
  for (let i = 0; i < sources.length && !quotaHit; i += CONCURRENCY) {
    const chunk = sources.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map((id) =>
        featuredChannels(id).catch((e) => {
          if (e instanceof QuotaError) quotaHit = true;
          return [] as string[];
        })
      )
    );
    units += chunk.length;
    for (const ids of results) {
      if (ids.length) withFeatured++;
      ids.forEach((id) => found.add(id));
    }
    process.stdout.write(`\r  expanded ${Math.min(i + CONCURRENCY, sources.length)}, featured ids ${found.size}`);
  }
  console.log(quotaHit ? "\n  ⏹ quota exhausted — stopping early" : "");

  // Drop channels already in the library or already queued.
  const all = Array.from(found);
  const known = new Set<string>();
  for (let i = 0; i < all.length; i += 200) {
    const batch = all.slice(i, i + 200);
    const [{ data: inLib }, { data: inSeed }] = await Promise.all([
      db.from("channels").select("id").in("id", batch),
      db.from("channel_seed").select("channel_id").in("channel_id", batch),
    ]);
    inLib?.forEach((r) => known.add(r.id));
    inSeed?.forEach((r) => r.channel_id && known.add(r.channel_id));
  }
  const fresh = all.filter((id) => !known.has(id));

  console.log(
    `[lookalikes] creators with featured channels: ${withFeatured}/${sources.length} · ` +
      `featured ids: ${all.length} · new to us: ${fresh.length} · ~${units} units`
  );

  if (args.stats && fresh.length) await reportQuality(fresh.slice(0, 500));

  if (!args.dryRun && fresh.length) {
    const now = new Date().toISOString();
    let queued = 0;
    for (let i = 0; i < fresh.length; i += 500) {
      const rows = fresh.slice(i, i + 500).map((id) => ({
        seed_key: `channel:${id}`,
        channel_id: id,
        id_format: "channel",
        source: "lookalike",
        status: "new",
        discovered_at: now,
      }));
      const { error } = await db.from("channel_seed").upsert(rows, { onConflict: "seed_key", ignoreDuplicates: true });
      if (error) console.warn(`  queue failed: ${error.message}`);
      else queued += rows.length;
    }
    console.log(`[lookalikes] queued ${queued} new seeds for validation`);
  }
}

/** Dry-run evidence: how big / where are the new lookalike channels? (1 unit per 50) */
async function reportQuality(ids: string[]) {
  let n = 0, k10 = 0, k30 = 0, k100 = 0, tier = 0, noCountry = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const data = await yt("channels", { part: "snippet,statistics", id: ids.slice(i, i + 50).join(","), maxResults: "50" });
    for (const it of data?.items ?? []) {
      n++;
      const subs = Number(it.statistics?.subscriberCount ?? 0);
      if (subs >= 10_000) k10++;
      if (subs >= 30_000) k30++;
      if (subs >= 100_000) k100++;
      const c = it.snippet?.country;
      if (!c) noCountry++;
      else if (TIER_COUNTRIES.has(c)) tier++;
    }
  }
  const pct = (x: number) => (n ? `${((100 * x) / n).toFixed(1)}%` : "-");
  console.log(
    `[lookalikes] sample of ${n} new channels: ≥10k subs ${pct(k10)} · ≥30k ${pct(k30)} · ≥100k ${pct(k100)} · ` +
      `US/EU ${pct(tier)} · no country ${pct(noCountry)}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
