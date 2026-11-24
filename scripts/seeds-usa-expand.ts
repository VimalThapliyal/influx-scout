#!/usr/bin/env tsx
/**
 * Validate USA seed URLs (HTTP OK + looks like a list page), merge into seed-bank,
 * then sync into shared seed_urls as available.
 *
 *   npm run seeds:usa-expand
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/env";
import { USA_RANKING_SOURCES_EXPORT } from "./lib/usa-seed-sources";

loadEnv();

function normSeedUrl(url: string): string {
  const raw = (url || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    u.hash = "";
    for (const key of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "fbclid",
      "gclid",
      "srsltid",
      "ref",
    ]) {
      u.searchParams.delete(key);
    }
    const path = u.pathname.replace(/\/+$/, "") || "";
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const qs = u.searchParams.toString();
    return `https://${host}${path}${qs ? `?${qs}` : ""}`;
  } catch {
    return raw.replace(/\/+$/, "").toLowerCase();
  }
}

async function urlLooksAlive(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; InfluxSeedBot/1.1; +https://influencer-platform-mu.vercel.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(t);
    if (!res.ok) return false;
    const html = (await res.text()).slice(0, 80_000).toLowerCase();
    // Prefer pages that mention youtube / channels / creators
    if (
      html.includes("youtube.com") ||
      html.includes("youtu.be") ||
      html.includes("subscriber") ||
      html.includes("channel")
    ) {
      return true;
    }
    // Soft accept ranking sites even if sparse in first chunk
    const host = new URL(url).hostname;
    if (
      /hypeauditor|socialblade|heepsy|feedspot|ytgrowth|tubefilter/i.test(host)
    ) {
      return html.length > 500;
    }
    return false;
  } catch {
    return false;
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const bankPath = resolve(process.cwd(), "data/seed-bank.json");

  const bank = existsSync(bankPath)
    ? (JSON.parse(readFileSync(bankPath, "utf8")) as {
        _comment?: string;
        updated_at?: string;
        urls: Array<{ niche: string; title: string; url: string }>;
      })
    : { urls: [] as Array<{ niche: string; title: string; url: string }> };

  const existingNorm = new Set(
    (bank.urls || []).map((e) => normSeedUrl(e.url)).filter(Boolean)
  );

  const candidates = USA_RANKING_SOURCES_EXPORT.filter((e) => {
    const n = normSeedUrl(e.url);
    return n && !existingNorm.has(n);
  });

  console.log(
    `[usa-expand] bank=${bank.urls.length} new candidates=${candidates.length}`
  );

  const validated: typeof candidates = [];
  const dead: string[] = [];

  // Validate in small parallel batches
  for (let i = 0; i < candidates.length; i += 6) {
    const batch = candidates.slice(i, i + 6);
    const results = await Promise.all(
      batch.map(async (e) => {
        const ok = await urlLooksAlive(e.url);
        return { e, ok };
      })
    );
    for (const { e, ok } of results) {
      if (ok) {
        validated.push(e);
        console.log(`  ✓ ${e.title}`);
      } else {
        dead.push(e.url);
        console.log(`  ✗ ${e.title}`);
      }
    }
  }

  console.log(
    `[usa-expand] validated=${validated.length} dead=${dead.length}`
  );

  if (!dryRun && validated.length) {
    bank.urls = [...(bank.urls || []), ...validated];
    bank.updated_at = new Date().toISOString().slice(0, 10);
    bank._comment =
      "Roundup URL pool for grow:loop. Prefers USA sources (idea.txt + Feedspot/YTGrowth/Heepsy).";
    writeFileSync(bankPath, JSON.stringify(bank, null, 2) + "\n");
    console.log(`[usa-expand] wrote seed-bank.json (${bank.urls.length} urls)`);
  }

  // Sync ALL usa sources + bank into seed_urls (new rows as available)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key);

  const allEntries = [
    ...(bank.urls || []),
    ...USA_RANKING_SOURCES_EXPORT,
  ];
  const dedup = new Map<string, { niche: string; title: string; url: string }>();
  for (const e of allEntries) {
    const n = normSeedUrl(e.url);
    if (!n) continue;
    if (!dedup.has(n)) dedup.set(n, { ...e, url: e.url.trim() });
  }

  // Only insert rows that are not already in seed_urls
  const { data: existingRows } = await supabase
    .from("seed_urls")
    .select("url_norm, status");
  const have = new Map(
    (existingRows || []).map((r) => [r.url_norm as string, r.status as string])
  );

  let inserted = 0;
  let already = 0;
  const toInsert: Array<{
    url: string;
    url_norm: string;
    niche: string | null;
    title: string | null;
    status: string;
    updated_at: string;
  }> = [];

  for (const [url_norm, e] of dedup) {
    if (have.has(url_norm)) {
      already++;
      continue;
    }
    toInsert.push({
      url: e.url,
      url_norm,
      niche: e.niche || null,
      title: e.title || null,
      status: "available",
      updated_at: new Date().toISOString(),
    });
  }

  if (!dryRun) {
    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50);
      const { error } = await supabase.from("seed_urls").insert(batch);
      if (error) {
        for (const row of batch) {
          const { error: oneErr } = await supabase
            .from("seed_urls")
            .insert(row);
          if (!oneErr) inserted++;
        }
      } else {
        inserted += batch.length;
      }
    }
  } else {
    inserted = toInsert.length;
  }

  const { count: avail } = await supabase
    .from("seed_urls")
    .select("*", { count: "exact", head: true })
    .eq("status", "available");
  const { count: total } = await supabase
    .from("seed_urls")
    .select("*", { count: "exact", head: true });

  console.log({
    dryRun,
    newlyInsertedAvailable: inserted,
    alreadyInPool: already,
    availableNow: avail,
    totalSeeds: total,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
