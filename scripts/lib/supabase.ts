import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";
import { withYoutubeMetricsExpiry } from "../../src/lib/youtube-metrics";

export type EmailStatus = "found" | "locked" | "not_available";

export interface ChannelRow {
  id: string;
  handle: string | null;
  title: string;
  description: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  twitter: string | null;
  tiktok: string | null;
  data_source: string;
  email_status?: EmailStatus | null;
}

const CHANNEL_SELECT =
  "id, handle, title, description, email, website, instagram, twitter, tiktok, data_source";

async function safeUpdate(
  channelId: string,
  patch: Record<string, string | null>
) {
  const supabase = getScraperSupabase();
  const { error } = await supabase.from("channels").update(patch).eq("id", channelId);

  if (error?.message.includes("email_status")) {
    const { email_status: _, ...rest } = patch;
    const retry = await supabase.from("channels").update(rest).eq("id", channelId);
    if (retry.error) throw new Error(retry.error.message);
    return;
  }

  if (error) throw new Error(error.message);
}

export function getScraperSupabase() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}

export async function upsertDiscoveredChannels(
  channels: Array<Record<string, unknown>>
): Promise<ChannelRow[]> {
  const supabase = getScraperSupabase();
  const now = new Date().toISOString();
  const rows: ChannelRow[] = [];

  for (const channel of channels) {
    const { data: existing } = await supabase
      .from("channels")
      .select("id, email, data_source")
      .eq("id", channel.id as string)
      .maybeSingle();

    const payload = withYoutubeMetricsExpiry(
      {
        ...channel,
        data_source:
          existing?.data_source === "hybrid" || existing?.data_source === "scraped"
            ? existing.data_source
            : "api",
        last_updated: now,
        updated_at: now,
      },
      now
    );

    if (existing?.email && !channel.email) {
      delete (payload as { email?: unknown }).email;
    }

    const { data, error } = await supabase
      .from("channels")
      .upsert(payload, { onConflict: "id" })
      .select(CHANNEL_SELECT)
      .single();

    if (error) throw new Error(error.message);
    if (data) rows.push(data);
  }

  return rows;
}

export async function fetchChannelsToEnrich(options: {
  limit: number;
  enrichOnly: boolean;
  channelId?: string;
  channelIds?: string[];
}): Promise<ChannelRow[]> {
  const supabase = getScraperSupabase();

  if (options.channelId) {
    const { data, error } = await supabase
      .from("channels")
      .select(CHANNEL_SELECT)
      .eq("id", options.channelId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? [data] : [];
  }

  if (options.channelIds?.length) {
    let query = supabase
      .from("channels")
      .select(CHANNEL_SELECT)
      .in("id", options.channelIds);

    if (options.enrichOnly) {
      query = query.is("email", null);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  let query = supabase
    .from("channels")
    .select(CHANNEL_SELECT)
    .order("last_updated", { ascending: true })
    .limit(options.limit);

  if (options.enrichOnly) {
    query = query.is("email", null);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertEnrichment(
  channelId: string,
  existing: ChannelRow,
  enrichment: {
    email: string | null;
    website: string | null;
    instagram: string | null;
    twitter: string | null;
    tiktok: string | null;
    description: string | null;
    email_status: EmailStatus;
  }
): Promise<{ updated: boolean; fields: string[] }> {
  const supabase = getScraperSupabase();
  const patch: Record<string, string | null> = {
    email_status: enrichment.email_status,
  };
  const fields: string[] = ["email_status"];

  const maybeSet = (key: keyof Omit<typeof enrichment, "email_status">, current: string | null) => {
    const next = enrichment[key];
    if (next && next !== current) {
      patch[key] = next;
      fields.push(key);
    }
  };

  maybeSet("email", existing.email);
  maybeSet("website", existing.website);
  maybeSet("instagram", existing.instagram);
  maybeSet("twitter", existing.twitter);
  maybeSet("tiktok", existing.tiktok);

  if (enrichment.description && enrichment.description.length > (existing.description?.length ?? 0)) {
    patch.description = enrichment.description;
    fields.push("description");
  }

  const hasNewContactData = fields.some((f) => f !== "email_status");
  const statusChanged = enrichment.email_status !== (existing.email_status ?? null);

  if (!hasNewContactData && !statusChanged) {
    await safeUpdate(channelId, {
      last_updated: new Date().toISOString(),
      email_status: enrichment.email_status,
    });
    return { updated: false, fields: [] };
  }

  const dataSource =
    existing.data_source === "api" || existing.data_source === "hybrid"
      ? "hybrid"
      : "scraped";

  await safeUpdate(channelId, {
    ...patch,
    data_source: dataSource,
    last_updated: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  return { updated: true, fields };
}
