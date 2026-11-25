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
  fresh: "bg-success-soft text-success",
  recent: "bg-subtle text-fg",
  stale: "bg-warn-soft text-warn",
  unknown: "bg-subtle text-muted",
} as const;

const metricsStyles = {
  current: "bg-success-soft text-success",
  expiring_soon: "bg-warn-soft text-warn",
  expired: "bg-danger-soft text-danger",
  unknown: "bg-subtle text-muted",
} as const;

const confStyles = {
  confirmed: "bg-success-soft text-success",
  high: "bg-success-soft text-success",
  medium: "bg-subtle text-fg",
  low: "bg-warn-soft text-warn",
  unknown: "bg-subtle text-muted",
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
      className={`flex flex-wrap items-center gap-1.5 ${compact ? "text-xs" : "text-xs"}`}
    >
      <span className={`rounded-sm px-1.5 py-0.5 font-medium ${freshnessStyles[level]}`}>
        {freshnessLabel(level)}
      </span>
      {channel.quality_pass === true ? (
        <span
          className="rounded-md bg-success-soft px-1.5 py-0.5 font-medium text-success"
          title="Last-5 views, upload≤45d, engagement≥2%, Tier 1/2"
        >
          Outreach ready
        </span>
      ) : null}
      {channel.is_emerging === true ? (
        <span className="rounded-md bg-accent-soft px-1.5 py-0.5 font-medium text-accent">
          Emerging
        </span>
      ) : null}
      {channel.is_inactive === true ? (
        <span className="rounded-md bg-subtle px-1.5 py-0.5 font-medium text-muted">
          Inactive
        </span>
      ) : null}
      {niche ? (
        <span
          className="rounded-md bg-accent-soft px-1.5 py-0.5 font-medium text-accent"
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
          className={`rounded-sm px-1.5 py-0.5 font-medium ${metricsStyles[metricsStatus]}`}
          title={channel.metrics_expires_at ?? undefined}
        >
          {metricsStatus === "expired" ? "Metrics expired" : "Metrics expiring"}
        </span>
      ) : null}
      {relative ? <span className="text-muted">Updated {relative}</span> : null}
      {channel.country ? (
        <>
          <span className="text-muted">·</span>
          <span
            className={`rounded-sm px-1.5 py-0.5 font-medium ${confStyles[countryConf] ?? confStyles.unknown}`}
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
    <div className="card p-4 text-left">
      <h2 className="h-section">Data quality</h2>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={`rounded-sm px-1.5 py-0.5 text-xs font-medium ${freshnessStyles[level]}`}>
          {freshnessLabel(level)}
        </span>
        <span
          className={`rounded-sm px-1.5 py-0.5 text-xs font-medium ${metricsStyles[metricsStatus]}`}
        >
          {metricsLabel}
        </span>
        <span className="text-xs text-muted">
          {relative ? `Refreshed ${relative}` : "Refresh time unknown"}
        </span>
      </div>
      {niche ? (
        <p className="mt-1.5 text-xs text-muted">
          Niche:{" "}
          <span className="text-fg">
            {nicheLabel(niche)}
            {nichePct ? ` · ${nichePct} confidence` : ""}
          </span>
          {nicheEvidence.length > 0 ? (
            <span className="text-muted">
              {" "}
              · evidence: {nicheEvidence.slice(0, 3).join(", ")}
            </span>
          ) : null}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-muted">Niche: not classified yet</p>
      )}
      <p className="mt-1 text-xs text-muted">
        {channel.country ? (
          <>
            Likely country:{" "}
            <span className="text-fg">{countryLabel(channel.country)}</span>
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
        <ul className="mt-1 list-inside list-disc text-xs text-muted">
          {countryEvidence.slice(0, 3).map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {metricsFetched && metricsStatus !== "unknown" ? (
        <p className="mt-1.5 text-xs text-muted">
          Metrics refreshed {metricsFetched}
        </p>
      ) : null}
      {emailHint ? (
        <p className="mt-1.5 text-xs text-muted">
          <span className="text-fg">{emailHint}</span>
        </p>
      ) : null}
      {sourceType || sourceHost ? (
        <p className="mt-1 text-xs text-muted">
          Contact:{" "}
          <span className="text-fg">
            {[sourceType, sourceHost].filter(Boolean).join(" · ")}
          </span>
        </p>
      ) : null}
    </div>
  );
}
