#!/usr/bin/env tsx
/**
 * Cleanup junk pending + refill empty seed pool.
 *   npm run seeds:rescue
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";

config({ path: resolve(process.cwd(), ".env.local") });

function normSeedUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = "";
    const path = u.pathname.replace(/\/+$/, "") || "";
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    return `https://${host}${path}`;
  } catch {
    return url.trim().replace(/\/+$/, "").toLowerCase();
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const s = createClient(url, key);

  // 1) Fail junk @domain.com pending
  const { data: junkRows } = await s
    .from("channel_pending")
    .select("id, handle")
    .eq("status", "pending")
    .is("channel_id", null)
    .not("handle", "is", null)
    .limit(2000);

  const junkIds = (junkRows || [])
    .filter((r) => /\.[a-z]{2,}$/i.test(String(r.handle || "").replace(/^@/, "")))
    .map((r) => r.id);

  let junkMarked = 0;
  for (let i = 0; i < junkIds.length; i += 100) {
    const batch = junkIds.slice(i, i + 100);
    const { error } = await s
      .from("channel_pending")
      .update({
        status: "failed",
        reject_reason: "junk handle (looks like website domain)",
        updated_at: new Date().toISOString(),
      })
      .in("id", batch);
    if (!error) junkMarked += batch.length;
  }
  console.log(`Marked junk pending failed: ${junkMarked}`);

  // 2) Recycle oldest done seeds back to available (lists update over time)
  const { data: doneSeeds } = await s
    .from("seed_urls")
    .select("id")
    .eq("status", "done")
    .order("done_at", { ascending: true })
    .limit(40);

  const recycleIds = (doneSeeds || []).map((r) => r.id);
  if (recycleIds.length) {
    await s
      .from("seed_urls")
      .update({
        status: "available",
        claimed_by: null,
        claimed_at: null,
        claim_expires_at: null,
        done_at: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .in("id", recycleIds);
  }
  console.log(`Recycled done → available seeds: ${recycleIds.length}`);

  // 3) Upsert any bank URLs not in seed_urls
  const bankPath = resolve(process.cwd(), "data/seed-bank.json");
  let added = 0;
  if (existsSync(bankPath)) {
    const bank = JSON.parse(readFileSync(bankPath, "utf8")) as {
      urls?: Array<{ niche: string; title: string; url: string }>;
    };
    for (const e of bank.urls || []) {
      const url_norm = normSeedUrl(e.url);
      if (!url_norm) continue;
      const { error } = await s.from("seed_urls").insert({
        url: e.url.trim(),
        url_norm,
        niche: e.niche || null,
        title: e.title || null,
        status: "available",
      });
      if (!error) added++;
    }
  }
  console.log(`New bank URLs inserted: ${added}`);

  const { count: avail } = await s
    .from("seed_urls")
    .select("*", { count: "exact", head: true })
    .eq("status", "available");
  const { count: pending } = await s
    .from("channel_pending")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  console.log({ availableSeeds: avail, pendingLeft: pending });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
