#!/usr/bin/env tsx
/**
 * Build engagement-rate benchmarks per creator tier from scored channels and
 * write them to src/data/engagement-benchmarks.json (used by the public
 * engagement-rate calculator). 0 YouTube quota.
 *
 *   npm run benchmarks:build
 */
import { loadEnv } from "./lib/env";
loadEnv();

import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const PER_TIER = 3000;
const TIERS: { tier: string; label: string; min: number; max: number }[] = [
  { tier: "nano", label: "1K–10K", min: 1_000, max: 10_000 },
  { tier: "micro", label: "10K–100K", min: 10_000, max: 100_000 },
  { tier: "mid", label: "100K–500K", min: 100_000, max: 500_000 },
  { tier: "macro", label: "500K–1M", min: 500_000, max: 1_000_000 },
  { tier: "mega", label: "1M+", min: 1_000_000, max: Number.MAX_SAFE_INTEGER },
];

function pct(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return Math.round(sorted[Math.floor((sorted.length - 1) * p)]! * 10_000) / 100; // % with 2dp
}

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const out = [];
  for (const t of TIERS) {
    const values: number[] = [];
    for (let from = 0; values.length < PER_TIER; from += 1000) {
      const { data, error } = await db
        .from("channels")
        .select("engagement_last5")
        .gt("engagement_last5", 0)
        .lt("engagement_last5", 1) // drop obviously broken ratios
        .gte("subscriber_count", t.min)
        .lt("subscriber_count", t.max)
        .order("id")
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      values.push(...(data ?? []).map((r) => Number(r.engagement_last5)));
      if (!data || data.length < 1000) break;
    }
    values.sort((a, b) => a - b);
    out.push({ ...t, max: undefined, sample: values.length, p25: pct(values, 0.25), median: pct(values, 0.5), p75: pct(values, 0.75) });
    console.log(`${t.tier.padEnd(6)} n=${values.length} p25=${pct(values, 0.25)}% median=${pct(values, 0.5)}% p75=${pct(values, 0.75)}%`);
  }
  const dir = resolve(__dirname, "../src/data");
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, "engagement-benchmarks.json");
  writeFileSync(
    file,
    JSON.stringify({ generatedAt: new Date().toISOString(), formula: "(likes + comments) / views, last 5 uploads", tiers: out }, null, 2) + "\n"
  );
  console.log(`wrote ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
