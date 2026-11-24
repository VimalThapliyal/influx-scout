"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Channel } from "@/lib/types";
import {
  ContactPanel,
  formatNumber,
  formatEngagement,
  LoadingSpinner,
  ProfileTrustBanner,
  TierBadge,
} from "@/components/ui";
import { countryLabel, inferTags, youtubeChannelUrl } from "@/lib/tags";
import { youtubeMetricsStatus } from "@/lib/youtube-metrics";
import { SaveToCampaignModal } from "@/components/SaveToCampaignModal";
import { EmailOutreachModal } from "@/components/EmailOutreachModal";
import type { PeriodMetricsResult } from "@/lib/channel-metrics";

interface Video {
  id: string;
  title: string;
  thumbnail_url: string | null;
  published_at: string;
  view_count: number;
  duration: string | null;
}

interface AnalyticsPoint {
  recorded_at: string;
  subscriber_count: number | null;
  view_count: number;
  video_count?: number;
}

type MetricsRange = "28" | "90" | "all";

function filterAnalyticsByRange(
  points: AnalyticsPoint[],
  range: MetricsRange
): AnalyticsPoint[] {
  if (range === "all") return points;
  const days = range === "28" ? 28 : 90;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return points.filter((p) => new Date(p.recorded_at).getTime() >= cutoff);
}

function TabGroup({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5 text-sm">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`rounded-md px-3 py-1 transition ${
            value === opt.id ? "bg-mkt-tally/20 text-mkt-tally" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function formatMetricValue(
  value: number | null | undefined,
  asDelta: boolean
): string {
  if (value == null) return "—";
  if (asDelta) {
    return `${value >= 0 ? "+" : ""}${formatNumber(value)}`;
  }
  return formatNumber(value);
}

export default function ChannelDetailPage({ params }: { params: { id: string } }) {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [videoTab, setVideoTab] = useState<"recent" | "popular">("recent");
  const [metricsRange, setMetricsRange] = useState<MetricsRange>("all");
  const [showSave, setShowSave] = useState(false);
  const [showOutreach, setShowOutreach] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [videosLoading, setVideosLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [periodMetrics, setPeriodMetrics] = useState<PeriodMetricsResult | null>(
    null
  );

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [chRes, anaRes] = await Promise.all([
          fetch(`/api/channels/${params.id}`),
          fetch(`/api/channels/${params.id}/analytics`),
        ]);
        if (chRes.ok) setChannel(await chRes.json());
        if (anaRes.ok) {
          const d = await anaRes.json();
          setAnalytics(d.analytics ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  useEffect(() => {
    async function loadVideos() {
      setVideosLoading(true);
      try {
        const res = await fetch(
          `/api/channels/${params.id}/videos?limit=8&sort=${videoTab}`
        );
        if (res.ok) {
          const d = await res.json();
          setVideos(d.videos ?? []);
        }
      } finally {
        setVideosLoading(false);
      }
    }

    loadVideos();
  }, [params.id, videoTab]);

  useEffect(() => {
    async function loadMetrics() {
      setMetricsLoading(true);
      try {
        const res = await fetch(
          `/api/channels/${params.id}/metrics?range=${metricsRange}`
        );
        if (res.ok) {
          const d = await res.json();
          setPeriodMetrics(d.metrics ?? null);
        }
      } finally {
        setMetricsLoading(false);
      }
    }

    loadMetrics();
  }, [params.id, metricsRange]);

  const filteredAnalytics = useMemo(
    () => filterAnalyticsByRange(analytics, metricsRange),
    [analytics, metricsRange]
  );

  const chartPoints = useMemo(
    () =>
      filteredAnalytics.length > 1
        ? filteredAnalytics.slice(-14)
        : analytics.slice(-14),
    [filteredAnalytics, analytics]
  );

  const isDeltaMetrics = periodMetrics?.source === "analytics";

  async function refreshChannel() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/channels/${params.id}`, { method: "POST" });
      if (res.ok) {
        setChannel(await res.json());
        const metricsRes = await fetch(
          `/api/channels/${params.id}/metrics?range=${metricsRange}`
        );
        if (metricsRes.ok) {
          const d = await metricsRes.json();
          setPeriodMetrics(d.metrics ?? null);
        }
        const anaRes = await fetch(`/api/channels/${params.id}/analytics`);
        if (anaRes.ok) {
          const d = await anaRes.json();
          setAnalytics(d.analytics ?? []);
        }
      }
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (!channel) {
    return (
      <div className="card py-16 text-center">
        <p className="text-slate-400">Channel not found.</p>
        <Link href="/channels" className="btn-primary mt-4 inline-flex">
          Back to your database
        </Link>
      </div>
    );
  }

  const tags = inferTags(
    channel.title,
    channel.description,
    channel.primary_niche
  );

  return (
    <div className="min-w-0 space-y-6">
      <Link href="/channels" className="text-link text-sm">
        ← Back to your database
      </Link>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="card min-w-0 p-6">
          <div className="flex flex-col items-center text-center">
            {channel.thumbnail_url ? (
              <img
                src={channel.thumbnail_url}
                alt=""
                className="h-24 w-24 rounded-full object-cover ring-4 ring-white/10"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10 text-2xl font-medium text-white">
                {channel.title.charAt(0)}
              </div>
            )}
            <h1 className="mt-4 break-words text-lg font-medium text-white">{channel.title}</h1>
            <a
              href={youtubeChannelUrl(channel)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link mt-1 text-sm"
            >
              {channel.handle ?? "View channel"}
            </a>
            <p className="mt-2 text-xs text-slate-500">
              {formatNumber(channel.video_count)} videos · {formatNumber(channel.subscriber_count)} subscribers · {countryLabel(channel.country)}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {tags.map((t) => (
                <span key={t} className="tag-pill bg-mkt-tally/15 text-mkt-tally">
                  {t}
                </span>
              ))}
              {channel.tier && <TierBadge tier={channel.tier} />}
            </div>
          </div>

          <div className="mt-5">
            <ProfileTrustBanner channel={channel} />
          </div>

          <div className="mt-6 space-y-2">
            <ContactPanel channel={channel} />
            <button type="button" onClick={() => setShowSave(true)} className="btn-secondary w-full">
              Add to campaign list
            </button>
            <button type="button" onClick={() => setShowOutreach(true)} className="btn-primary w-full gap-2">
              ✦ Write outreach email
            </button>
            <button
              type="button"
              onClick={refreshChannel}
              disabled={refreshing}
              className="btn-ghost w-full text-sm"
            >
              {refreshing ? "Refreshing…" : "Refresh from YouTube"}
            </button>
            <p className="text-center text-[11px] text-slate-600">
              Refresh updates subscriber, view, and video counts
            </p>
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          <section className="card min-w-0 overflow-hidden p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="section-title">Featured videos</h2>
                <p className="text-sm text-slate-500">
                  {videoTab === "popular"
                    ? "Top videos by view count"
                    : "Latest uploads from this channel"}
                </p>
              </div>
              <TabGroup
                value={videoTab}
                onChange={(id) => setVideoTab(id as "recent" | "popular")}
                options={[
                  { id: "popular", label: "Popular videos" },
                  { id: "recent", label: "Recent videos" },
                ]}
              />
            </div>

            {videosLoading ? (
              <div className="mt-6 flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : videos.length === 0 ? (
              <p className="mt-6 text-sm text-slate-500">No videos loaded. Try refreshing the channel.</p>
            ) : (
              <div className="mt-4 flex min-w-0 gap-4 overflow-x-auto pb-2">
                {videos.map((v) => (
                  <a
                    key={v.id}
                    href={`https://www.youtube.com/watch?v=${v.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-48 shrink-0"
                  >
                    <div className="relative overflow-hidden rounded-lg bg-white/10">
                      {v.thumbnail_url && (
                        <img src={v.thumbnail_url} alt="" className="aspect-video w-full object-cover" />
                      )}
                      {v.duration && (
                        <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 text-xs text-white">
                          {formatDuration(v.duration)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-medium text-white">{v.title}</p>
                    <p className="text-xs text-slate-500">{formatNumber(v.view_count)} views</p>
                  </a>
                ))}
              </div>
            )}
          </section>

          <section className="card min-w-0 overflow-hidden p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="section-title">Core metrics</h2>
                {periodMetrics?.rangeLabel && (
                  <p className="text-sm text-slate-500">
                    Showing {periodMetrics.rangeLabel}
                    {periodMetrics.source === "videos"
                      ? " · based on recent uploads"
                      : ""}
                  </p>
                )}
                {youtubeMetricsStatus(
                  channel.metrics_expires_at,
                  channel.metrics_fetched_at
                ) === "expired" ? (
                  <p className="mt-1 text-sm text-amber-400/90">
                    YouTube snapshot is past its 30-day window — refresh for current counts.
                  </p>
                ) : null}
              </div>
              <TabGroup
                value={metricsRange}
                onChange={(id) => setMetricsRange(id as MetricsRange)}
                options={[
                  { id: "28", label: "28 days" },
                  { id: "90", label: "90 days" },
                  { id: "all", label: "All time" },
                ]}
              />
            </div>

            {metricsLoading ? (
              <div className="mt-6 flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <MetricCard
                  label={periodMetrics?.subscribersLabel ?? "Subscribers"}
                  value={formatMetricValue(
                    periodMetrics?.subscribers,
                    isDeltaMetrics
                  )}
                />
                <MetricCard
                  label={periodMetrics?.totalViewsLabel ?? "Total views"}
                  value={formatMetricValue(
                    periodMetrics?.totalViews,
                    isDeltaMetrics
                  )}
                />
                <MetricCard
                  label="Avg views"
                  value={formatNumber(periodMetrics?.avgViews)}
                />
                <MetricCard
                  label="Engagement"
                  value={formatEngagement(periodMetrics?.engagement)}
                />
                <MetricCard
                  label="Influencer score"
                  value={String(channel.influencer_score)}
                />
                <MetricCard
                  label={periodMetrics?.videosLabel ?? "Videos"}
                  value={formatMetricValue(periodMetrics?.videos, isDeltaMetrics)}
                />
                <MetricCard label="Tier" value={channel.tier ?? "—"} />
              </div>
            )}

            {chartPoints.length > 1 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-slate-500">
                  Subscriber history
                  {metricsRange !== "all" ? ` — last ${metricsRange} days` : ""}
                </h3>
                <div className="mt-3 flex h-24 items-end gap-1">
                  {chartPoints.map((point, i) => {
                    const max = Math.max(
                      ...chartPoints.map((a) => a.subscriber_count ?? 0)
                    );
                    const h = max > 0 ? ((point.subscriber_count ?? 0) / max) * 100 : 0;
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-mkt-tally opacity-80"
                        style={{ height: `${Math.max(h, 4)}%` }}
                        title={`${point.subscriber_count?.toLocaleString()} on ${new Date(point.recorded_at).toLocaleDateString()}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {channel.description && (
            <section className="card min-w-0 overflow-hidden p-6">
              <h2 className="section-title">About</h2>
              <p className="mt-3 line-clamp-6 break-words whitespace-pre-wrap text-sm text-slate-400">
                {channel.description}
              </p>
            </section>
          )}
        </div>
      </div>

      <SaveToCampaignModal
        channelId={channel.id}
        channelTitle={channel.title}
        open={showSave}
        onClose={() => setShowSave(false)}
      />

      <EmailOutreachModal
        channel={channel}
        open={showOutreach}
        onClose={() => setShowOutreach(false)}
      />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-box">
      <p className="metric-label">{label}</p>
      <p className="metric-value mt-1 break-words text-lg capitalize">{value}</p>
    </div>
  );
}

function formatDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";
  const h = match[1] ? `${match[1]}:` : "";
  const m = (match[2] ?? "0").padStart(h ? 2 : 1, "0");
  const s = (match[3] ?? "0").padStart(2, "0");
  return h ? `${h}${m}:${s}` : `${m}:${s}`;
}
