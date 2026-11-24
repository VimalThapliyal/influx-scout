import { getSupabaseAdmin } from "./supabase";
import {
  getChannelDetails,
  mapYouTubeChannelToDb,
} from "./youtube";
import {
  upsertChannelWithMetricsExpiry,
  withYoutubeMetricsExpiry,
} from "./youtube-metrics";
import { USA_COUNTRY_CODE, isTargetMarketCountry } from "./markets";
import {
  parseYouTubeRefsFromText,
  type ParsedYouTubeRef,
} from "./youtube-url";
import {
  checkQuota,
  GoogleQuotaExceededError,
  isGoogleQuotaExceededBody,
  recordGoogleQuotaExhausted,
} from "./quota";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  return key;
}

async function youtubeGet<T>(
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

  const { consumeQuota } = await import("./quota");
  await consumeQuota(quotaCost, operation);
  return res.json() as Promise<T>;
}

async function resolveToChannelId(ref: ParsedYouTubeRef): Promise<string | null> {
  if (ref.kind === "channel_id") return ref.value;

  if (ref.kind === "handle") {
    const data = await youtubeGet<{ items?: Array<{ id: string }> }>(
      "channels",
      {
        part: "id",
        forHandle: ref.value,
      },
      1,
      "channels.list.forHandle"
    );
    return data.items?.[0]?.id ?? null;
  }

  const data = await youtubeGet<{
    items?: Array<{ snippet?: { channelId?: string } }>;
  }>(
    "videos",
    { part: "snippet", id: ref.value },
    1,
    "videos.list"
  );
  return data.items?.[0]?.snippet?.channelId ?? null;
}

export interface ImportChannelsOptions {
  usaOnly?: boolean;
  targetMarketsOnly?: boolean;
  minSubscribers?: number;
}

export interface ImportChannelsResult {
  submitted: number;
  resolved: number;
  imported: number;
  skipped_non_usa: number;
  skipped_non_market: number;
  skipped_below_min_subs: number;
  failed: number;
  errors: Array<{ input: string; error: string }>;
  channels: Array<{ id: string; title: string; country: string | null }>;
}

export async function importChannelsFromText(
  text: string,
  options: ImportChannelsOptions = {}
): Promise<ImportChannelsResult> {
  const usaOnly = options.usaOnly === true;
  const targetMarketsOnly =
    options.targetMarketsOnly ?? (usaOnly ? false : true);
  const minSubscribers = Math.max(0, options.minSubscribers ?? 0);

  const refs = parseYouTubeRefsFromText(text);
  const result: ImportChannelsResult = {
    submitted: refs.length,
    resolved: 0,
    imported: 0,
    skipped_non_usa: 0,
    skipped_non_market: 0,
    skipped_below_min_subs: 0,
    failed: 0,
    errors: [],
    channels: [],
  };

  if (refs.length === 0) {
    return result;
  }

  if (refs.length > 50) {
    throw new Error("Maximum 50 channels per request");
  }

  const channelIds: string[] = [];
  const idSet = new Set<string>();

  for (const ref of refs) {
    const input =
      ref.kind === "channel_id"
        ? ref.value
        : ref.kind === "handle"
          ? `@${ref.value}`
          : ref.value;
    try {
      const id = await resolveToChannelId(ref);
      if (!id) {
        result.failed++;
        result.errors.push({ input, error: "Could not resolve channel" });
        continue;
      }
      if (!idSet.has(id)) {
        idSet.add(id);
        channelIds.push(id);
      }
      result.resolved++;
    } catch (err) {
      result.failed++;
      result.errors.push({
        input,
        error: err instanceof Error ? err.message : "Resolve failed",
      });
    }
  }

  if (channelIds.length === 0) {
    return result;
  }

  const supabase = getSupabaseAdmin();
  const { data: existingRows } = await supabase
    .from("channels")
    .select("id, email, data_source")
    .in("id", channelIds);

  const existingMap = new Map(
    (existingRows ?? []).map((r) => [r.id, r as { id: string; email: string | null; data_source: string }])
  );

  const details = await getChannelDetails(channelIds);
  const now = new Date().toISOString();
  const toUpsert: Record<string, unknown>[] = [];

  for (const item of details) {
    const mapped = mapYouTubeChannelToDb(item);
    const country = mapped.country?.toUpperCase() ?? null;

    if (usaOnly && country !== USA_COUNTRY_CODE) {
      result.skipped_non_usa++;
      continue;
    }

    if (!usaOnly && targetMarketsOnly && !isTargetMarketCountry(country)) {
      result.skipped_non_market++;
      continue;
    }

    const subs = mapped.subscriber_count ?? 0;
    if (minSubscribers > 0 && subs < minSubscribers) {
      result.skipped_below_min_subs++;
      continue;
    }

    const existing = existingMap.get(mapped.id);

    const payload: Record<string, unknown> = withYoutubeMetricsExpiry({
      ...mapped,
      data_source: existing?.data_source === "scraped" || existing?.data_source === "hybrid"
        ? existing.data_source
        : "contributor",
      last_updated: now,
      updated_at: now,
    }, now);

    if (existing?.email && !mapped.email) {
      delete payload.email;
    }

    toUpsert.push(payload);
    result.channels.push({
      id: mapped.id,
      title: mapped.title,
      country: mapped.country,
    });
  }

  if (toUpsert.length > 0) {
    // Submit independently: bulk upserts can fill a missing contact column with
    // null when a different row in the same batch supplies that column.
    for (const payload of toUpsert) {
      const { error } = await upsertChannelWithMetricsExpiry(supabase, payload, { onConflict: "id" });
      if (error) throw new Error(error.message);
    }
    result.imported = toUpsert.length;
  }

  return result;
}
