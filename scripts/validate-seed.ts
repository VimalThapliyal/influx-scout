#!/usr/bin/env tsx
/**
 * Seed validator — cheapest possible YouTube validation of the channel_seed pool.
 *
 * Canonical `channel` seeds are validated 50-at-a-time via channels.list (1 unit / 50).
 * `handle`/`user` seeds are resolved individually via forHandle / forUsername (1 unit each).
 * `custom` seeds are skipped (only search.list can resolve them — 100 units — too costly).
 *
 * Live channels that clear the subscriber/video floor are promoted into `channels`;
 * dead / hidden / too-small channels are marked so we never spend quota on them again.
 *
 *   npm run census:validate                      # default: 4000 canonical seeds (~80 units)
 *   npm run census:validate -- --limit 10000
 *   npm run census:validate -- --formats channel,handle
 *   npm run census:validate -- --min-subs 1000 --min-videos 3
 *   npm run census:validate -- --max-units 9000   # stop before the daily quota is gone
 *   npm run census:validate -- --with-activity    # also fetch latest upload date (pricier)
 *   npm run census:validate -- --dry-run
 */
import { loadEnv } from "./lib/env";
loadEnv();

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  isMissingClassificationColumnError,
  stripClassificationFields,
} from "../src/lib/classify";
import {
  isMissingMetricsColumnError,
  stripYoutubeMetricsFields,
} from "../src/lib/youtube-metrics";
import {
  QuotaError,
  buildChannelPayload,
  channelCounts,
  youtubeGet,
  type ChannelItem,
} from "./lib/channel-payload";

type SeedFormat = "channel" | "handle" | "user" | "custom";

interface SeedRow {
  seed_key: string;
  channel_id: string | null;
  handle: string | null;
  username: string | null;
  id_format: SeedFormat;
}

interface Args {
  limit: number;
  formats: SeedFormat[];
  minSubs: number;
  minVideos: number;
  maxUnits: number;
  withActivity: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  let limit = 4000;
  let formats: SeedFormat[] = ["channel"];
  let minSubs = 1000;
  let minVideos = 3;
  let maxUnits = 9000;
  let withActivity = false;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit" && argv[i + 1])
      limit = Math.max(1, parseInt(argv[++i]!, 10) || 4000);
    else if (a === "--formats" && argv[i + 1])
      formats = argv[++i]!
        .split(",")
        .map((f) => f.trim().toLowerCase())
        .filter((f): f is SeedFormat =>
          ["channel", "handle", "user"].includes(f)
        );
    else if (a === "--min-subs" && argv[i + 1])
      minSubs = Math.max(0, parseInt(argv[++i]!, 10) || 0);
    else if (a === "--min-videos" && argv[i + 1])
      minVideos = Math.max(0, parseInt(argv[++i]!, 10) || 0);
    else if (a === "--max-units" && argv[i + 1])
      maxUnits = Math.max(1, parseInt(argv[++i]!, 10) || 9000);
    else if (a === "--with-activity") withActivity = true;
    else if (a === "--dry-run") dryRun = true;
  }
  if (formats.length === 0) formats = ["channel"];
  return { limit, formats, minSubs, minVideos, maxUnits, withActivity, dryRun };
}

function makeSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function fetchSeeds(
  supabase: SupabaseClient,
  format: SeedFormat,
  limit: number
): Promise<SeedRow[]> {
  const { data, error } = await supabase
    .from("channel_seed")
    .select("seed_key, channel_id, handle, username, id_format")
    .eq("status", "new")
    .eq("id_format", format)
    .order("discovered_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as SeedRow[]) ?? [];
}

async function markSeeds(
  supabase: SupabaseClient,
  keys: string[],
  patch: Record<string, unknown>
) {
  // Chunk to keep the PostgREST `in.(…)` URL well under length limits.
  for (let i = 0; i < keys.length; i += 100) {
    const chunk = keys.slice(i, i + 100);
    const { error } = await supabase
      .from("channel_seed")
      .update(patch)
      .in("seed_key", chunk);
    if (error) console.warn(`  seed update failed: ${error.message}`);
  }
}

async function latestUploadAt(uploadsPlaylistId: string): Promise<string | null> {
  try {
    const data = await youtubeGet<{
      items?: Array<{ contentDetails?: { videoPublishedAt?: string } }>;
    }>("playlistItems", {
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: "1",
    });
    return data.items?.[0]?.contentDetails?.videoPublishedAt ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = makeSupabase();

  let unitsUsed = 0;
  let promoted = 0;
  let deadCount = 0;
  let tooSmall = 0;
  let quotaHit = false;

  const part = args.withActivity
    ? "snippet,statistics,contentDetails"
    : "snippet,statistics";

  const validatedKeys: string[] = [];
  const deadKeys: string[] = [];
  const skippedKeys: string[] = [];
  const payloads: Array<Record<string, unknown>> = [];

  const flushMarks = async () => {
    if (args.dryRun) {
      validatedKeys.length = 0;
      deadKeys.length = 0;
      skippedKeys.length = 0;
      return;
    }
    const now = new Date().toISOString();
    await markSeeds(supabase, validatedKeys, {
      status: "validated",
      in_library: true,
      validated_at: now,
    });
    await markSeeds(supabase, deadKeys, { status: "dead", validated_at: now });
    await markSeeds(supabase, skippedKeys, { status: "skipped", validated_at: now });
    validatedKeys.length = 0;
    deadKeys.length = 0;
    skippedKeys.length = 0;
  };

  const promoteBatch = async () => {
    if (payloads.length === 0) return;
    if (args.dryRun) {
      promoted += payloads.length;
      payloads.length = 0;
      return;
    }
    for (const payload of payloads) {
      // A single slow insert (DB busy) shouldn't abort the whole run: retry timeouts.
      let { error } = await supabase
        .from("channels")
        .upsert(payload, { onConflict: "id", ignoreDuplicates: true });
      for (let attempt = 1; error && /statement timeout/i.test(error.message) && attempt <= 3; attempt++) {
        await new Promise((r) => setTimeout(r, attempt * 5000));
        ({ error } = await supabase
          .from("channels")
          .upsert(payload, { onConflict: "id", ignoreDuplicates: true }));
      }
      if (error && isMissingMetricsColumnError(error.message)) {
        ({ error } = await supabase
          .from("channels")
          .upsert(stripYoutubeMetricsFields(payload), { onConflict: "id", ignoreDuplicates: true }));
      }
      if (error && isMissingClassificationColumnError(error.message)) {
        ({ error } = await supabase.from("channels").upsert(
          stripClassificationFields(stripYoutubeMetricsFields(payload)),
          { onConflict: "id", ignoreDuplicates: true }
        ));
      }
      if (error) {
        throw new Error(`Channel insert ${payload.id} failed: ${error.message}`);
      }
      promoted++;
    }
    payloads.length = 0;
  };

  const consider = async (item: ChannelItem, seedKey: string) => {
    const { subs, videos } = channelCounts(item);

    if (subs < args.minSubs || videos < args.minVideos) {
      tooSmall++;
      skippedKeys.push(seedKey);
      return;
    }

    const now = new Date().toISOString();
    const payload = buildChannelPayload(item, now);
    if (args.withActivity) {
      const uploads = item.contentDetails?.relatedPlaylists?.uploads;
      if (uploads) {
        const latest = await latestUploadAt(uploads);
        unitsUsed += 1;
        if (latest) payload.latest_upload_at = latest;
      }
    }
    payloads.push(payload);
    validatedKeys.push(seedKey);
  };

  // PostgREST caps a single select at ~1000 rows, so we page: fetch a batch of
  // 'new' seeds, validate + mark them (which removes them from the queue), repeat.
  const PAGE_SIZE = 500;

  try {
    for (const format of args.formats) {
      let processed = 0;
      let emptyReported = false;

      while (!quotaHit && unitsUsed < args.maxUnits && processed < args.limit) {
        const want = Math.min(PAGE_SIZE, args.limit - processed);
        const seeds = await fetchSeeds(supabase, format, want);
        if (seeds.length === 0) {
          if (processed === 0 && !emptyReported) {
            console.log(`[${format}] no 'new' seeds.`);
            emptyReported = true;
          }
          break;
        }

        if (format === "channel") {
          const byId = new Map<string, string>(); // channelId → seedKey
          for (const s of seeds)
            if (s.channel_id) byId.set(s.channel_id, s.seed_key);
          const ids = Array.from(byId.keys());

          for (let i = 0; i < ids.length; i += 50) {
            if (unitsUsed >= args.maxUnits) break;
            const batch = ids.slice(i, i + 50);
            const data = await youtubeGet<{ items?: ChannelItem[] }>("channels", {
              part,
              id: batch.join(","),
            });
            unitsUsed += 1;

            const alive = new Set<string>();
            for (const item of data.items ?? []) {
              alive.add(item.id);
              await consider(item, byId.get(item.id)!);
            }
            // Any id not returned is terminated/hidden → dead
            for (const id of batch) {
              if (!alive.has(id)) {
                deadCount++;
                deadKeys.push(byId.get(id)!);
              }
            }
            await promoteBatch();
          }
        } else {
          // handle / user — resolve one at a time
          const lookupKey = format === "handle" ? "forHandle" : "forUsername";
          for (const s of seeds) {
            if (unitsUsed >= args.maxUnits) break;
            const value = format === "handle" ? s.handle : s.username;
            if (!value) {
              skippedKeys.push(s.seed_key);
              continue;
            }
            const data = await youtubeGet<{ items?: ChannelItem[] }>("channels", {
              part,
              [lookupKey]: value.replace(/^@/, ""),
            });
            unitsUsed += 1;
            const item = data.items?.[0];
            if (!item) {
              deadCount++;
              deadKeys.push(s.seed_key);
              continue;
            }
            // stamp resolved canonical id back onto the seed
            if (!args.dryRun) {
              await supabase
                .from("channel_seed")
                .update({ channel_id: item.id })
                .eq("seed_key", s.seed_key);
            }
            await consider(item, s.seed_key);
            await promoteBatch();
          }
        }

        await promoteBatch();
        await flushMarks();
        processed += seeds.length;
        console.log(
          `[${format}] processed ${processed} — promoted ${promoted}, small ${tooSmall}, dead ${deadCount}, ~${unitsUsed}u`
        );
      }
    }
  } catch (err) {
    if (err instanceof QuotaError) {
      quotaHit = true;
      console.warn(`\nQuota exhausted: ${err.message}`);
    } else {
      throw err;
    }
  }

  await promoteBatch();
  await flushMarks();

  console.log("\nSeed validation summary");
  console.log("-----------------------");
  console.log(`units used     ~${unitsUsed}`);
  console.log(`promoted       ${promoted}`);
  console.log(`too small      ${tooSmall} (< ${args.minSubs} subs or < ${args.minVideos} videos)`);
  console.log(`dead/hidden    ${deadCount}`);
  if (quotaHit) console.log(`\nStopped early — YouTube quota hit. Resume tomorrow.`);
  if (args.dryRun) console.log(`\nDRY RUN — no writes performed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
