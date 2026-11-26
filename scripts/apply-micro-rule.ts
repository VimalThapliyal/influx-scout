#!/usr/bin/env tsx
/**
 * Apply the micro-creator bar to channels already scored: creators under 50K
 * subscribers in a known US/EU country that failed ONLY on average views, but
 * have 1,500+ recent views, 3%+ engagement and an upload in the last 45 days,
 * become listed. Uses stored
 * scores (0 YouTube quota); the next refresh re-checks them against YouTube.
 * Dry run unless --apply.
 *
 *   npm run quality:micro
 *   npm run quality:micro -- --apply
 */
import { loadEnv } from "./lib/env";
loadEnv();

import { createClient } from "@supabase/supabase-js";
import { locationTier, passesMicroBar } from "../src/lib/quality-gate";

async function main() {
  const apply = process.argv.includes("--apply");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const since = new Date(Date.now() - 45 * 86_400_000).toISOString();
  const hits: any[] = [];
  let scanned = 0;
  for (let last = ""; ; ) {
    let data: any[] | null = null;
    for (let attempt = 1; ; attempt++) {
      // Plain id-ordered pages (a filtered scan over ~200k rows times out); filter here.
      const res = await db
        .from("channels")
        .select("id, title, country, subscriber_count, avg_views_last5, engagement_last5, quality_pass, quality_fail_reasons, latest_upload_at, opted_out_at, email")
        .not("quality_scored_at", "is", null)
        .gt("id", last)
        .order("id")
        .limit(1000);
      if (!res.error) {
        data = res.data;
        break;
      }
      if (attempt >= 3) throw new Error(res.error.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
    if (!data?.length) break;
    last = data[data.length - 1].id;
    scanned += data.length;
    for (const r of data) {
      if (r.quality_pass !== false || r.opted_out_at || !r.latest_upload_at || r.latest_upload_at < since) continue;
      const tier = locationTier(r.country);
      if (tier !== "tier1" && tier !== "tier2") continue; // country must be known and in our markets
      const reasons: string[] = r.quality_fail_reasons ?? [];
      if (reasons.length === 1 && reasons[0] === "avg_views_low" && passesMicroBar(r.subscriber_count, r.avg_views_last5, r.engagement_last5)) {
        hits.push(r);
      }
    }
  }
  const byCountry = new Map<string, number>();
  for (const h of hits) byCountry.set(h.country ?? "none", (byCountry.get(h.country ?? "none") ?? 0) + 1);
  console.log(`scored channels scanned ${scanned} · newly passing ${hits.length} · with email ${hits.filter((h) => h.email).length}`);
  console.log("by country: " + Array.from(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}=${v}`).join(" "));
  console.log("examples: " + hits.slice(0, 8).map((h) => `${h.title} (${h.subscriber_count} subs, ${h.avg_views_last5} views, ${(h.engagement_last5 * 100).toFixed(1)}%)`).join(" | "));
  if (!apply) return console.log("dry run: nothing changed (use --apply)");

  for (let i = 0; i < hits.length; i += 200) {
    const { error } = await db
      .from("channels")
      .update({ quality_pass: true, quality_fail_reasons: [], is_emerging: true })
      .in("id", hits.slice(i, i + 200).map((h) => h.id));
    if (error) throw new Error(error.message);
  }
  console.log(`listed ${hits.length} creators under the micro bar`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
