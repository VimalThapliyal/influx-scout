import { getSupabaseAdmin } from "./supabase";
import { parseYouTubeRef } from "./youtube-url";

export interface ChannelSavedStatus {
  saved: boolean;
  channel_id?: string;
  pending?: boolean;
}

/** Check library + pending queue by channel ID or @handle — no YouTube API. */
export async function checkChannelsInLibrary(
  urls: string[]
): Promise<Record<string, ChannelSavedStatus>> {
  const result: Record<string, ChannelSavedStatus> = {};
  const ids: string[] = [];
  const handleVariants: string[] = [];
  const urlByChannelId = new Map<string, string>();
  const urlByHandleKey = new Map<string, string>();

  for (const url of urls) {
    const ref = parseYouTubeRef(url);
    if (!ref) {
      result[url] = { saved: false };
      continue;
    }

    if (ref.kind === "channel_id") {
      ids.push(ref.value);
      urlByChannelId.set(ref.value, url);
      result[url] = { saved: false };
      continue;
    }

    if (ref.kind === "handle") {
      const withAt = `@${ref.value}`;
      handleVariants.push(
        withAt,
        ref.value,
        ref.value.toLowerCase(),
        withAt.toLowerCase()
      );
      urlByHandleKey.set(withAt.toLowerCase(), url);
      urlByHandleKey.set(ref.value.toLowerCase(), url);
      result[url] = { saved: false };
      continue;
    }

    result[url] = { saved: false };
  }

  const supabase = getSupabaseAdmin();

  if (ids.length > 0) {
    const { data } = await supabase.from("channels").select("id").in("id", ids);
    for (const row of data ?? []) {
      const url = urlByChannelId.get(row.id);
      if (url) result[url] = { saved: true, channel_id: row.id };
    }
  }

  if (handleVariants.length > 0) {
    const unique = Array.from(new Set(handleVariants));
    const { data } = await supabase
      .from("channels")
      .select("id, handle")
      .in("handle", unique);

    for (const row of data ?? []) {
      if (!row.handle) continue;
      const keys = [
        row.handle.toLowerCase(),
        row.handle.replace(/^@/, "").toLowerCase(),
      ];
      for (const key of keys) {
        const url = urlByHandleKey.get(key);
        if (url) result[url] = { saved: true, channel_id: row.id };
      }
    }
  }

  // Pending queue counts as "saved" so auto-save won't re-queue
  const unsetUrls = urls.filter((u) => !result[u]?.saved);
  if (unsetUrls.length === 0) return result;

  const pendingIds = unsetUrls
    .map((u) => {
      const ref = parseYouTubeRef(u);
      return ref?.kind === "channel_id" ? ref.value : null;
    })
    .filter(Boolean) as string[];

  if (pendingIds.length > 0) {
    const { data } = await supabase
      .from("channel_pending")
      .select("channel_id")
      .eq("status", "pending")
      .in("channel_id", pendingIds);
    for (const row of data ?? []) {
      if (!row.channel_id) continue;
      const url = urlByChannelId.get(row.channel_id);
      if (url) result[url] = { saved: true, channel_id: row.channel_id, pending: true };
    }
  }

  const pendingHandles = unsetUrls
    .map((u) => {
      const ref = parseYouTubeRef(u);
      if (ref?.kind !== "handle") return null;
      return `@${ref.value}`;
    })
    .filter(Boolean) as string[];

  if (pendingHandles.length > 0) {
    const { data } = await supabase
      .from("channel_pending")
      .select("handle, channel_id")
      .eq("status", "pending")
      .in("handle", pendingHandles);
    for (const row of data ?? []) {
      if (!row.handle) continue;
      const key = row.handle.replace(/^@/, "").toLowerCase();
      const url =
        urlByHandleKey.get(key) ||
        urlByHandleKey.get(`@${key}`) ||
        urlByHandleKey.get(row.handle.toLowerCase());
      if (url && !result[url]?.saved) {
        result[url] = {
          saved: true,
          channel_id: row.channel_id ?? undefined,
          pending: true,
        };
      }
    }
  }

  // URL match fallback (batched)
  const stillUnset = unsetUrls.filter((u) => !result[u]?.saved);
  if (stillUnset.length > 0) {
    const normalizedList = stillUnset.map((u) =>
      u.split(/[?#]/)[0].replace(/\/$/, "")
    );
    const { data } = await supabase
      .from("channel_pending")
      .select("url, channel_id")
      .eq("status", "pending")
      .in("url", normalizedList);
    const byUrl = new Map(
      (data ?? []).map((r) => [r.url.toLowerCase(), r])
    );
    for (const url of stillUnset) {
      const key = url.split(/[?#]/)[0].replace(/\/$/, "").toLowerCase();
      const row = byUrl.get(key);
      if (row) {
        result[url] = {
          saved: true,
          channel_id: row.channel_id ?? undefined,
          pending: true,
        };
      }
    }
  }

  return result;
}
