#!/usr/bin/env tsx
/**
 * Promote light-saved channel_pending rows into channels via YouTube API.
 *
 * Quota: ~1 unit per handle resolve + 1 unit per 50 channels.list
 * Example: 500 pending with handles ≈ 500 + 10 = 510 units
 * Example: 500 pending with UC ids ≈ 10 units
 *
 * Usage:
 *   npm run enrich:pending
 *   npm run enrich:pending -- --limit 200 --usa-only
 *   npm run enrich:pending -- --limit 50 --min-subs 1000
 *   npm run enrich:pending -- --skip-link-email   (description email only)
 */

import { loadEnv } from "./lib/env";
import {
  isMissingMetricsColumnError,
  stripYoutubeMetricsFields,
  withYoutubeMetricsExpiry,
} from "../src/lib/youtube-metrics";
import { isPlausibleYouTubeHandle } from "../src/lib/youtube-url";
import { withChannelClassification } from "../src/lib/classify";
import {
  isMissingQualityColumnError,
  stripQualityFields,
} from "../src/lib/quality-gate";
import {
  scoreChannelById,
  QuotaExhaustedError as ScoreQuotaError,
} from "./lib/score-activity";

loadEnv();

import { createClient } from "@supabase/supabase-js";
import {
  enrichContactsFromDescription,
  extractEmailsFromText,
  classifySocialLinks,
  extractUrlsFromText,
  findEmailFromInstagramProfile,
} from "./lib/link-email";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const USA = "US";

interface CliArgs {
  limit: number;
  usaOnly: boolean;
  /** Secondary only — default 0 (one-pager: never primary gate). */
  minSubs: number;
  dryRun: boolean;
  linkEmail: boolean;
  /** Score last-5 videos (default on). */
  qualityScore: boolean;
  /** Reject pending that fail quality (default soft: still upsert). */
  hardQuality: boolean;
  /** Try Instagram public bio for email when YT has none. */
  tryInstagram: boolean;
}

interface PendingRow {
  id: string;
  url: string;
  channel_id: string | null;
  handle: string | null;
  title: string | null;
  subscriber_count: number | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    limit: 200,
    usaOnly: true,
    minSubs: 0,
    dryRun: false,
    linkEmail: true,
    qualityScore: true,
    hardQuality: false,
    tryInstagram: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit" && argv[i + 1]) {
      args.limit = Math.max(1, parseInt(argv[++i], 10) || 200);
    } else if (a === "--min-subs" && argv[i + 1]) {
      args.minSubs = Math.max(0, parseInt(argv[++i], 10) || 0);
    } else if (a === "--no-usa-only") {
      args.usaOnly = false;
    } else if (a === "--usa-only") {
      args.usaOnly = true;
    } else if (a === "--dry-run") {
      args.dryRun = true;
    } else if (a === "--skip-link-email") {
      args.linkEmail = false;
    } else if (a === "--link-email") {
      args.linkEmail = true;
    } else if (a === "--skip-quality") {
      args.qualityScore = false;
    } else if (a === "--hard-quality") {
      args.hardQuality = true;
    } else if (a === "--skip-instagram") {
      args.tryInstagram = false;
    } else if (a === "--help" || a === "-h") {
      console.log(`
Enrich pending light-saves into channels

  --limit <n>         Max pending rows (default 200)
  --min-subs <n>      Secondary filter only (default 0)
  --usa-only          Keep only country=US (default)
  --no-usa-only       Skip USA filter
  --link-email        Public emails from description links (default)
  --skip-link-email
  --try-instagram     IG bio email fallback (default on)
  --skip-instagram
  --skip-quality      Skip last-5 video quality scoring
  --hard-quality      Reject pending that fail quality gates
  --dry-run
`);
      process.exit(0);
    }
  }
  return args;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

function getApiKey() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  return key;
}

class QuotaExhaustedError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "QuotaExhaustedError";
  }
}

function isQuotaBody(status: number, body: string): boolean {
  const lower = body.toLowerCase();
  return (
    (status === 403 || status === 429) &&
    (lower.includes("quotaexceeded") ||
      lower.includes("exceeded your") ||
      lower.includes("dailylimitexceeded"))
  );
}

async function youtubeGet<T>(
  endpoint: string,
  params: Record<string, string>
): Promise<T> {
  const url = new URL(`${YOUTUBE_API_BASE}/${endpoint}`);
  url.searchParams.set("key", getApiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    if (isQuotaBody(res.status, body)) {
      throw new QuotaExhaustedError(
        `YouTube API quota exhausted (HTTP ${res.status}). Resets midnight Pacific (~12:30 PM IST). Stop enrich until then.`
      );
    }
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 400)}`);
  }
  return res.json() as Promise<T>;
}

async function resolveHandle(handle: string): Promise<string | null> {
  const h = handle.replace(/^@/, "");
  const data = await youtubeGet<{ items?: Array<{ id: string }> }>("channels", {
    part: "id",
    forHandle: h,
  });
  return data.items?.[0]?.id ?? null;
}

function mapChannel(item: {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    customUrl?: string;
    publishedAt?: string;
    country?: string;
    thumbnails?: { medium?: { url: string }; default?: { url: string } };
  };
  statistics?: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
  };
  brandingSettings?: { channel?: { description?: string } };
}) {
  const description = item.snippet?.description ?? "";
  const brandingDesc = item.brandingSettings?.channel?.description ?? "";
  const fullText = `${description} ${brandingDesc}`.trim();
  const descEmails = extractEmailsFromText(fullText);
  const social = classifySocialLinks(extractUrlsFromText(fullText));
  const subs = item.statistics?.subscriberCount
    ? parseInt(item.statistics.subscriberCount, 10)
    : null;
  const views = item.statistics?.viewCount
    ? parseInt(item.statistics.viewCount, 10)
    : 0;
  const videos = item.statistics?.videoCount
    ? parseInt(item.statistics.videoCount, 10)
    : 0;
  const handle = item.snippet?.customUrl
    ? item.snippet.customUrl.startsWith("@")
      ? item.snippet.customUrl
      : `@${item.snippet.customUrl}`
    : null;

  let tier: string | null = null;
  if (subs != null) {
    if (subs >= 1_000_000) tier = "mega";
    else if (subs >= 500_000) tier = "macro";
    else if (subs >= 100_000) tier = "mid";
    else if (subs >= 10_000) tier = "micro";
    else tier = "nano";
  }

  return {
    id: item.id,
    handle,
    title: item.snippet?.title ?? "Unknown",
    description: description || null,
    thumbnail_url:
      item.snippet?.thumbnails?.medium?.url ??
      item.snippet?.thumbnails?.default?.url ??
      null,
    subscriber_count: subs,
    view_count: views,
    video_count: videos,
    country: item.snippet?.country ?? null,
    published_at: item.snippet?.publishedAt ?? null,
    email: descEmails[0] ?? null,
    website: social.website,
    instagram: social.instagram,
    twitter: social.twitter,
    tiktok: social.tiktok,
    data_source: "contributor",
    tier,
    last_updated: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = getSupabase();

  console.log(
    `[enrich:pending] limit=${args.limit} usaOnly=${args.usaOnly} minSubs=${args.minSubs} quality=${args.qualityScore} hard=${args.hardQuality} ig=${args.tryInstagram} dryRun=${args.dryRun}`
  );

  const { data: pending, error } = await supabase
    .from("channel_pending")
    .select("id, url, channel_id, handle, title, subscriber_count")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(args.limit);

  if (error) throw new Error(error.message);
  const rows = (pending ?? []) as PendingRow[];
  console.log(`[enrich:pending] loaded ${rows.length} pending rows`);

  if (rows.length === 0) {
    console.log("Nothing to enrich.");
    return;
  }

  // Resolve handles → channel ids
  const pendingIdToChannelId = new Map<string, string>();
  let resolveFails = 0;

  for (const row of rows) {
    if (row.channel_id) {
      if (!/^UC[\w-]{22}$/i.test(row.channel_id)) {
        resolveFails++;
        if (!args.dryRun) {
          await supabase
            .from("channel_pending")
            .update({
              status: "failed",
              reject_reason: "invalid/truncated YouTube channel id",
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
        }
        continue;
      }
      pendingIdToChannelId.set(row.id, row.channel_id);
      continue;
    }
    if (!row.handle) {
      resolveFails++;
      if (!args.dryRun) {
        await supabase
          .from("channel_pending")
          .update({
            status: "failed",
            reject_reason: "No channel_id or handle",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      }
      continue;
    }
    if (!isPlausibleYouTubeHandle(row.handle)) {
      resolveFails++;
      if (!args.dryRun) {
        await supabase
          .from("channel_pending")
          .update({
            status: "failed",
            reject_reason: "junk handle (css/domain noise)",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      }
      continue;
    }
    try {
      const id = await resolveHandle(row.handle);
      if (!id) {
        resolveFails++;
        if (!args.dryRun) {
          await supabase
            .from("channel_pending")
            .update({
              status: "failed",
              reject_reason: "Could not resolve handle",
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
        }
        continue;
      }
      pendingIdToChannelId.set(row.id, id);
      if (!args.dryRun) {
        await supabase
          .from("channel_pending")
          .update({ channel_id: id, updated_at: new Date().toISOString() })
          .eq("id", row.id);
      }
      console.log(`  resolved ${row.handle} → ${id}`);
    } catch (err) {
      if (err instanceof QuotaExhaustedError) {
        console.error(`\n⛔ ${err.message}`);
        console.error(
          "Leaving remaining pending rows untouched — retry after reset.\n"
        );
        break;
      }
      resolveFails++;
      console.warn(
        `  resolve failed ${row.handle}:`,
        err instanceof Error ? err.message : err
      );
      if (!args.dryRun) {
        await supabase
          .from("channel_pending")
          .update({
            status: "failed",
            reject_reason:
              err instanceof Error ? err.message.slice(0, 200) : "resolve error",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      }
    }
  }

  const channelIds = Array.from(new Set(pendingIdToChannelId.values()));
  console.log(
    `[enrich:pending] ${channelIds.length} channel ids ready (${resolveFails} resolve fails)`
  );

  if (channelIds.length === 0) return;

  // Batch channels.list (include uploads playlist for quality scoring)
  const details: Array<
    ReturnType<typeof mapChannel> & { uploadsPlaylistId?: string | null }
  > = [];
  try {
    for (let i = 0; i < channelIds.length; i += 50) {
      const batch = channelIds.slice(i, i + 50);
      const data = await youtubeGet<{
        items?: Array<
          Parameters<typeof mapChannel>[0] & {
            contentDetails?: { relatedPlaylists?: { uploads?: string } };
          }
        >;
      }>("channels", {
        part: "snippet,statistics,brandingSettings,contentDetails",
        id: batch.join(","),
      });
      for (const item of data.items ?? []) {
        details.push({
          ...mapChannel(item),
          uploadsPlaylistId:
            item.contentDetails?.relatedPlaylists?.uploads ?? null,
        });
      }
      console.log(
        `  channels.list batch ${Math.floor(i / 50) + 1}: ${data.items?.length ?? 0} items`
      );
    }
  } catch (err) {
    if (err instanceof QuotaExhaustedError) {
      console.error(`\n⛔ ${err.message}`);
      console.error("Partial enrich only — remaining pending stay queued.\n");
    } else {
      throw err;
    }
  }

  let imported = 0;
  let rejectedUsa = 0;
  let rejectedSubs = 0;
  let rejectedQuality = 0;
  let qualityPass = 0;
  let qualityFail = 0;
  let linkEmailsFound = 0;

  for (const mapped of details) {
    const country = mapped.country?.toUpperCase() ?? null;
    const subs = mapped.subscriber_count ?? 0;

    const pendingIds = Array.from(pendingIdToChannelId.entries())
      .filter(([, cid]) => cid === mapped.id)
      .map(([pid]) => pid);

    if (args.usaOnly && country && country !== USA) {
      rejectedUsa++;
      if (!args.dryRun) {
        await supabase
          .from("channel_pending")
          .update({
            status: "rejected",
            reject_reason: `non-USA (${country})`,
            updated_at: new Date().toISOString(),
          })
          .in("id", pendingIds);
      }
      continue;
    }

    if (args.minSubs > 0 && subs < args.minSubs) {
      rejectedSubs++;
      if (!args.dryRun) {
        await supabase
          .from("channel_pending")
          .update({
            status: "rejected",
            reject_reason: `below min subs (${subs})`,
            updated_at: new Date().toISOString(),
          })
          .in("id", pendingIds);
      }
      continue;
    }

    // Public email from Linktree / website links in description (0 YouTube quota)
    if (args.linkEmail && !mapped.email && mapped.description) {
      try {
        const contacts = await enrichContactsFromDescription(mapped.description, {
          existingEmail: null,
          fetchLinks: true,
          tryInstagram: args.tryInstagram,
        });
        if (contacts.email) {
          mapped.email = contacts.email;
          linkEmailsFound++;
          console.log(
            `  ✉ link-email ${mapped.title}: ${contacts.email} ← ${contacts.emailSource}`
          );
        }
        if (!mapped.website && contacts.website) mapped.website = contacts.website;
        if (!mapped.instagram && contacts.instagram)
          mapped.instagram = contacts.instagram;
        if (!mapped.twitter && contacts.twitter) mapped.twitter = contacts.twitter;
        if (!mapped.tiktok && contacts.tiktok) mapped.tiktok = contacts.tiktok;
      } catch (err) {
        console.warn(
          `  link-email skip ${mapped.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    // Instagram bio fallback when still no email
    if (args.tryInstagram && !mapped.email && mapped.instagram) {
      try {
        const ig = await findEmailFromInstagramProfile(mapped.instagram);
        if (ig?.email) {
          mapped.email = ig.email;
          linkEmailsFound++;
          console.log(`  ✉ instagram ${mapped.title}: ${ig.email}`);
        }
      } catch {
        /* ignore IG failures */
      }
    }

    // Last-5 quality gate (soft by default)
    let qualityPatch: Record<string, unknown> = {
      discovery_source: "pending_enrich",
    };
    if (args.qualityScore) {
      try {
        const { score, dbFields } = await scoreChannelById(mapped.id, {
          country: mapped.country,
          subscriberCount: mapped.subscriber_count,
          uploadsPlaylistId: mapped.uploadsPlaylistId,
        });
        qualityPatch = { ...dbFields, discovery_source: "pending_enrich" };
        if (score.quality_pass) qualityPass++;
        else qualityFail++;

        if (args.hardQuality && !score.quality_pass) {
          rejectedQuality++;
          if (!args.dryRun) {
            await supabase
              .from("channel_pending")
              .update({
                status: "rejected",
                reject_reason: `quality: ${score.quality_fail_reasons.join(",")}`,
                updated_at: new Date().toISOString(),
              })
              .in("id", pendingIds);
          }
          console.log(
            `  ✗ quality ${mapped.title}: ${score.quality_fail_reasons.join(", ")}`
          );
          continue;
        }
      } catch (err) {
        if (err instanceof ScoreQuotaError || err instanceof QuotaExhaustedError) {
          console.error(`\n⛔ Quality scoring quota: ${err.message}`);
          break;
        }
        console.warn(
          `  quality skip ${mapped.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    if (!args.dryRun) {
      const { data: existing } = await supabase
        .from("channels")
        .select("id, email, website, instagram, twitter, tiktok, data_source")
        .eq("id", mapped.id)
        .maybeSingle();

      let payload: Record<string, unknown> = withYoutubeMetricsExpiry(
        withChannelClassification(
          { ...mapped, ...qualityPatch },
          mapped.last_updated ?? new Date().toISOString()
        ),
        mapped.last_updated ?? new Date().toISOString()
      );
      delete (payload as { uploadsPlaylistId?: unknown }).uploadsPlaylistId;

      if (existing?.data_source === "scraped" || existing?.data_source === "hybrid") {
        payload.data_source = existing.data_source;
      }
      if (existing?.email && !mapped.email) {
        delete payload.email;
      }
      if (existing?.website && !mapped.website) payload.website = existing.website;
      if (existing?.instagram && !mapped.instagram)
        payload.instagram = existing.instagram;
      if (existing?.twitter && !mapped.twitter) payload.twitter = existing.twitter;
      if (existing?.tiktok && !mapped.tiktok) payload.tiktok = existing.tiktok;

      const upsertOnce = async (row: Record<string, unknown>) =>
        supabase.from("channels").upsert(row, { onConflict: "id" });

      let { error: upsertErr } = await upsertOnce(payload);
      if (upsertErr && isMissingMetricsColumnError(upsertErr.message)) {
        ({ error: upsertErr } = await upsertOnce(
          stripYoutubeMetricsFields(payload)
        ));
      }
      if (upsertErr && isMissingQualityColumnError(upsertErr.message)) {
        console.warn(
          "  quality columns missing — run migration 019. Upserting without quality fields."
        );
        ({ error: upsertErr } = await upsertOnce(stripQualityFields(payload)));
      }
      if (upsertErr) {
        console.warn(`  upsert failed ${mapped.id}:`, upsertErr.message);
        await supabase
          .from("channel_pending")
          .update({
            status: "failed",
            reject_reason: upsertErr.message.slice(0, 200),
            updated_at: new Date().toISOString(),
          })
          .in("id", pendingIds);
        continue;
      }

      await supabase
        .from("channel_pending")
        .update({
          status: "enriched",
          updated_at: new Date().toISOString(),
        })
        .in("id", pendingIds);
    }

    imported++;
    const q =
      qualityPatch.quality_pass === true
        ? "pass"
        : qualityPatch.quality_pass === false
          ? "fail"
          : "?";
    console.log(
      `  ✓ ${mapped.title} (${mapped.subscriber_count ?? "?"} subs, ${mapped.country ?? "?"}, q=${q}${mapped.email ? ", email" : ""})`
    );
  }

  // Channel IDs YouTube returned nothing for (deleted / fake / truncated)
  const foundIds = new Set(details.map((d) => d.id));
  const notFoundPendingIds = Array.from(pendingIdToChannelId.entries())
    .filter(([, cid]) => !foundIds.has(cid))
    .map(([pid]) => pid);
  let notFound = 0;
  if (notFoundPendingIds.length > 0 && !args.dryRun) {
    notFound = notFoundPendingIds.length;
    for (let i = 0; i < notFoundPendingIds.length; i += 100) {
      const batch = notFoundPendingIds.slice(i, i + 100);
      await supabase
        .from("channel_pending")
        .update({
          status: "failed",
          reject_reason: "channel not found on YouTube",
          updated_at: new Date().toISOString(),
        })
        .in("id", batch);
    }
    console.log(`  marked ${notFound} as failed (not found on YouTube)`);
  }

  console.log(`
[enrich:pending] done
  imported: ${imported}
  quality pass/fail: ${qualityPass}/${qualityFail}
  rejected quality (hard): ${rejectedQuality}
  link/IG emails found: ${linkEmailsFound}
  rejected non-USA: ${rejectedUsa}
  rejected min-subs: ${rejectedSubs}
  resolve fails: ${resolveFails}
  not found: ${notFound || notFoundPendingIds.length}
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
