import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getChannelDetails, mapYouTubeChannelToDb } from "@/lib/youtube";
import { canViewEmails } from "@/lib/auth";
import { redactChannelEmail } from "@/lib/email";
import {
  upsertChannelWithMetricsExpiry,
  withYoutubeMetricsExpiry,
} from "@/lib/youtube-metrics";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("channels")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const canView = await canViewEmails();
    return NextResponse.json(redactChannelEmail(data, canView));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch channel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const details = await getChannelDetails([params.id]);
    if (details.length === 0) {
      return NextResponse.json({ error: "Channel not found on YouTube" }, { status: 404 });
    }

    const channel = mapYouTubeChannelToDb(details[0]);
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

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

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("channels")
      .select("*")
      .eq("id", channel.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Upsert failed" }, { status: 500 });
    }

    await supabase.from("channel_analytics").insert({
      channel_id: channel.id,
      subscriber_count: channel.subscriber_count,
      view_count: channel.view_count,
      video_count: channel.video_count,
    });

    return NextResponse.json(redactChannelEmail(data!, await canViewEmails()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refresh failed";
    const status = message.includes("quota") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
