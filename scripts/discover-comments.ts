#!/usr/bin/env tsx
/**
 * Comment-section discovery: popular recent videos → comment author channels.
 *
 *   npm run discover:comments -- --query "fitness workout" --videos 5 --authors 15
 */
import { loadEnv } from "./lib/env";
loadEnv();

import { createClient } from "@supabase/supabase-js";
import {
  searchRecentVideoChannels,
  getCommentAuthorChannelIds,
  getChannelDetails,
  mapYouTubeChannelToDb,
} from "../src/lib/youtube";
import { withYoutubeMetricsExpiry } from "../src/lib/youtube-metrics";
import { scoreChannelById } from "./lib/score-activity";
import {
  isMissingQualityColumnError,
  stripQualityFields,
} from "../src/lib/quality-gate";

function parseArgs(argv: string[]) {
  let query = "fitness usa";
  let videos = 5;
  let authors = 15;
  let dryRun = false;
  let score = true;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--query" && argv[i + 1]) query = argv[++i]!;
    else if (a === "--videos" && argv[i + 1])
      videos = Math.min(15, Math.max(1, parseInt(argv[++i]!, 10) || 5));
    else if (a === "--authors" && argv[i + 1])
      authors = Math.min(50, Math.max(5, parseInt(argv[++i]!, 10) || 15));
    else if (a === "--dry-run") dryRun = true;
    else if (a === "--skip-score") score = false;
  }
  return { query, videos, authors, dryRun, score };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `[discover:comments] query="${args.query}" videos=${args.videos} authors/video=${args.authors}`
  );

  // Recent popular-ish videos via date-ordered search
  const search = await searchRecentVideoChannels(args.query, args.videos, {
    publishedWindow: "month",
    regionCode: "US",
  });

  const videoIds =
    search.items
      .map((i) => i.id?.videoId)
      .filter(Boolean)
      .slice(0, args.videos) as string[];

  console.log(`Seed videos: ${videoIds.length}`);

  const authorIds = new Set<string>();
  for (const vid of videoIds) {
    try {
      const ids = await getCommentAuthorChannelIds(vid, args.authors);
      for (const id of ids) authorIds.add(id);
      console.log(`  video ${vid}: ${ids.length} authors`);
    } catch (err) {
      console.warn(
        `  comments skip ${vid}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // Drop the video uploaders themselves if we only want commenters — keep all
  const ids = Array.from(authorIds);
  console.log(`Unique commenter channels: ${ids.length}`);
  if (!ids.length) return;

  const details = await getChannelDetails(ids);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const now = new Date().toISOString();
  let upserted = 0;
  let skippedEmpty = 0;

  for (const item of details) {
    const mapped = mapYouTubeChannelToDb(item);
    // Comment authors are often bare accounts with no channel of their own --
    // don't pollute the library with 0-subscriber/0-video rows.
    if (!mapped.subscriber_count || !mapped.video_count) {
      skippedEmpty++;
      continue;
    }
    let patch: Record<string, unknown> = {
      discovery_source: "comment_authors",
    };
    if (args.score) {
      try {
        const { dbFields } = await scoreChannelById(mapped.id, {
          country: mapped.country,
          subscriberCount: mapped.subscriber_count,
        });
        patch = { ...dbFields, ...patch };
      } catch {
        /* continue */
      }
    }
    if (args.dryRun) {
      console.log(`  [dry] ${mapped.title} pass=${patch.quality_pass}`);
      continue;
    }
    const row = withYoutubeMetricsExpiry(
      { ...mapped, ...patch, last_updated: now, updated_at: now },
      now
    );
    let { error } = await supabase.from("channels").upsert(row, {
      onConflict: "id",
    });
    if (error && isMissingQualityColumnError(error.message)) {
      ({ error } = await supabase
        .from("channels")
        .upsert(stripQualityFields(row), { onConflict: "id" }));
    }
    if (error) console.warn(`  upsert ${mapped.id}:`, error.message);
    else {
      upserted++;
      console.log(`  ✓ ${mapped.title}`);
    }
  }

  console.log(
    `\nUpserted ${upserted} commenter channels. Skipped ${skippedEmpty} empty (0 subs or 0 videos).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
