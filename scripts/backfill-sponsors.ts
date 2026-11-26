#!/usr/bin/env tsx
/**
 * Fill sponsored_recent / recent_sponsors for listed creators from the video
 * descriptions already stored in recent_videos (0 YouTube quota). New scores
 * set these fields themselves. Dry run unless --apply.
 *
 *   npm run sponsors:backfill
 *   npm run sponsors:backfill -- --apply
 */
import { loadEnv } from "./lib/env";
loadEnv();

import { createClient } from "@supabase/supabase-js";
import { detectSponsors } from "../src/lib/sponsors";

async function main() {
  const apply = process.argv.includes("--apply");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  let scanned = 0;
  let sponsored = 0;
  let named = 0;
  const brands = new Map<string, number>();
  for (let last = ""; ; ) {
    // recent_videos is a large JSON column: small pages avoid the statement timeout.
    const { data, error } = await db
      .from("channels")
      .select("id, recent_videos")
      .eq("quality_pass", true)
      .not("recent_videos", "is", null)
      .gt("id", last)
      .order("id")
      .limit(100);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    last = data[data.length - 1]!.id;
    for (const r of data) {
      scanned++;
      const vids = Array.isArray(r.recent_videos) ? (r.recent_videos as Array<{ description?: string | null }>) : [];
      const s = detectSponsors(vids.map((v) => v.description));
      if (s.sponsored) sponsored++;
      if (s.sponsors.length) named++;
      for (const b of s.sponsors) brands.set(b, (brands.get(b) ?? 0) + 1);
      if (apply) {
        const { error: e } = await db
          .from("channels")
          .update({ sponsored_recent: s.sponsored, recent_sponsors: s.sponsors.length ? s.sponsors : null })
          .eq("id", r.id);
        if (e) console.warn(`  update ${r.id}: ${e.message}`);
      }
    }
    process.stdout.write(`\r  scanned ${scanned}, sponsored ${sponsored}`);
  }
  console.log(`\nscanned=${scanned} sponsored=${sponsored} with_brand_name=${named} distinct_brands=${brands.size}`);
  console.log(
    "top brands: " +
      Array.from(brands).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `${k} (${v})`).join(", ")
  );
  if (!apply) console.log("dry run: nothing changed (use --apply)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
