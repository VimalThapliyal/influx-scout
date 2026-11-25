/**
 * Fetch last N uploads + score quality (for CLI / enrich:pending).
 * Uses script-local YouTube fetch (same key as enrich-pending).
 */
import {
  scoreChannelQuality,
  qualityFieldsForDb,
  type RecentVideoSnapshot,
  type QualityScoreResult,
} from "../../src/lib/quality-gate";
import { calculateScore, classifyTier } from "../../src/lib/scoring";

/**
 * influencer_score is otherwise only set at validate-time from lifetime
 * stats. Once a channel is quality-scored we have last-5 avg views/
 * engagement -- real recent signal, not a lifetime average -- so
 * recompute the score from that instead of leaving the stale value.
 */
function influencerScoreFields(
  score: QualityScoreResult,
  subscriberCount: number | null | undefined
): { influencer_score: number; tier: ReturnType<typeof classifyTier> | null } {
  const subs = subscriberCount ?? 0;
  if (subs === 0) return { influencer_score: 0, tier: null };
  const avgViews = score.avg_views_last5 ?? 0;
  const engagementRate = score.engagement_last5 ?? 0.02;
  const viewToSubRatio = avgViews > 0 ? avgViews / subs : 0;
  return {
    influencer_score: calculateScore({
      subscriberCount: subs,
      avgViews,
      engagementRate,
      uploadFrequency: 1,
      accountAgeDays: 0,
      viewToSubRatio,
    }),
    tier: classifyTier(subs),
  };
}

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

/**
 * Key pool: set YOUTUBE_API_KEYS="key1,key2,key3" to multiply daily quota
 * (each Google Cloud project gets its own 10k units/day). Falls back to
 * YOUTUBE_API_KEY. On a quota 403 we rotate to the next key automatically.
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

export function keyPoolSize(): number {
  return getKeyPool().length;
}

export class QuotaExhaustedError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "QuotaExhaustedError";
  }
}

async function youtubeGet<T>(
  path: string,
  params: Record<string, string>
): Promise<T> {
  const pool = getKeyPool();

  for (let attempt = 0; attempt < pool.length; attempt++) {
    const url = new URL(`${YOUTUBE_API_BASE}/${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("key", pool[keyIdx]!);

    const res = await fetch(url);
    const text = await res.text();
    if (res.ok) return JSON.parse(text) as T;

    if (res.status === 403 && /quota|dailyLimit/i.test(text)) {
      if (attempt < pool.length - 1) {
        keyIdx = (keyIdx + 1) % pool.length;
        console.warn(`  quota hit — rotating to API key #${keyIdx + 1}/${pool.length}`);
        continue;
      }
      throw new QuotaExhaustedError(text.slice(0, 200));
    }
    throw new Error(`YouTube ${path} ${res.status}: ${text.slice(0, 300)}`);
  }
  throw new QuotaExhaustedError("all API keys exhausted");
}

/** Uploads playlist id is deterministically UC→UU (saves a channels.list call). */
export function uploadsPlaylistIdFromChannelId(
  channelId: string
): string | null {
  return /^UC[0-9A-Za-z_-]{22}$/.test(channelId)
    ? "UU" + channelId.slice(2)
    : null;
}

export async function fetchRecentVideosForChannel(
  channelId: string,
  maxResults = 5,
  uploadsPlaylistId?: string | null
): Promise<RecentVideoSnapshot[]> {
  let uploadsId = uploadsPlaylistId ?? null;
  if (!uploadsId) {
    const ch = await youtubeGet<{
      items?: Array<{
        contentDetails?: { relatedPlaylists?: { uploads?: string } };
      }>;
    }>("channels", { part: "contentDetails", id: channelId });
    uploadsId =
      ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
  }
  if (!uploadsId) return [];

  const playlist = await youtubeGet<{
    items?: Array<{
      contentDetails?: { videoId?: string };
      snippet?: { resourceId?: { videoId?: string } };
    }>;
  }>("playlistItems", {
    part: "contentDetails,snippet",
    playlistId: uploadsId,
    maxResults: String(maxResults),
  });

  const ids =
    playlist.items
      ?.map((i) => i.contentDetails?.videoId ?? i.snippet?.resourceId?.videoId)
      .filter(Boolean) ?? [];
  if (!ids.length) return [];

  const videos = await youtubeGet<{
    items?: Array<{
      id: string;
      snippet?: {
        title?: string;
        description?: string;
        tags?: string[];
        publishedAt?: string;
      };
      statistics?: {
        viewCount?: string;
        likeCount?: string;
        commentCount?: string;
      };
      contentDetails?: { duration?: string };
    }>;
  }>("videos", {
    part: "snippet,statistics,contentDetails",
    id: ids.join(","),
  });

  return (videos.items ?? []).map((v) => ({
    id: v.id,
    title: v.snippet?.title ?? "Untitled",
    description: v.snippet?.description ?? null,
    tags: v.snippet?.tags ?? null,
    view_count: parseInt(v.statistics?.viewCount ?? "0", 10),
    like_count: v.statistics?.likeCount
      ? parseInt(v.statistics.likeCount, 10)
      : null,
    comment_count: v.statistics?.commentCount
      ? parseInt(v.statistics.commentCount, 10)
      : null,
    published_at: v.snippet?.publishedAt ?? "",
    duration: v.contentDetails?.duration ?? null,
  }));
}

/** Phase 1: recent video IDs for one channel — 1 unit (playlistItems.list). */
export async function fetchRecentVideoIds(
  channelId: string,
  maxResults = 5,
  uploadsPlaylistId?: string | null
): Promise<string[]> {
  const uploadsId =
    uploadsPlaylistId ?? uploadsPlaylistIdFromChannelId(channelId);
  if (!uploadsId) return [];
  const playlist = await youtubeGet<{
    items?: Array<{
      contentDetails?: { videoId?: string };
      snippet?: { resourceId?: { videoId?: string } };
    }>;
  }>("playlistItems", {
    part: "contentDetails",
    playlistId: uploadsId,
    maxResults: String(maxResults),
  });
  return (
    playlist.items
      ?.map((i) => i.contentDetails?.videoId ?? i.snippet?.resourceId?.videoId)
      .filter((v): v is string => Boolean(v)) ?? []
  );
}

/** Phase 2: video stats for MANY channels at once — 1 unit per 50 IDs. */
export async function fetchVideosByIds(
  videoIds: string[]
): Promise<{ videos: Map<string, RecentVideoSnapshot>; units: number }> {
  const map = new Map<string, RecentVideoSnapshot>();
  const unique = [...new Set(videoIds.filter(Boolean))];
  let units = 0;

  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const data = await youtubeGet<{
      items?: Array<{
        id: string;
        snippet?: {
          title?: string;
          description?: string;
          tags?: string[];
          publishedAt?: string;
        };
        statistics?: {
          viewCount?: string;
          likeCount?: string;
          commentCount?: string;
        };
        contentDetails?: { duration?: string };
      }>;
    }>("videos", {
      part: "snippet,statistics,contentDetails",
      id: batch.join(","),
    });
    units += 1;
    for (const v of data.items ?? []) {
      map.set(v.id, {
        id: v.id,
        title: v.snippet?.title ?? "Untitled",
        description: v.snippet?.description ?? null,
        tags: v.snippet?.tags ?? null,
        view_count: parseInt(v.statistics?.viewCount ?? "0", 10),
        like_count: v.statistics?.likeCount
          ? parseInt(v.statistics.likeCount, 10)
          : null,
        comment_count: v.statistics?.commentCount
          ? parseInt(v.statistics.commentCount, 10)
          : null,
        published_at: v.snippet?.publishedAt ?? "",
        duration: v.contentDetails?.duration ?? null,
      });
    }
  }
  return { videos: map, units };
}

export interface BatchScoreInput {
  id: string;
  country?: string | null;
  subscriberCount?: number | null;
  primaryNiche?: string | null;
}

type DbFields = ReturnType<typeof qualityFieldsForDb> &
  ReturnType<typeof influencerScoreFields>;

export interface BatchScoreOutput {
  id: string;
  score?: QualityScoreResult;
  dbFields?: DbFields;
  error?: string;
}

/**
 * Score a GROUP of channels while sharing videos.list calls across them.
 *
 * Cost: N units (playlistItems, one per channel) + ceil(N*5/50) units (videos).
 * With 10 channels per group that's ~1.1 units/channel instead of 2 — a 45% cut.
 */
export async function scoreChannelsBatched(
  channels: BatchScoreInput[],
  videosPerChannel = 5
): Promise<{ results: BatchScoreOutput[]; units: number }> {
  let units = 0;
  const results: BatchScoreOutput[] = [];
  const idsByChannel = new Map<string, string[]>();
  const allIds: string[] = [];

  // Phase 1 — recent video ids per channel (1 unit each)
  for (const ch of channels) {
    try {
      const ids = await fetchRecentVideoIds(ch.id, videosPerChannel);
      units += 1;
      idsByChannel.set(ch.id, ids);
      allIds.push(...ids);
    } catch (err) {
      if (err instanceof QuotaExhaustedError) throw err;
      units += 1; // failed calls still cost quota
      results.push({
        id: ch.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Phase 2 — one videos.list per 50 ids, shared across the whole group
  const { videos, units: videoUnits } = await fetchVideosByIds(allIds);
  units += videoUnits;

  for (const ch of channels) {
    const ids = idsByChannel.get(ch.id);
    if (!ids) continue; // already recorded as an error above
    const snapshots = ids
      .map((id) => videos.get(id))
      .filter((v): v is RecentVideoSnapshot => Boolean(v));
    const score = scoreChannelQuality({
      videos: snapshots,
      country: ch.country,
      subscriberCount: ch.subscriberCount,
      primaryNiche: ch.primaryNiche,
    });
    results.push({
      id: ch.id,
      score,
      dbFields: {
        ...qualityFieldsForDb(score),
        ...influencerScoreFields(score, ch.subscriberCount),
      },
    });
  }

  return { results, units };
}

export async function scoreChannelById(
  channelId: string,
  meta: {
    country?: string | null;
    subscriberCount?: number | null;
    primaryNiche?: string | null;
    uploadsPlaylistId?: string | null;
  } = {}
): Promise<{ score: QualityScoreResult; dbFields: DbFields }> {
  const videos = await fetchRecentVideosForChannel(
    channelId,
    5,
    meta.uploadsPlaylistId
  );
  const score = scoreChannelQuality({
    videos,
    country: meta.country,
    subscriberCount: meta.subscriberCount,
    primaryNiche: meta.primaryNiche,
  });
  return {
    score,
    dbFields: {
      ...qualityFieldsForDb(score),
      ...influencerScoreFields(score, meta.subscriberCount),
    },
  };
}
