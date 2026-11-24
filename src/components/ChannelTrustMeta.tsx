"use client";

import type { Channel } from "@/lib/types";
import {
  emailStatusLabel,
  freshnessLabel,
  freshnessLevel,
  formatRelativeUpdated,
} from "@/lib/profile-trust";
import {
  emailSourceHost,
  emailSourceTypeLabel,
} from "@/lib/contact-provenance";
import {
  youtubeMetricsStatus,
  youtubeMetricsStatusLabel,
} from "@/lib/youtube-metrics";
import {
  countryConfidenceLabel,
  nicheLabel,
} from "@/lib/classify";
import { countryLabel } from "@/lib/tags";

const freshnessStyles = {
  fresh: "bg-emerald-500/15 text-emerald-400",
  recent: "bg-slate-500/20 text-slate-300",
  stale: "bg-amber-500/15 text-amber-400",
  unknown: "bg-white/10 text-slate-500",
} as const;

const metricsStyles = {
  current: "bg-emerald-500/15 text-emerald-400",
  expiring_soon: "bg-amber-500/15 text-amber-400",
  expired: "bg-rose-500/15 text-rose-400",
  unknown: "bg-white/10 text-slate-500",
} as const;

const confStyles = {
  confirmed: "bg-emerald-500/15 text-emerald-400",
  high: "bg-emerald-500/15 text-emerald-400",
  medium: "bg-slate-500/20 text-slate-300",
  low: "bg-amber-500/15 text-amber-400",
  unknown: "bg-white/10 text-slate-500",
} as const;

function nicheConfidencePct(n: number | null | undefined): string | null {
  if (n == null || Number.isNaN(n)) return null;
  return `${Math.round(n * 100)}%`;
}

/** Compact provenance line for cards and lists. */
export function ChannelTrustMeta({
  channel,
  compact = false,
}: {
  channel: Channel;
  compact?: boolean;
}) {
  const level = freshnessLevel(channel.last_updated);
  const relative = formatRelativeUpdated(channel.last_updated);
  const metricsStatus = youtubeMetricsStatus(
    channel.metrics_expires_at,
    channel.metrics_fetched_at
  );
  const niche = channel.primary_niche;
  const nichePct = nicheConfidencePct(channel.niche_confidence ?? null);
  const countryConf = channel.country_confidence ?? "unknown";

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${compact ? "text-[10px]" : "text-xs"}`}
    >
      <span className={`rounded-md px-1.5 py-0.5 font-medium ${freshnessStyles[level]}`}>
        {freshnessLabel(level)}
      </span>
      {channel.quality_pass === true ? (
        <span
          className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 font-medium text-emerald-400"
          title="Last-5 views, upload≤45d, engagement≥2%, Tier 1/2"
        >
          Outreach ready
        </span>
      ) : null}
      {channel.is_emerging === true ? (
        <span className="rounded-md bg-sky-500/15 px-1.5 py-0.5 font-medium text-sky-300">
          Emerging
        </span>
      ) : null}
      {channel.is_inactive === true ? (
        <span className="rounded-md bg-slate-500/20 px-1.5 py-0.5 font-medium text-slate-400">
          Inactive
        </span>
      ) : null}
      {niche ? (
        <span
          className="rounded-md bg-mkt-tally/15 px-1.5 py-0.5 font-medium text-mkt-tally"
          title={
            nichePct
              ? `Niche confidence ${nichePct}`
              : undefined
          }
        >
          {nicheLabel(niche)}
          {nichePct ? ` · ${nichePct}` : ""}
        </span>
      ) : null}
      {metricsStatus === "expired" || metricsStatus === "expiring_soon" ? (
        <span
          className={`rounded-md px-1.5 py-0.5 font-medium ${metricsStyles[metricsStatus]}`}
          title={channel.metrics_expires_at ?? undefined}
        >
          {metricsStatus === "expired" ? "Metrics expired" : "Metrics expiring"}
        </span>
      ) : null}
      {relative ? <span className="text-slate-500">Updated {relative}</span> : null}
      {channel.country ? (
        <>
          <span className="text-slate-600">·</span>
          <span
            className={`rounded-md px-1.5 py-0.5 font-medium ${confStyles[countryConf] ?? confStyles.unknown}`}
            title={countryConfidenceLabel(countryConf)}
          >
            {countryLabel(channel.country)}
          </span>
        </>
      ) : null}
    </div>
  );
}

/** Profile-side data quality strip. */
export function ProfileTrustBanner({ channel }: { channel: Channel }) {
  const level = freshnessLevel(channel.last_updated);
  const relative = formatRelativeUpdated(channel.last_updated);
  const emailHint = emailStatusLabel(channel.email_status);
  const sourceType = emailSourceTypeLabel(channel.email_source_type);
  const sourceHost = emailSourceHost(channel.email_source_url);
  const metricsStatus = youtubeMetricsStatus(
    channel.metrics_expires_at,
    channel.metrics_fetched_at
  );
  const metricsLabel = youtubeMetricsStatusLabel(metricsStatus);
  const metricsFetched = formatRelativeUpdated(channel.metrics_fetched_at);
  const niche = channel.primary_niche;
  const nichePct = nicheConfidencePct(channel.niche_confidence ?? null);
  const countryConf = channel.country_confidence ?? "unknown";
  const nicheEvidence = channel.niche_evidence?.filter(Boolean) ?? [];
  const countryEvidence = channel.country_evidence?.filter(Boolean) ?? [];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Data quality
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${freshnessStyles[level]}`}>
          {freshnessLabel(level)}
        </span>
        <span
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${metricsStyles[metricsStatus]}`}
        >
          {metricsLabel}
        </span>
        <span className="text-xs text-slate-400">
          {relative ? `Refreshed ${relative}` : "Refresh time unknown"}
        </span>
      </div>
      {niche ? (
        <p className="mt-1.5 text-xs text-slate-500">
          Niche:{" "}
          <span className="text-slate-300">
            {nicheLabel(niche)}
            {nichePct ? ` · ${nichePct} confidence` : ""}
          </span>
          {nicheEvidence.length > 0 ? (
            <span className="text-slate-500">
              {" "}
              · evidence: {nicheEvidence.slice(0, 3).join(", ")}
            </span>
          ) : null}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-slate-500">Niche: not classified yet</p>
      )}
      <p className="mt-1 text-xs text-slate-500">
        {channel.country ? (
          <>
            Likely country:{" "}
            <span className="text-slate-300">{countryLabel(channel.country)}</span>
            {" · "}
            <span
              className={
                confStyles[countryConf]
                  ? undefined
                  : undefined
              }
            >
              {countryConfidenceLabel(countryConf)}
            </span>
          </>
        ) : (
          <>Country: unknown</>
        )}
      </p>
      {countryEvidence.length > 0 ? (
        <ul className="mt-1 list-inside list-disc text-[11px] text-slate-600">
          {countryEvidence.slice(0, 3).map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {metricsFetched && metricsStatus !== "unknown" ? (
        <p className="mt-1.5 text-xs text-slate-500">
          Metrics refreshed {metricsFetched}
        </p>
      ) : null}
      {emailHint ? (
        <p className="mt-1.5 text-xs text-slate-500">
          <span className="text-slate-300">{emailHint}</span>
        </p>
      ) : null}
      {sourceType || sourceHost ? (
        <p className="mt-1 text-xs text-slate-500">
          Contact:{" "}
          <span className="text-slate-300">
            {[sourceType, sourceHost].filter(Boolean).join(" · ")}
          </span>
        </p>
      ) : null}
    </div>
  );
}
