import { getChannelVideos } from "./youtube";

export type MetricsRange = "28" | "90" | "all";

export interface AnalyticsRow {
  recorded_at: string;
  subscriber_count: number | null;
  view_count: number;
  video_count: number;
}

export interface ChannelMetricsSnapshot {
  subscriber_count: number | null;
  view_count: number | null;
  video_count: number | null;
  avg_views_per_video: number | null;
  engagement_rate: number | null;
}

export interface PeriodMetricsResult {
  range: MetricsRange;
  subscribers: number | null;
  totalViews: number | null;
  avgViews: number | null;
  videos: number | null;
  engagement: number | null;
  rangeLabel: string;
  totalViewsLabel: string;
  videosLabel: string;
  subscribersLabel: string;
  source: "channel" | "analytics" | "videos";
}

function daysForRange(range: MetricsRange): number {
  return range === "28" ? 28 : 90;
}

function filterAnalyticsByRange(
  points: AnalyticsRow[],
  range: MetricsRange
): AnalyticsRow[] {
  if (range === "all") return points;
  const cutoff = Date.now() - daysForRange(range) * 24 * 60 * 60 * 1000;
  return points.filter((p) => new Date(p.recorded_at).getTime() >= cutoff);
}

function metricsFromAnalytics(
  channel: ChannelMetricsSnapshot,
  points: AnalyticsRow[],
  range: MetricsRange
): PeriodMetricsResult | null {
  if (points.length < 2) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const subDelta = (last.subscriber_count ?? 0) - (first.subscriber_count ?? 0);
  const viewDelta = last.view_count - first.view_count;
  const videoDelta = last.video_count - first.video_count;

  const avgViews =
    channel.avg_views_per_video ??
    (channel.view_count && channel.video_count
      ? Math.round(channel.view_count / channel.video_count)
      : null);

  return {
    range,
    subscribers: subDelta,
    totalViews: viewDelta,
    avgViews,
    videos: videoDelta,
    engagement: channel.engagement_rate,
    rangeLabel: `${daysForRange(range)}d change`,
    totalViewsLabel: "View growth",
    videosLabel: "Videos added",
    subscribersLabel: "Subscriber growth",
    source: "analytics",
  };
}

export async function computePeriodMetrics(
  channelId: string,
  channel: ChannelMetricsSnapshot,
  analytics: AnalyticsRow[],
  range: MetricsRange
): Promise<PeriodMetricsResult> {
  if (range === "all") {
    const engagement =
      channel.engagement_rate ??
      (channel.avg_views_per_video && channel.subscriber_count
        ? channel.avg_views_per_video / channel.subscriber_count
        : null);

    return {
      range,
      subscribers: channel.subscriber_count,
      totalViews: channel.view_count,
      avgViews: channel.avg_views_per_video,
      videos: channel.video_count,
      engagement,
      rangeLabel: "",
      totalViewsLabel: "Total views",
      videosLabel: "Videos",
      subscribersLabel: "Subscribers",
      source: "channel",
    };
  }

  const filtered = filterAnalyticsByRange(analytics, range);
  const fromAnalytics = metricsFromAnalytics(channel, filtered, range);
  if (fromAnalytics) return fromAnalytics;

  const days = daysForRange(range);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const playlistSize = range === "28" ? 50 : 100;
  const videos = await getChannelVideos(channelId, playlistSize, "recent");
  const inRange = videos.filter(
    (v) => v.published_at && new Date(v.published_at).getTime() >= cutoff
  );

  const totalViews = inRange.reduce((sum, v) => sum + v.view_count, 0);
  const avgViews =
    inRange.length > 0 ? Math.round(totalViews / inRange.length) : null;
  const engagement =
    avgViews && channel.subscriber_count
      ? avgViews / channel.subscriber_count
      : null;

  return {
    range,
    subscribers: channel.subscriber_count,
    totalViews,
    avgViews,
    videos: inRange.length,
    engagement,
    rangeLabel: `last ${days} days`,
    totalViewsLabel: "Views on new videos",
    videosLabel: "Videos posted",
    subscribersLabel: "Subscribers (current)",
    source: "videos",
  };
}
