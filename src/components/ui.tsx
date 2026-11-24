"use client";

import Link from "next/link";
import type { Channel, Tier } from "@/lib/types";
import { countryLabel, inferTags, youtubeAboutUrl, youtubeChannelUrl } from "@/lib/tags";
import { EmailGate } from "@/components/EmailGate";
import { ChannelTrustMeta } from "@/components/ChannelTrustMeta";
import { emailStatusLabel } from "@/lib/profile-trust";
import { PAYMENTS_ENABLED, UPGRADE_LABEL } from "@/lib/billing";
import {
  emailSourceHost,
  emailSourceTypeLabel,
} from "@/lib/contact-provenance";
import {
  emailValidationLabel,
  emailValidationTone,
} from "@/lib/email-validation-labels";

export { formatRelativeUpdated } from "@/lib/profile-trust";
export { ChannelTrustMeta, ProfileTrustBanner } from "@/components/ChannelTrustMeta";

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatEngagement(rate: number | null | undefined): string {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

const tierColors: Record<Tier, string> = {
  nano: "bg-slate-500/20 text-slate-400",
  micro: "bg-cyan-500/15 text-cyan-400",
  mid: "bg-mkt-signal/15 text-mkt-signal",
  macro: "bg-fuchsia-500/15 text-fuchsia-400",
  mega: "bg-mkt-tally/15 text-mkt-tally",
};

export function TierBadge({ tier }: { tier: Tier | null }) {
  if (!tier) return null;
  return <span className={`tag-pill capitalize ${tierColors[tier]}`}>{tier}</span>;
}

export function TagPills({ channel }: { channel: Channel }) {
  const tags = inferTags(channel.title, channel.description, channel.primary_niche);
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span key={tag} className="tag-pill">{tag}</span>
      ))}
      {tags.length === 0 && channel.tier && <TierBadge tier={channel.tier} />}
    </div>
  );
}

export function channelHasEmailContact(channel: Channel): boolean {
  return !!(channel.has_email || channel.email);
}

export function CreatorGridCard({
  channel,
  onSave,
  onOutreach,
  addedLabel,
  showEmailBadge = false,
  showTrustMeta = true,
}: {
  channel: Channel;
  onSave?: (id: string) => void;
  onOutreach?: (id: string) => void;
  addedLabel?: string;
  showEmailBadge?: boolean;
  showTrustMeta?: boolean;
}) {
  const engagement =
    channel.engagement_rate ??
    (channel.avg_views_per_video && channel.subscriber_count
      ? Math.min(channel.avg_views_per_video / channel.subscriber_count, 0.1)
      : null);

  const scoreColor =
    channel.influencer_score >= 80
      ? "text-mkt-signal"
      : channel.influencer_score >= 60
        ? "text-mkt-tally"
        : "text-mkt-ash";

  return (
    <article className="group card flex h-full flex-col overflow-hidden transition hover:border-mkt-tally/30">
      <div className="p-5">
        <div className="flex items-start gap-3">
          {channel.thumbnail_url ? (
            <img
              src={channel.thumbnail_url}
              alt=""
              className="h-12 w-12 shrink-0 rounded-sm object-cover ring-1 ring-mkt-manila/20"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-mkt-manila/25 font-poster text-lg text-mkt-paper">
              {channel.title.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-mkt-paper transition group-hover:text-mkt-tally">
              {channel.title}
            </h3>
            <p className="mt-0.5 font-mono text-xs text-mkt-ash">
              {countryLabel(channel.country)} · {formatNumber(channel.video_count)} videos
              {addedLabel ? ` · ${addedLabel}` : ""}
            </p>
            {showTrustMeta ? (
              <div className="mt-1.5">
                <ChannelTrustMeta channel={channel} compact />
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {showEmailBadge && (channel.email || channel.has_email) && (
              <span className="rounded-sm bg-mkt-signal/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-mkt-signal">
                Email
              </span>
            )}
            <div className={`rounded-sm border border-mkt-manila/20 px-2 py-1 font-mono text-xs font-bold ${scoreColor}`}>
              {channel.influencer_score}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <TagPills channel={channel} />
        </div>
      </div>

      <div className="mt-auto grid grid-cols-3 gap-px border-t border-mkt-manila/15 bg-mkt-manila/10">
        {[
          { label: "Subs", value: formatNumber(channel.subscriber_count) },
          { label: "Views", value: formatNumber(channel.avg_views_per_video) },
          { label: "Engage", value: formatEngagement(engagement) },
        ].map((m) => (
          <div key={m.label} className="bg-[#1B1F27] px-3 py-3 text-center">
            <p className="metric-label">{m.label}</p>
            <p className="metric-value mt-0.5">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-mkt-manila/15 p-3">
        {onOutreach && channelHasEmailContact(channel) && (
          <button
            type="button"
            onClick={() => onOutreach(channel.id)}
            className="btn-primary min-h-[36px] flex-1 gap-1.5 text-xs"
            title={channel.email_locked ? `${UPGRADE_LABEL}: send from mail app` : "Write outreach email"}
          >
            <MailIcon />
            Outreach
          </button>
        )}
        <Link
          href={`/channels/${channel.id}`}
          className={`btn-ghost min-h-[36px] text-xs ${
            onOutreach && channelHasEmailContact(channel) ? "px-3" : "flex-1"
          }`}
        >
          Profile
        </Link>
        {onSave && (
          <button
            type="button"
            onClick={() => onSave(channel.id)}
            className="flex h-9 w-9 items-center justify-center rounded-sm border border-mkt-manila/20 text-mkt-ash transition hover:border-mkt-tally/40 hover:bg-mkt-tally/10 hover:text-mkt-tally"
            aria-label="Add to campaign"
          >
            <BookmarkIcon />
          </button>
        )}
        <a
          href={youtubeChannelUrl(channel)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 w-9 items-center justify-center rounded-sm border border-mkt-manila/20 text-mkt-ash transition hover:border-mkt-manila/40 hover:text-mkt-paper"
          aria-label="Open on YouTube"
        >
          <ExternalIcon />
        </a>
      </div>
    </article>
  );
}

export function CreatorListRow({
  channel,
  onSave,
  onOutreach,
  addedLabel,
  showEmailBadge = false,
  showTrustMeta = true,
}: {
  channel: Channel;
  onSave?: (id: string) => void;
  onOutreach?: (id: string) => void;
  addedLabel?: string;
  showEmailBadge?: boolean;
  showTrustMeta?: boolean;
}) {
  return (
    <article className="card flex flex-wrap items-center gap-3 p-4 transition hover:border-mkt-tally/30 sm:gap-4">
      <Link href={`/channels/${channel.id}`} className="shrink-0">
        {channel.thumbnail_url ? (
          <img src={channel.thumbnail_url} alt="" className="h-11 w-11 rounded-sm object-cover" />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-sm border border-mkt-manila/25 font-poster text-mkt-paper">
            {channel.title.charAt(0)}
          </div>
        )}
      </Link>
      <div className="min-w-0 flex-1 basis-[40%]">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/channels/${channel.id}`}
            className="truncate font-medium text-mkt-paper hover:text-mkt-tally"
          >
            {channel.title}
          </Link>
          {showEmailBadge && (channel.email || channel.has_email) && (
            <span className="rounded-sm bg-mkt-signal/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-mkt-signal">
              Email
            </span>
          )}
        </div>
        <p className="font-mono text-xs text-mkt-ash">
          {formatNumber(channel.subscriber_count)} subs · {countryLabel(channel.country)}
          {addedLabel ? ` · ${addedLabel}` : ""}
        </p>
        {showTrustMeta ? (
          <div className="mt-1">
            <ChannelTrustMeta channel={channel} compact />
          </div>
        ) : null}
      </div>
      <div className="hidden gap-6 sm:flex">
        <div className="text-right">
          <p className="metric-label">Avg views</p>
          <p className="metric-value">{formatNumber(channel.avg_views_per_video)}</p>
        </div>
        <div className="text-right">
          <p className="metric-label">Score</p>
          <p className="metric-value text-mkt-tally">{channel.influencer_score}</p>
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {onOutreach && channelHasEmailContact(channel) && (
          <button
            type="button"
            onClick={() => onOutreach(channel.id)}
            className="btn-primary min-h-[36px] gap-1.5 px-3 text-xs"
            title={channel.email_locked ? `${UPGRADE_LABEL}: send from mail app` : "Write outreach email"}
          >
            <MailIcon />
            Outreach
          </button>
        )}
        <Link href={`/channels/${channel.id}`} className="btn-ghost min-h-[36px] px-3 text-xs">
          Profile
        </Link>
        {onSave && (
          <button
            type="button"
            onClick={() => onSave(channel.id)}
            className="flex h-9 w-9 items-center justify-center rounded-sm border border-mkt-manila/20 text-mkt-ash transition hover:border-mkt-tally/40 hover:bg-mkt-tally/10 hover:text-mkt-tally"
            aria-label="Add to campaign"
          >
            <BookmarkIcon />
          </button>
        )}
        <a
          href={youtubeChannelUrl(channel)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 w-9 items-center justify-center rounded-sm border border-mkt-manila/20 text-mkt-ash transition hover:border-mkt-manila/40 hover:text-mkt-paper"
          aria-label="Open on YouTube"
        >
          <ExternalIcon />
        </a>
      </div>
    </article>
  );
}

export function ChannelCard({ channel }: { channel: Channel }) {
  return <CreatorGridCard channel={channel} />;
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20" role="status" aria-label="Loading">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-mkt-manila/20 border-t-mkt-tally" />
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="card py-20 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-sm border border-mkt-tally/30 text-2xl">
        ✦
      </div>
      <h3 className="font-poster text-lg uppercase tracking-tight text-mkt-paper">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-mkt-ash">{description}</p>
    </div>
  );
}

export function ContactPanel({ channel }: { channel: Channel }) {
  const aboutUrl = youtubeAboutUrl(channel);
  const hasContact = !!(
    channel.has_email ||
    channel.email ||
    channel.has_contact_form ||
    channel.contact_form_url ||
    channel.instagram ||
    channel.twitter ||
    channel.website
  );
  const statusHint = emailStatusLabel(channel.email_status);
  const sourceTypeLabel = emailSourceTypeLabel(channel.email_source_type);
  const sourceHost = emailSourceHost(channel.email_source_url);
  const hasProvenance = !!(channel.email_source_url || channel.email_source_type);
  const validationLabel = emailValidationLabel(channel.email_validation_status);
  const validationTone = emailValidationTone(channel.email_validation_status);
  const validationClass =
    validationTone === "ok"
      ? "text-mkt-signal"
      : validationTone === "warn"
        ? "text-mkt-tally"
        : validationTone === "bad"
          ? "text-red-400"
          : "text-mkt-ash";
  const formUrl = channel.contact_form_url;

  return (
    <div className="space-y-3">
      {channel.email && !channel.email_locked ? (
        <a href={`mailto:${channel.email}`} className="btn-primary w-full gap-2">
          <MailIcon /> Send email
        </a>
      ) : PAYMENTS_ENABLED ? (
        <Link href="/subscribe" className="btn-primary w-full gap-2">
          <MailIcon /> Unlock contact
        </Link>
      ) : null}

      <div className="rounded-sm border border-mkt-manila/20 bg-white/[0.02] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-xs font-medium uppercase tracking-wide text-mkt-ash">Email</p>
          {statusHint ? (
            <span className="text-[10px] font-medium text-mkt-ash">{statusHint}</span>
          ) : null}
        </div>
        <div className="mt-1">
          <EmailGate
            email={channel.email}
            maskedPreview={channel.email_masked}
            locked={channel.email_locked}
          />
        </div>
        {validationLabel ? (
          <p className={`mt-2 text-[11px] font-medium ${validationClass}`}>
            {validationLabel}
            {channel.email_is_role ? " · Role inbox" : ""}
          </p>
        ) : null}
        {hasProvenance ? (
          <div className="mt-2 space-y-0.5 border-t border-mkt-manila/15 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-mkt-ash/70">
              Contact source
            </p>
            <p className="text-[11px] text-mkt-ash">
              {sourceTypeLabel ?? "Public web"}
              {sourceHost ? ` · ${sourceHost}` : ""}
            </p>
            {channel.email_source_url ? (
              <a
                href={channel.email_source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-[11px] text-mkt-tally hover:brightness-110"
              >
                View source page
              </a>
            ) : null}
          </div>
        ) : null}
        {channel.email_status === "locked" && !channel.has_email && !channel.email ? (
          <p className="mt-2 text-[11px] leading-relaxed text-mkt-ash">
            A contact may exist on the channel&apos;s About or website, but it was locked
            (sign-in / captcha) when we last checked.
          </p>
        ) : null}
      </div>

      {(channel.has_contact_form || formUrl) && formUrl ? (
        <div className="rounded-sm border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
          <p className="text-xs font-medium text-cyan-300/90">Contact form</p>
          <p className="mt-1 text-[11px] text-mkt-ash">
            {channel.contact_form_purpose ?? "Public contact available"}
            {channel.contact_form_has_captcha ? " · CAPTCHA present" : ""}
          </p>
          <a
            href={formUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex text-[11px] font-medium text-cyan-400 hover:text-cyan-300"
          >
            Open contact page →
          </a>
          <p className="mt-1.5 text-[10px] text-mkt-ash/70">
            We never submit this form automatically.
          </p>
        </div>
      ) : null}

      {channel.website_robots_allowed === false ? (
        <p className="text-[11px] text-mkt-tally/90">
          Website crawl limited by robots.txt for CreatorScoutBot.
        </p>
      ) : null}

      <a href={aboutUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full gap-2 text-sm">
        <ExternalIcon /> YouTube About page
      </a>

      {!hasContact && (
        <p className="text-xs text-mkt-ash">
          {PAYMENTS_ENABLED
            ? "Upgrade to Pro to unlock emails, or check the YouTube About page directly."
            : "Emails unlock with Pro (coming soon). Check the YouTube About page directly."}
        </p>
      )}
      <div className="space-y-1 border-t border-mkt-manila/15 pt-3">
        {channel.website && <SocialRow icon="🌐" label="Website" href={channel.website} />}
        {channel.instagram && <SocialRow icon="IG" label="Instagram" href={channel.instagram} />}
        {channel.twitter && <SocialRow icon="X" label="Twitter" href={channel.twitter} />}
        {channel.tiktok && <SocialRow icon="TT" label="TikTok" href={channel.tiktok} />}
      </div>
    </div>
  );
}

function SocialRow({ icon, label, href }: { icon: string; label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-sm px-2 py-2 text-sm text-mkt-tally transition hover:bg-white/5"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-mkt-manila/20 text-xs font-medium text-mkt-ash">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </a>
  );
}

function BookmarkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}
