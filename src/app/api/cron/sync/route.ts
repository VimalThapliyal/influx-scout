import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getChannelDetails, mapYouTubeChannelToDb } from "@/lib/youtube";
import {
  upsertChannelWithMetricsExpiry,
  withYoutubeMetricsExpiry,
} from "@/lib/youtube-metrics";

const BATCH_SIZE = 50;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();
    // Prefer channels whose YouTube metrics window has expired (scrape.txt §14)
    const { data: staleChannels, error } = await supabase
      .from("channels")
      .select("id")
      .or(`metrics_expires_at.is.null,metrics_expires_at.lt.${nowIso}`)
      .order("metrics_expires_at", { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE);

    if (error) {
      // Fallback if columns not migrated yet
      if (/metrics_expires_at|schema cache/i.test(error.message)) {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: legacy, error: legacyErr } = await supabase
          .from("channels")
          .select("id")
          .lt("last_updated", cutoff)
          .order("last_updated", { ascending: true })
          .limit(BATCH_SIZE);
        if (legacyErr) {
          return NextResponse.json({ error: legacyErr.message }, { status: 500 });
        }
        return await refreshBatch(supabase, legacy ?? []);
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!staleChannels?.length) {
      return NextResponse.json({ message: "No channels need refresh", refreshed: 0 });
    }

    return await refreshBatch(supabase, staleChannels);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function refreshBatch(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  staleChannels: { id: string }[]
) {
  const ids = staleChannels.map((c) => c.id);
  const details = await getChannelDetails(ids);
  let refreshed = 0;
  const now = new Date().toISOString();

  for (const item of details) {
    const channel = mapYouTubeChannelToDb(item);
    const { error: upsertError } = await upsertChannelWithMetricsExpiry(
      supabase,
      withYoutubeMetricsExpiry(
        {
          ...channel,
          last_updated: now,
          updated_at: now,
        },
        now
      )
    );

    if (!upsertError) {
      refreshed++;
      await supabase.from("channel_analytics").insert({
        channel_id: channel.id,
        subscriber_count: channel.subscriber_count,
        view_count: channel.view_count,
        video_count: channel.video_count,
      });
    }
  }

  return NextResponse.json({
    message: "Sync complete",
    refreshed,
    batch_size: BATCH_SIZE,
  });
}
