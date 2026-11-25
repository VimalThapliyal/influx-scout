#!/usr/bin/env tsx
/**
 * Backfill YouTube topic categories (channels.list topicDetails, 1 unit per 50
 * channels) for channels that don't have them yet. Then reclassify:
 *   npm run classify:channels -- --pass-only --force
 *
 *   npm run topics:fetch                     # passing creators
 *   npm run topics:fetch -- --all --limit 50000
 *   npm run topics:fetch -- --dry-run
 */
import { loadEnv } from "./lib/env";
loadEnv();

import { createClient } from "@supabase/supabase-js";
import { QuotaError, topicNames, youtubeGet, type ChannelItem } from "./lib/channel-payload";

const argv = process.argv.slice(2);
const all = argv.includes("--all");
const dry = argv.includes("--dry-run");
const limitIdx = argv.indexOf("--limit");
const limit = limitIdx >= 0 ? Math.max(1, parseInt(argv[limitIdx + 1]!, 10) || 0) : Number.POSITIVE_INFINITY;

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  let lastId = "";
  let checked = 0;
  let withTopics = 0;
  let units = 0;

  console.log(`[topics] ${all ? "all channels" : "passing creators"}, limit ${limit}${dry ? " (dry run)" : ""}`);
  try {
    while (checked < limit) {
      let q = db
        .from("channels")
        .select("id")
        .is("topic_categories", null)
        .gt("id", lastId)
        .order("id")
        .limit(Math.min(500, limit - checked));
      if (!all) q = q.eq("quality_pass", true);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      if (!data?.length) break;
      lastId = data[data.length - 1]!.id;

      for (let i = 0; i < data.length; i += 50) {
        const ids = data.slice(i, i + 50).map((r) => r.id as string);
        const res = await youtubeGet<{ items?: ChannelItem[] }>("channels", {
          part: "topicDetails",
          id: ids.join(","),
          maxResults: "50",
        });
        units++;
        checked += ids.length;
        // Channels without topics get [] so they aren't fetched again.
        const byTopics = new Map<string, string[]>();
        const found = new Map((res.items ?? []).map((it) => [it.id, topicNames(it) ?? []]));
        for (const id of ids) {
          const key = JSON.stringify(found.get(id) ?? []);
          if (key !== "[]") withTopics++;
          if (!byTopics.has(key)) byTopics.set(key, []);
          byTopics.get(key)!.push(id);
        }
        if (dry) continue;
        for (const [key, group] of Array.from(byTopics.entries())) {
          const { error: upErr } = await db
            .from("channels")
            .update({ topic_categories: JSON.parse(key) })
            .in("id", group);
          if (upErr) console.warn(`  update failed: ${upErr.message}`);
        }
      }
      process.stdout.write(`\r  checked ${checked}, with topics ${withTopics}, ~${units}u`);
    }
  } catch (err) {
    if (!(err instanceof QuotaError)) throw err;
    console.warn(`\nQuota exhausted: ${err.message}`);
  }
  console.log(`\ndone: checked=${checked} with_topics=${withTopics} units=${units}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
