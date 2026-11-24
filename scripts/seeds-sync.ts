#!/usr/bin/env tsx
/**
 * Upsert local seed-bank + curated USA URLs into shared seed_urls table.
 *
 *   npm run seeds:sync
 *   npm run seeds:sync -- --dry-run
 *
 * Requires: SUPABASE_SERVICE_ROLE_KEY (you run this — not contributors)
 */

import { readFileSync, existsSync } from "fs";
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

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const supabase = createClient(url, key);
  const bankPath = resolve(process.cwd(), "data/seed-bank.json");
  const entries: Array<{ niche: string; title: string; url: string }> = [];

  if (existsSync(bankPath)) {
    const bank = JSON.parse(readFileSync(bankPath, "utf8")) as {
      urls?: Array<{ niche: string; title: string; url: string }>;
    };
    for (const e of bank.urls || []) {
      if (e.url) entries.push(e);
    }
  }

  for (const e of USA_RANKING_SOURCES_EXPORT) {
    entries.push(e);
  }

  const dedup = new Map<string, { niche: string; title: string; url: string }>();
  for (const e of entries) {
    const n = normSeedUrl(e.url);
    if (!n) continue;
    if (!dedup.has(n)) dedup.set(n, { ...e, url: e.url.trim() });
  }

  console.log(`[seeds:sync] ${dedup.size} unique URLs (dryRun=${dryRun})`);

  let inserted = 0;
  let skipped = 0;
  const rows = Array.from(dedup.entries());

  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50).map(([url_norm, e]) => ({
      url: e.url,
      url_norm,
      niche: e.niche || null,
      title: e.title || null,
      status: "available",
      updated_at: new Date().toISOString(),
    }));

    if (dryRun) {
      inserted += batch.length;
      continue;
    }

    const { error } = await supabase.from("seed_urls").upsert(batch, {
      onConflict: "url_norm",
      ignoreDuplicates: true,
    });

    if (error) {
      // Fallback: insert one-by-one skipping conflicts
      for (const row of batch) {
        const { error: oneErr } = await supabase.from("seed_urls").insert(row);
        if (oneErr) {
          skipped++;
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
    }
  }

  const { count } = await supabase
    .from("seed_urls")
    .select("*", { count: "exact", head: true })
    .eq("status", "available");

  console.log(`
[seeds:sync] done
  processed: ${inserted}
  skipped/conflict: ${skipped}
  available in pool: ${count ?? "?"}
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
