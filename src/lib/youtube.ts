import type { YouTubeChannelItem, YouTubeSearchItem } from "./types";
import {
  checkQuota,
  consumeQuota,
  GoogleQuotaExceededError,
  isGoogleQuotaExceededBody,
  recordGoogleQuotaExhausted,
} from "./quota";
import {
  calculateScore,
  classifyTier,
  extractEmail,
  extractSocialLinks,
} from "./scoring";
import type { Channel } from "./types";
import {
  isTargetMarketCountry,
  regionRelevanceLanguage,
  type SearchRegionCode,
} from "./markets";
import { withChannelClassification } from "./classify";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  return key;
}

async function youtubeFetch<T>(
  endpoint: string,
  params: Record<string, string>,
  quotaCost: number,
  operation: string
): Promise<T> {
  await checkQuota(quotaCost);

  const url = new URL(`${YOUTUBE_API_BASE}/${endpoint}`);
  url.searchParams.set("key", getApiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    if (isGoogleQuotaExceededBody(body, res.status)) {
      await recordGoogleQuotaExhausted();
      throw new GoogleQuotaExceededError();
    }
    throw new Error(`YouTube API error ${res.status}: ${body}`);
  }

  await consumeQuota(quotaCost, operation);
  return res.json() as Promise<T>;
}

export type VideoPublishedWindow = "week" | "month" | "any";

export function publishedAfterIso(window: VideoPublishedWindow): string | null {
  if (window === "any") return null;
  const days = window === "week" ? 7 : 30;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export async function searchChannels(
  query: string,
  maxResults = 25,
  pageToken?: string,
  options?: { regionCode?: SearchRegionCode | string }
) {
  const regionCode = options?.regionCode ?? "US";
  const params: Record<string, string> = {
    part: "snippet",
    type: "channel",
    q: query,
    maxResults: String(Math.min(maxResults, 50)),
    order: "relevance",
    regionCode,
    relevanceLanguage: regionRelevanceLanguage(regionCode),
  };
  if (pageToken) params.pageToken = pageToken;

  return youtubeFetch<{
    items: YouTubeSearchItem[];
    nextPageToken?: string;
    pageInfo: { totalResults: number };
  }>("search", params, 100, "search.list");
}

/**
 * Keyword + date filter: search recent *videos*, then take unique channel IDs.
 * (Channel search's publishedAfter = channel creation date — wrong signal.)
 */
export async function searchRecentVideoChannels(
  query: string,
  maxResults = 25,
  options?: {
    regionCode?: SearchRegionCode | string;
    publishedWindow?: VideoPublishedWindow;
    pageToken?: string;
  }
) {
  const regionCode = options?.regionCode ?? "US";
  const params: Record<string, string> = {
    part: "snippet",
    type: "video",
    q: query,
    maxResults: String(Math.min(maxResults, 50)),
    order: "date",
    regionCode,
    relevanceLanguage: regionRelevanceLanguage(regionCode),
  };
  const after = publishedAfterIso(options?.publishedWindow ?? "month");
  if (after) params.publishedAfter = after;
  if (options?.pageToken) params.pageToken = options.pageToken;

  const data = await youtubeFetch<{
    items: Array<{
      id?: { videoId?: string };
      snippet?: {
        channelId?: string;
        channelTitle?: string;
        title?: string;
        publishedAt?: string;
      };
    }>;
    nextPageToken?: string;
    pageInfo: { totalResults: number };
  }>("search", params, 100, "search.list");

  const channelIds: string[] = [];
  const seen = new Set<string>();
  for (const item of data.items ?? []) {
    const cid = item.snippet?.channelId;
    if (!cid || seen.has(cid)) continue;
    seen.add(cid);
    channelIds.push(cid);
  }

  return {
    channelIds,
    nextPageToken: data.nextPageToken,
    totalResults: data.pageInfo?.totalResults ?? 0,
    items: data.items ?? [],
  };
}

export { isTargetMarketCountry };

export async function getChannelDetails(channelIds: string[]) {
  const results: YouTubeChannelItem[] = [];

  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50);
    const data = await youtubeFetch<{ items: YouTubeChannelItem[] }>(
      "channels",
      {
        part: "snippet,statistics,brandingSettings,contentDetails",
        id: batch.join(","),
      },
      1,
      "channels.list"
    );
    results.push(...(data.items ?? []));
  }

  return results;
}

export interface YouTubeVideoItem {
  id: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  thumbnail_url: string | null;
  published_at: string;
  view_count: number;
  like_count: number | null;
  comment_count: number | null;
  duration: string | null;
}

export async function getChannelVideos(
  channelId: string,
  maxResults = 6,
  sort: "recent" | "popular" = "recent",
  options?: { uploadsPlaylistId?: string; skipChannelLookup?: boolean }
): Promise<YouTubeVideoItem[]> {
  const playlistMax = sort === "popular" ? Math.min(50, Math.max(maxResults, 25)) : maxResults;

  let uploadsId = options?.uploadsPlaylistId;
  if (!uploadsId) {
    const channelData = await youtubeFetch<{
      items: Array<{
        contentDetails?: { relatedPlaylists?: { uploads?: string } };
      }>;
    }>(
      "channels",
      { part: "contentDetails", id: channelId },
      1,
      "channels.list"
    );
    uploadsId =
      channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  }
  if (!uploadsId) return [];

  const playlistData = await youtubeFetch<{
    items: Array<{
      snippet?: {
        title?: string;
        publishedAt?: string;
        thumbnails?: { medium?: { url: string }; default?: { url: string } };
        resourceId?: { videoId?: string };
      };
      contentDetails?: { videoId?: string };
    }>;
  }>(
    "playlistItems",
    {
      part: "snippet,contentDetails",
      playlistId: uploadsId,
      maxResults: String(playlistMax),
    },
    1,
    "playlistItems.list"
  );

  const videoIds =
    playlistData.items
      ?.map((i) => i.contentDetails?.videoId ?? i.snippet?.resourceId?.videoId)
      .filter(Boolean) as string[] | undefined;

  if (!videoIds?.length) {
    return (
      playlistData.items?.map((item, idx) => ({
        id: item.contentDetails?.videoId ?? `unknown-${idx}`,
        title: item.snippet?.title ?? "Untitled",
        description: null,
        tags: null,
        thumbnail_url:
          item.snippet?.thumbnails?.medium?.url ??
          item.snippet?.thumbnails?.default?.url ??
          null,
        published_at: item.snippet?.publishedAt ?? "",
        view_count: 0,
        like_count: null,
        comment_count: null,
        duration: null,
      })) ?? []
    );
  }

  const statsData = await youtubeFetch<{
    items: Array<{
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
  }>(
    "videos",
    {
      part: "snippet,statistics,contentDetails",
      id: videoIds.join(","),
    },
    1,
    "videos.list"
  );

  const statsMap = new Map(
    statsData.items?.map((v) => [
      v.id,
      {
        title: v.snippet?.title,
        description: v.snippet?.description ?? null,
        tags: v.snippet?.tags ?? null,
        publishedAt: v.snippet?.publishedAt,
        views: parseInt(v.statistics?.viewCount ?? "0", 10),
        likes: v.statistics?.likeCount
          ? parseInt(v.statistics.likeCount, 10)
          : null,
        comments: v.statistics?.commentCount
          ? parseInt(v.statistics.commentCount, 10)
          : null,
        duration: v.contentDetails?.duration ?? null,
      },
    ]) ?? []
  );

  const videos =
    playlistData.items?.map((item) => {
      const id = item.contentDetails?.videoId ?? "";
      const stats = statsMap.get(id);
      return {
        id,
        title: stats?.title ?? item.snippet?.title ?? "Untitled",
        description: stats?.description ?? null,
        tags: stats?.tags ?? null,
        thumbnail_url:
          item.snippet?.thumbnails?.medium?.url ??
          item.snippet?.thumbnails?.default?.url ??
          null,
        published_at:
          stats?.publishedAt ?? item.snippet?.publishedAt ?? "",
        view_count: stats?.views ?? 0,
        like_count: stats?.likes ?? null,
        comment_count: stats?.comments ?? null,
        duration: stats?.duration ?? null,
      };
    }) ?? [];

  if (sort === "popular") {
    return [...videos]
      .sort((a, b) => b.view_count - a.view_count)
      .slice(0, maxResults);
  }

  return videos.slice(0, maxResults);
}

/** Comment authors on a video who have a channel (discovery layer). */
export async function getCommentAuthorChannelIds(
  videoId: string,
  maxResults = 20
): Promise<string[]> {
  const data = await youtubeFetch<{
    items?: Array<{
      snippet?: {
        topLevelComment?: {
          snippet?: { authorChannelId?: { value?: string } };
        };
      };
    }>;
  }>(
    "commentThreads",
    {
      part: "snippet",
      videoId,
      maxResults: String(Math.min(maxResults, 100)),
      order: "relevance",
      textFormat: "plainText",
    },
    1,
    "commentThreads.list"
  );

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of data.items ?? []) {
    const cid =
      item.snippet?.topLevelComment?.snippet?.authorChannelId?.value;
    if (!cid || seen.has(cid)) continue;
    seen.add(cid);
    ids.push(cid);
  }
  return ids;
}

export function mapYouTubeChannelToDb(
  item: YouTubeChannelItem
): Omit<Channel, "created_at" | "updated_at" | "last_updated"> {
  const subscriberCount = item.statistics?.subscriberCount
    ? parseInt(item.statistics.subscriberCount, 10)
    : null;
  const viewCount = item.statistics?.viewCount
    ? parseInt(item.statistics.viewCount, 10)
    : 0;
  const videoCount = item.statistics?.videoCount
    ? parseInt(item.statistics.videoCount, 10)
    : 0;

  const description = item.snippet?.description ?? "";
  const brandingDesc = item.brandingSettings?.channel?.description ?? "";
  const fullText = `${description} ${brandingDesc}`;

  const email = extractEmail(fullText);
  const social = extractSocialLinks(fullText);

  const avgViews = videoCount > 0 ? Math.round(viewCount / videoCount) : 0;
  const subs = subscriberCount ?? 0;
  const viewToSubRatio = subs > 0 ? avgViews / subs : 0;

  const publishedAt = item.snippet?.publishedAt;
  const accountAgeDays = publishedAt
    ? Math.floor(
        (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24)
      )
    : 0;

  const tier = subs > 0 ? classifyTier(subs) : null;
  // Empty channels (no subs, no videos) have nothing to measure -- scoring
  // them with placeholder engagement/frequency assumptions gives a
  // misleadingly non-zero score to accounts with zero real activity.
  const score =
    subs === 0 || videoCount === 0
      ? 0
      : calculateScore({
          subscriberCount: subs,
          avgViews,
          engagementRate: 0.02,
          uploadFrequency: 1,
          accountAgeDays,
          viewToSubRatio,
        });

  const handle = item.snippet?.customUrl
    ? item.snippet.customUrl.startsWith("@")
      ? item.snippet.customUrl
      : `@${item.snippet.customUrl}`
    : null;

  return withChannelClassification({
    id: item.id,
    handle,
    title: item.snippet?.title ?? "Unknown",
    description: description || null,
    thumbnail_url:
      item.snippet?.thumbnails?.medium?.url ??
      item.snippet?.thumbnails?.default?.url ??
      null,
    subscriber_count: subscriberCount,
    view_count: viewCount,
    video_count: videoCount,
    country: item.snippet?.country ?? null,
    published_at: publishedAt ?? null,
    category: null,
    email,
    website: social.website,
    instagram: social.instagram,
    twitter: social.twitter,
    tiktok: social.tiktok,
    influencer_score: score,
    tier,
    engagement_rate: null,
    avg_views_per_video: avgViews,
    data_source: "api",
  });
}
