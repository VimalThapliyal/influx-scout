import { requireEnv } from "./env";
import type { YouTubeChannelItem, YouTubeSearchItem } from "../../src/lib/types";
import { regionRelevanceLanguage, type SearchRegionCode } from "./markets";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

function getApiKey(): string {
  return requireEnv("YOUTUBE_API_KEY");
}

async function youtubeFetch<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${YOUTUBE_API_BASE}/${endpoint}`);
  url.searchParams.set("key", getApiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface SearchChannelsOptions {
  maxResults?: number;
  regionCode?: SearchRegionCode | string;
}

export async function searchChannels(
  query: string,
  maxResults = 25,
  options: SearchChannelsOptions = {}
) {
  const regionCode = options.regionCode ?? "US";
  const params: Record<string, string> = {
    part: "snippet",
    type: "channel",
    q: query,
    maxResults: String(Math.min(maxResults, 50)),
    order: "relevance",
    regionCode,
    relevanceLanguage: regionRelevanceLanguage(regionCode),
  };

  return youtubeFetch<{
    items: YouTubeSearchItem[];
    pageInfo: { totalResults: number };
  }>("search", params);
}

export async function getChannelDetails(channelIds: string[]) {
  const results: YouTubeChannelItem[] = [];

  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50);
    const data = await youtubeFetch<{ items: YouTubeChannelItem[] }>("channels", {
      part: "snippet,statistics,brandingSettings,contentDetails",
      id: batch.join(","),
    });
    results.push(...(data.items ?? []));
  }

  return results;
}
