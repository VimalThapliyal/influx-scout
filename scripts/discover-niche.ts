#!/usr/bin/env tsx
/**
 * Niche-deep discovery: keyword + This Week/Month video search → unique channels.
 * Go 200–300 deep in ONE niche before expanding (one-pager).
 *
 *   npm run discover:niche -- --niche fitness --window month --target 250
 *   npm run discover:niche -- --query "personal finance usa" --window week --limit 50
 */
import { loadEnv } from "./lib/env";
loadEnv();

import { createClient } from "@supabase/supabase-js";
import {
  searchRecentVideoChannels,
  getChannelDetails,
  mapYouTubeChannelToDb,
} from "../src/lib/youtube";
import { withYoutubeMetricsExpiry } from "../src/lib/youtube-metrics";
import { scoreChannelById } from "./lib/score-activity";
import {
  isMissingQualityColumnError,
  stripQualityFields,
} from "../src/lib/quality-gate";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const NICHE_QUERIES: Record<string, string[]> = {
  fitness: ["fitness workout usa", "home workout", "gym vlog"],
  gaming: ["gaming usa", "lets play", "twitch streamer"],
  beauty: ["makeup tutorial", "skincare routine", "beauty haul"],
  fashion: ["outfit ideas", "fashion haul", "street style"],
  finance: ["personal finance", "investing for beginners", "money tips"],
  tech: ["tech review", "coding tutorial", "gadgets"],
  food: ["cooking recipe", "food vlog", "meal prep"],
  travel: ["travel vlog usa", "road trip", "city guide"],
  parenting: ["mom vlog", "parenting tips", "family vlog"],
  education: ["study with me", "learn coding", "explainer"],
  pets: ["dog training", "cat videos", "pet care"],
  diy: ["diy home", "crafts tutorial", "woodworking"],
};

function parseArgs(argv: string[]) {
  let niche = "";
  let query = "";
  let window: "week" | "month" | "any" = "month";
  let target = 250;
  let limit = 50;
  let dryRun = false;
  let score = true;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--niche" && argv[i + 1]) niche = argv[++i]!.toLowerCase();
    else if (a === "--query" && argv[i + 1]) query = argv[++i]!;
    else if (a === "--window" && argv[i + 1]) {
      const w = argv[++i]!;
      if (w === "week" || w === "month" || w === "any") window = w;
    } else if (a === "--target" && argv[i + 1])
      target = Math.max(50, parseInt(argv[++i]!, 10) || 250);
    else if (a === "--limit" && argv[i + 1])
      limit = Math.min(50, Math.max(10, parseInt(argv[++i]!, 10) || 50));
    else if (a === "--dry-run") dryRun = true;
    else if (a === "--skip-score") score = false;
  }
  return { niche, query, window, target, limit, dryRun, score };
}

function progressPath(nicheKey: string) {
  return resolve(process.cwd(), `data/niche-depth-${nicheKey || "custom"}.json`);
}

function loadProgress(path: string): { channel_ids: string[]; queries_done: string[] } {
  if (!existsSync(path)) return { channel_ids: [], queries_done: [] };
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return { channel_ids: [], queries_done: [] };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const queries = args.query
    ? [args.query]
    : args.niche && NICHE_QUERIES[args.niche]
      ? NICHE_QUERIES[args.niche]!
      : [];
  if (!queries.length) {
    console.error(
      "Pass --niche fitness|gaming|... or --query \"keyword\". Niches:",
      Object.keys(NICHE_QUERIES).join(", ")
    );
    process.exit(1);
  }

  const key = args.niche || "custom";
  const pPath = progressPath(key);
  const progress = loadProgress(pPath);
  console.log(
    `[discover:niche] niche=${key} window=${args.window} target=${args.target} already=${progress.channel_ids.length}`
  );

  if (progress.channel_ids.length >= args.target) {
    console.log(
      `Already at target (${progress.channel_ids.length}/${args.target}). Pick another niche.`
    );
    return;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const seen = new Set(progress.channel_ids);
  let pageToken: string | undefined;

  for (const q of queries) {
    if (seen.size >= args.target) break;
    console.log(`\n── query: "${q}"`);
    pageToken = undefined;
    for (let page = 0; page < 6 && seen.size < args.target; page++) {
      const result = await searchRecentVideoChannels(q, args.limit, {
        publishedWindow: args.window,
        pageToken,
        regionCode: "US",
      });
      pageToken = result.nextPageToken;
      const newIds = result.channelIds.filter((id) => !seen.has(id));
      console.log(
        `  page ${page + 1}: ${result.channelIds.length} channels, ${newIds.length} new`
      );
      if (!newIds.length) {
        if (!pageToken) break;
        continue;
      }

      const details = await getChannelDetails(newIds);
      const now = new Date().toISOString();

      for (const item of details) {
        if (seen.size >= args.target) break;
        const mapped = mapYouTubeChannelToDb(item);
        seen.add(mapped.id);

        // Search results occasionally include bare/empty accounts -- don't
        // spend scoring quota on, or store, channels with nothing in them.
        if (!mapped.subscriber_count || !mapped.video_count) {
          console.log(`  ⊘ ${mapped.title} — empty (0 subs or 0 videos), skipped`);
          continue;
        }

        let patch: Record<string, unknown> = {
          discovery_source: `niche:${key}:${args.window}`,
        };
        if (args.score) {
          try {
            const { dbFields } = await scoreChannelById(mapped.id, {
              country: mapped.country,
              subscriberCount: mapped.subscriber_count,
              primaryNiche: args.niche || null,
            });
            patch = { ...dbFields, ...patch };
          } catch (err) {
            console.warn(
              `  score skip ${mapped.id}:`,
              err instanceof Error ? err.message : err
            );
          }
        }

        if (args.dryRun) {
          console.log(
            `  [dry] ${mapped.title} subs=${mapped.subscriber_count} q=${patch.quality_pass}`
          );
          continue;
        }

        let row = withYoutubeMetricsExpiry(
          { ...mapped, ...patch, last_updated: now, updated_at: now },
          now
        );
        let { error } = await supabase
          .from("channels")
          .upsert(row, { onConflict: "id" });
        if (error && isMissingQualityColumnError(error.message)) {
          ({ error } = await supabase
            .from("channels")
            .upsert(stripQualityFields(row), { onConflict: "id" }));
        }
        if (error) console.warn(`  upsert ${mapped.id}:`, error.message);
        else
          console.log(
            `  ✓ ${mapped.title} (${mapped.subscriber_count ?? "?"} subs, pass=${patch.quality_pass})`
          );
      }

      mkdirSync(resolve(pPath, ".."), { recursive: true });
      writeFileSync(
        pPath,
        JSON.stringify(
          {
            niche: key,
            updated_at: new Date().toISOString(),
            target: args.target,
            channel_ids: Array.from(seen),
            queries_done: Array.from(
              new Set([...progress.queries_done, q])
            ),
          },
          null,
          2
        )
      );

      if (!pageToken) break;
    }
  }

  console.log(
    `\nDepth: ${seen.size}/${args.target} unique channels for niche "${key}"`
  );
  if (seen.size < args.target) {
    console.log("Re-run with same --niche to go deeper, or add more query variants.");
  } else {
    console.log("Target reached — expand to the next niche.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
