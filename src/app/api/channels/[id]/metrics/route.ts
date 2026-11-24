import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  computePeriodMetrics,
  type MetricsRange,
} from "@/lib/channel-metrics";

function parseRange(value: string | null): MetricsRange {
  if (value === "28" || value === "90") return value;
  return "all";
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const range = parseRange(new URL(request.url).searchParams.get("range"));
    const supabase = getSupabaseAdmin();

    const { data: channel, error } = await supabase
      .from("channels")
      .select(
        "subscriber_count, view_count, video_count, avg_views_per_video, engagement_rate"
      )
      .eq("id", params.id)
      .single();

    if (error || !channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const { data: analytics } = await supabase
      .from("channel_analytics")
      .select("recorded_at, subscriber_count, view_count, video_count")
      .eq("channel_id", params.id)
      .order("recorded_at", { ascending: true })
      .limit(90);

    const metrics = await computePeriodMetrics(
      params.id,
      channel,
      analytics ?? [],
      range
    );

    return NextResponse.json({ metrics });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch metrics";
    const status = message.includes("quota") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
