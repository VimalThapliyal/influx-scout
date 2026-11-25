"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Channel } from "@/lib/types";
import { BookmarkPlus, ChevronLeft, Mail, RefreshCw } from "lucide-react";
import {
  Avatar,
  ContactPanel,
  EmptyState,
  formatNumber,
  formatEngagement,
  ProfileTrustBanner,
  StatusTag,
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
  label,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-md border border-line-strong bg-surface p-0.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          aria-pressed={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={`h-7 rounded-sm px-2.5 text-[0.8125rem] font-medium transition-colors ${
            value === opt.id ? "bg-subtle text-fg" : "text-muted hover:text-fg"
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

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading creator">
        <div className="flex items-center gap-4">
          <span className="skeleton h-14 w-14 rounded-full" />
          <div className="space-y-2">
            <div className="skeleton h-5 w-56" />
            <div className="skeleton h-3 w-40" />
          </div>
        </div>
        <div className="skeleton h-20 w-full" />
        <div className="skeleton h-48 w-full" />
      </div>
    );
  }
  if (!channel) {
    return (
      <EmptyState
        title="We couldn&rsquo;t find this creator"
        description="The channel may have been removed from Influx or from YouTube."
        action={
          <Link href="/channels" className="btn-secondary btn-sm">
            Back to creators
          </Link>
        }
      />
    );
  }

  const tags = inferTags(channel.title, channel.description, channel.primary_niche);
  const metricsExpired =
    youtubeMetricsStatus(channel.metrics_expires_at, channel.metrics_fetched_at) === "expired";
  const metrics = [
    { label: periodMetrics?.subscribersLabel ?? "Subscribers", value: formatMetricValue(periodMetrics?.subscribers, isDeltaMetrics) },
    { label: "Average views", value: formatNumber(periodMetrics?.avgViews) },
    { label: "Engagement", value: formatEngagement(periodMetrics?.engagement) },
    { label: periodMetrics?.totalViewsLabel ?? "Total views", value: formatMetricValue(periodMetrics?.totalViews, isDeltaMetrics) },
    { label: periodMetrics?.videosLabel ?? "Videos", value: formatMetricValue(periodMetrics?.videos, isDeltaMetrics) },
    { label: "Influx score", value: String(channel.influencer_score) },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <Link href="/channels" className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-muted hover:text-fg">
        <ChevronLeft size={14} strokeWidth={1.75} aria-hidden />
        Creators
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar src={channel.thumbnail_url} name={channel.title} size={56} />
          <div className="min-w-0">
            <h1 className="h-page break-words">{channel.title}</h1>
            <p className="mt-1 text-sm text-muted">
              <a href={youtubeChannelUrl(channel)} target="_blank" rel="noopener noreferrer" className="text-link">
                {channel.handle ?? "View on YouTube"}
              </a>
              {channel.country ? `, ${countryLabel(channel.country)}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {channel.quality_pass === true && <StatusTag tone="success">Ready for outreach</StatusTag>}
              {channel.is_inactive === true && <StatusTag tone="warn">Inactive</StatusTag>}
              {tags.map((t) => (
                <StatusTag key={t}>{t}</StatusTag>
              ))}
              {channel.tier && <TierBadge tier={channel.tier} />}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={refreshChannel}
            disabled={refreshing}
            className="btn-ghost"
            title="Update subscriber, view and video counts from YouTube"
          >
            <RefreshCw size={15} strokeWidth={1.75} aria-hidden className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
          <button type="button" onClick={() => setShowSave(true)} className="btn-secondary">
            <BookmarkPlus size={15} strokeWidth={1.75} aria-hidden />
            Add to campaign
          </button>
          <button type="button" onClick={() => setShowOutreach(true)} className="btn-primary">
            <Mail size={15} strokeWidth={1.75} aria-hidden />
            Draft outreach email
          </button>
        </div>
      </header>

      <section aria-labelledby="metrics-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="metrics-title" className="h-section">Performance</h2>
            {periodMetrics?.rangeLabel && (
              <p className="text-xs text-muted">
                {periodMetrics.rangeLabel}
                {periodMetrics.source === "videos" ? ", based on recent uploads" : ""}
              </p>
            )}
          </div>
          <TabGroup
            label="Time range"
            value={metricsRange}
            onChange={(id) => setMetricsRange(id as MetricsRange)}
            options={[
              { id: "28", label: "28 days" },
              { id: "90", label: "90 days" },
              { id: "all", label: "All time" },
            ]}
          />
        </div>
        {metricsExpired && (
          <p className="mb-3 rounded-md bg-warn-soft px-3 py-2 text-[0.8125rem] text-warn">
            These numbers are more than 30 days old. Refresh to get current counts.
          </p>
        )}
        <dl className={`card grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x lg:divide-line ${metricsLoading ? "opacity-60" : ""}`} aria-busy={metricsLoading}>
          {metrics.map((m) => (
            <div key={m.label} className="px-4 py-3.5">
              <dt className="text-xs text-muted">{m.label}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums tracking-[-0.01em] text-fg">{m.value}</dd>
            </div>
          ))}
        </dl>

        {chartPoints.length > 1 && (
          <figure className="card mt-3 p-4">
            <figcaption className="text-xs text-muted">
              Subscribers over time{metricsRange !== "all" ? `, last ${metricsRange} days` : ""}
            </figcaption>
            <div className="mt-3 flex h-20 items-end gap-1">
              {chartPoints.map((point, i) => {
                const max = Math.max(...chartPoints.map((a) => a.subscriber_count ?? 0));
                const h = max > 0 ? ((point.subscriber_count ?? 0) / max) * 100 : 0;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm bg-accent/70"
                    style={{ height: `${Math.max(h, 4)}%` }}
                    title={`${point.subscriber_count?.toLocaleString()} on ${new Date(point.recorded_at).toLocaleDateString()}`}
                  />
                );
              })}
            </div>
          </figure>
        )}
      </section>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="videos-title" className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="videos-title" className="h-section">Videos</h2>
              <TabGroup
                label="Video order"
                value={videoTab}
                onChange={(id) => setVideoTab(id as "recent" | "popular")}
                options={[
                  { id: "recent", label: "Most recent" },
                  { id: "popular", label: "Most viewed" },
                ]}
              />
            </div>

            {videosLoading ? (
              <div className="flex gap-3 overflow-hidden" role="status" aria-label="Loading videos">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="w-44 shrink-0 space-y-2">
                    <div className="skeleton aspect-video w-full" />
                    <div className="skeleton h-3 w-full" />
                    <div className="skeleton h-3 w-16" />
                  </div>
                ))}
              </div>
            ) : videos.length === 0 ? (
              <p className="card px-4 py-5 text-sm text-muted">
                No videos are stored for this creator yet. Use Refresh to load them from YouTube.
              </p>
            ) : (
              <div className="flex min-w-0 gap-3 overflow-x-auto pb-2">
                {videos.map((v) => (
                  <a
                    key={v.id}
                    href={`https://www.youtube.com/watch?v=${v.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group w-44 shrink-0"
                  >
                    <div className="relative overflow-hidden rounded-md border border-line bg-subtle">
                      {v.thumbnail_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.thumbnail_url} alt="" loading="lazy" className="aspect-video w-full object-cover" />
                      )}
                      {v.duration && (
                        <span className="absolute bottom-1 right-1 rounded-sm bg-fg/80 px-1 text-[0.6875rem] font-medium tabular-nums text-surface">
                          {formatDuration(v.duration)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-[0.8125rem] font-medium text-fg group-hover:text-accent">{v.title}</p>
                    <p className="mt-0.5 text-xs tabular-nums text-muted">{formatNumber(v.view_count)} views</p>
                  </a>
                ))}
              </div>
            )}
          </section>

          {channel.description && (
            <section aria-labelledby="about-title">
              <h2 id="about-title" className="h-section">About</h2>
              <p className="mt-2 line-clamp-6 max-w-2xl whitespace-pre-wrap break-words text-sm leading-relaxed text-muted">
                {channel.description}
              </p>
            </section>
          )}
        </div>

        <aside className="min-w-0 space-y-4">
          <section className="card p-4" aria-labelledby="contact-title">
            <h2 id="contact-title" className="h-section mb-3">Contact</h2>
            <ContactPanel channel={channel} />
          </section>
          <ProfileTrustBanner channel={channel} />
        </aside>
      </div>

      <SaveToCampaignModal
        channelId={channel.id}
        channelTitle={channel.title}
        open={showSave}
        onClose={() => setShowSave(false)}
      />

      <EmailOutreachModal channel={channel} open={showOutreach} onClose={() => setShowOutreach(false)} />
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
