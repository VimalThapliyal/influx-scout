/**
 * Shared by the seed validator and the direct census check: YouTube API key
 * rotation and turning a channels.list item into a `channels` row.
 */
import { withChannelClassification } from "../../src/lib/classify";
import { withYoutubeMetricsExpiry } from "../../src/lib/youtube-metrics";
import { calculateScore, classifyTier } from "../../src/lib/scoring";
import { extractEmailsFromText } from "./link-email";

const YT = "https://www.googleapis.com/youtube/v3";

export class QuotaError extends Error {}

/**
 * Key pool from YOUTUBE_API_KEYS="k1,k2,..." (falls back to YOUTUBE_API_KEY).
 * On a quota 403 we move to the next key; QuotaError once every key is spent.
 */
let keyPool: string[] | null = null;
let keyIdx = 0;

function getKeyPool(): string[] {
  if (keyPool) return keyPool;
  const multi = (process.env.YOUTUBE_API_KEYS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const single = (process.env.YOUTUBE_API_KEY || "").trim();
  const pool = multi.length ? multi : single ? [single] : [];
  if (!pool.length) throw new Error("YOUTUBE_API_KEY is not set");
  keyPool = pool;
  return pool;
}

export async function youtubeGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const pool = getKeyPool();
  for (let attempt = 0; attempt < pool.length; attempt++) {
    const url = new URL(`${YT}/${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("key", pool[keyIdx]!);

    const res = await fetch(url);
    const body: any = await res.json().catch(() => ({}));
    if (res.ok) return body as T;

    const msg: string = body?.error?.message || res.statusText;
    if (res.status === 403 && /quota|dailyLimitExceeded|exceeded your/i.test(msg)) {
      if (attempt < pool.length - 1) {
        keyIdx = (keyIdx + 1) % pool.length;
        console.warn(`  quota hit — rotating to API key #${keyIdx + 1}/${pool.length}`);
        continue;
      }
      throw new QuotaError(msg);
    }
    throw new Error(`YouTube ${path} ${res.status}: ${msg}`);
  }
  throw new QuotaError("all API keys exhausted");
}

export interface ChannelItem {
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
    hiddenSubscriberCount?: boolean;
  };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
  topicDetails?: { topicCategories?: string[] };
}

/** "https://en.wikipedia.org/wiki/Physical_fitness" → "Physical_fitness" */
export function topicNames(item: ChannelItem): string[] | null {
  const urls = item.topicDetails?.topicCategories;
  if (!urls?.length) return null;
  return urls.map((u) => decodeURIComponent(u.split("/").pop() ?? "")).filter(Boolean);
}

export function channelCounts(item: ChannelItem) {
  return {
    subs: item.statistics?.subscriberCount ? parseInt(item.statistics.subscriberCount, 10) : 0,
    videos: item.statistics?.videoCount ? parseInt(item.statistics.videoCount, 10) : 0,
    views: item.statistics?.viewCount ? parseInt(item.statistics.viewCount, 10) : 0,
  };
}

/** A new `channels` row from a channels.list item (snippet + statistics). */
export function buildChannelPayload(item: ChannelItem, now = new Date().toISOString()): Record<string, unknown> {
  const { subs, videos, views } = channelCounts(item);
  const custom = item.snippet?.customUrl;
  const handle = custom ? (custom.startsWith("@") ? custom : `@${custom}`) : null;

  const avgViews = videos > 0 ? Math.round(views / videos) : 0;
  const viewToSubRatio = subs > 0 ? avgViews / subs : 0;
  const publishedAt = item.snippet?.publishedAt;
  const accountAgeDays = publishedAt
    ? Math.floor((Date.now() - new Date(publishedAt).getTime()) / 86_400_000)
    : 0;
  const score =
    subs === 0 || videos === 0
      ? 0
      : calculateScore({
          subscriberCount: subs,
          avgViews,
          engagementRate: 0.02,
          uploadFrequency: 1,
          accountAgeDays,
          viewToSubRatio,
        });

  const base: Record<string, unknown> = {
    id: item.id,
    handle,
    title: item.snippet?.title || "Unknown",
    description: item.snippet?.description || null,
    thumbnail_url: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
    subscriber_count: subs,
    view_count: views,
    video_count: videos,
    avg_views_per_video: avgViews,
    influencer_score: score,
    tier: subs > 0 ? classifyTier(subs) : null,
    country: item.snippet?.country ?? null,
    published_at: item.snippet?.publishedAt ?? null,
    topic_categories: topicNames(item),
    data_source: "api",
    last_updated: now,
    updated_at: now,
  };

  // Public business email in the channel description (0 quota). MX validation runs later.
  const descEmail = extractEmailsFromText(item.snippet?.description ?? "")[0];
  if (descEmail) {
    base.email = descEmail;
    base.email_status = "found";
    base.email_source_type = "description";
    base.email_extracted_at = now;
  }

  return withYoutubeMetricsExpiry(withChannelClassification(base, now), now);
}
