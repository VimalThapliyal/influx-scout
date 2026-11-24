import { getSupabaseAdmin } from "./supabase";
import { isPlausibleYouTubeHandle, parseYouTubeRef } from "./youtube-url";

export interface LightChannelInput {
  url: string;
  channel_id?: string | null;
  handle?: string | null;
  title?: string | null;
  subscriber_count?: number | null;
  thumbnail_url?: string | null;
}

export interface LightSaveOptions {
  minSubscribers?: number;
  workerId?: string | null;
}

export interface LightSaveResult {
  submitted: number;
  imported: number;
  already_saved: number;
  already_pending: number;
  skipped_below_min_subs: number;
  failed: number;
  errors: Array<{ input: string; error: string }>;
  channels: Array<{
    url: string;
    handle: string | null;
    title: string | null;
    status: "pending" | "already_saved" | "already_pending";
  }>;
}

function normalizeUrl(url: string): string {
  return url.split(/[?#]/)[0].replace(/\/$/, "");
}

function normalizeHandle(handle: string | null | undefined): string | null {
  if (!handle) return null;
  const h = handle.trim().replace(/^@/, "");
  return h ? `@${h}` : null;
}

function extractFromUrl(url: string): {
  channel_id: string | null;
  handle: string | null;
} {
  const ref = parseYouTubeRef(url);
  if (!ref) return { channel_id: null, handle: null };
  if (ref.kind === "channel_id") return { channel_id: ref.value, handle: null };
  if (ref.kind === "handle") return { channel_id: null, handle: `@${ref.value}` };
  return { channel_id: null, handle: null };
}

/** Zero YouTube API quota — queue scraped channels for nightly enrich. */
export async function lightSaveChannels(
  inputs: LightChannelInput[],
  options: LightSaveOptions = {}
): Promise<LightSaveResult> {
  const minSubscribers = Math.max(0, options.minSubscribers ?? 0);
  const result: LightSaveResult = {
    submitted: inputs.length,
    imported: 0,
    already_saved: 0,
    already_pending: 0,
    skipped_below_min_subs: 0,
    failed: 0,
    errors: [],
    channels: [],
  };

  if (inputs.length === 0) return result;
  if (inputs.length > 50) {
    throw new Error("Maximum 50 channels per light-save request");
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  for (const raw of inputs) {
    const url = normalizeUrl(String(raw.url || "").trim());
    if (!url) {
      result.failed++;
      result.errors.push({ input: String(raw.url), error: "Missing url" });
      continue;
    }

    const fromUrl = extractFromUrl(url);
    const channelId =
      (raw.channel_id && /^UC[\w-]{22}$/i.test(raw.channel_id)
        ? raw.channel_id
        : null) || fromUrl.channel_id;
    let handle = normalizeHandle(raw.handle) || fromUrl.handle;
    if (handle && !isPlausibleYouTubeHandle(handle)) {
      handle = null;
    }
    const title =
      (raw.title && String(raw.title).trim()) || handle || "Pending channel";
    const subs =
      typeof raw.subscriber_count === "number" &&
      Number.isFinite(raw.subscriber_count)
        ? Math.max(0, Math.round(raw.subscriber_count))
        : null;

    if (!channelId && !handle) {
      result.failed++;
      result.errors.push({
        input: url,
        error: "No valid YouTube channel id or handle",
      });
      continue;
    }

    if (minSubscribers > 0 && subs !== null && subs < minSubscribers) {
      result.skipped_below_min_subs++;
      continue;
    }

    let alreadySaved = false;
    if (channelId) {
      const { data } = await supabase
        .from("channels")
        .select("id")
        .eq("id", channelId)
        .maybeSingle();
      if (data) alreadySaved = true;
    }
    if (!alreadySaved && handle) {
      const variants = [handle, handle.replace(/^@/, "")];
      const { data } = await supabase
        .from("channels")
        .select("id")
        .in("handle", variants)
        .limit(1);
      if (data && data.length > 0) alreadySaved = true;
    }

    if (alreadySaved) {
      result.already_saved++;
      result.channels.push({
        url,
        handle,
        title,
        status: "already_saved",
      });
      continue;
    }

    if (channelId) {
      const { data } = await supabase
        .from("channel_pending")
        .select("id")
        .eq("status", "pending")
        .eq("channel_id", channelId)
        .limit(1);
      if (data && data.length > 0) {
        result.already_pending++;
        result.channels.push({
          url,
          handle,
          title,
          status: "already_pending",
        });
        continue;
      }
    }

    if (handle) {
      const { data } = await supabase
        .from("channel_pending")
        .select("id")
        .eq("status", "pending")
        .ilike("handle", handle)
        .limit(1);
      if (data && data.length > 0) {
        result.already_pending++;
        result.channels.push({
          url,
          handle,
          title,
          status: "already_pending",
        });
        continue;
      }
    }

    const { data: byUrl } = await supabase
      .from("channel_pending")
      .select("id, status")
      .ilike("url", url)
      .limit(1);

    if (byUrl?.[0]?.status === "pending") {
      result.already_pending++;
      result.channels.push({
        url,
        handle,
        title,
        status: "already_pending",
      });
      continue;
    }

    const row = {
      url,
      channel_id: channelId,
      handle,
      title,
      subscriber_count: subs,
      thumbnail_url: raw.thumbnail_url || null,
      worker_id: options.workerId || null,
      status: "pending" as const,
      updated_at: now,
    };

    const { error } = byUrl?.[0]
      ? await supabase
          .from("channel_pending")
          .update(row)
          .eq("id", byUrl[0].id)
      : await supabase.from("channel_pending").insert(row);

    if (error) {
      if (error.code === "23505") {
        result.already_pending++;
        result.channels.push({
          url,
          handle,
          title,
          status: "already_pending",
        });
        continue;
      }
      result.failed++;
      result.errors.push({ input: url, error: error.message });
      continue;
    }

    result.imported++;
    result.channels.push({
      url,
      handle,
      title,
      status: "pending",
    });
  }

  return result;
}
