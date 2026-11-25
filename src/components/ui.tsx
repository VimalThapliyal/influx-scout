"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AlertCircle, BookmarkPlus, ExternalLink, Mail, SearchX } from "lucide-react";
import type { Channel, Tier } from "@/lib/types";
import { countryLabel, inferTags, youtubeAboutUrl, youtubeChannelUrl } from "@/lib/tags";
import { EmailGate } from "@/components/EmailGate";
import { emailStatusLabel } from "@/lib/profile-trust";
import { PAYMENTS_ENABLED, UPGRADE_LABEL } from "@/lib/billing";
import { nicheLabel } from "@/lib/classify";
import { emailSourceHost, emailSourceTypeLabel } from "@/lib/contact-provenance";
import { emailValidationLabel, emailValidationTone } from "@/lib/email-validation-labels";

export { formatRelativeUpdated } from "@/lib/profile-trust";
export { ChannelTrustMeta, ProfileTrustBanner } from "@/components/ChannelTrustMeta";

/* ── Formatting ── */

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`;
  return n.toLocaleString();
}

export function formatEngagement(rate: number | null | undefined): string {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatDaysAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 60) return `${days} days ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/** Recent (last five uploads) numbers when scored, lifetime numbers otherwise. */
export function recentViews(c: Channel): number | null {
  return c.avg_views_last5 ?? c.avg_views_per_video ?? null;
}
export function recentEngagement(c: Channel): number | null {
  return c.engagement_last5 ?? c.engagement_rate ?? null;
}

export function channelHasEmailContact(channel: Channel): boolean {
  return !!(channel.has_email || channel.email);
}

/* ── Small pieces ── */

type Tone = "neutral" | "accent" | "success" | "warn" | "danger";
const toneClass: Record<Tone, string> = {
  neutral: "bg-subtle text-muted",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
};

export function StatusTag({ tone = "neutral", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`tag-pill whitespace-nowrap ${toneClass[tone]}`}>
      {children}
    </span>
  );
}

export function TierBadge({ tier }: { tier: Tier | null }) {
  if (!tier) return null;
  return <StatusTag>{tier.charAt(0).toUpperCase() + tier.slice(1)}</StatusTag>;
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

/** Channel thumbnail with an initial as fallback when the image is missing or fails to load. */
export function Avatar({ src, name, size = 32 }: { src: string | null | undefined; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (!src || failed) {
    return (
      <span
        style={style}
        aria-hidden
        className="flex shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-medium text-muted"
      >
        {name.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      style={style}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full bg-subtle object-cover"
    />
  );
}

export function IconButton({
  label,
  onClick,
  href,
  children,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  children: ReactNode;
}) {
  const cls =
    "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-subtle hover:text-fg";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={cls}>
      {children}
    </button>
  );
}

/* ── Creator table: the one way creators are listed in the app ── */

function ContactCell({ channel }: { channel: Channel }) {
  if (channelHasEmailContact(channel)) return <StatusTag tone="success">Email</StatusTag>;
  if (channel.has_contact_form) return <StatusTag>Contact form</StatusTag>;
  if (channel.instagram || channel.twitter || channel.website) return <StatusTag>Social</StatusTag>;
  return <span className="text-faint">—</span>;
}

export function CreatorTable({
  channels,
  onSave,
  onOutreach,
}: {
  channels: Channel[];
  onSave?: (channel: Channel) => void;
  onOutreach?: (channel: Channel) => void;
}) {
  const th = "h-9 px-3 font-medium";
  const num = "px-3 text-right tabular-nums";
  return (
    <div className="card overflow-hidden">
      <table className="w-full table-fixed text-[0.8125rem]">
        <thead className="table-head">
          <tr>
            <th scope="col" className={`${th} w-auto`}>Creator</th>
            <th scope="col" className={`${th} hidden w-32 lg:table-cell`}>Niche</th>
            <th scope="col" className={`${th} w-24 text-right`}>Subscribers</th>
            <th scope="col" className={`${th} hidden w-24 text-right sm:table-cell`}>Avg views</th>
            <th scope="col" className={`${th} hidden w-24 text-right md:table-cell`}>Engagement</th>
            <th scope="col" className={`${th} hidden w-28 lg:table-cell`}>Last upload</th>
            <th scope="col" className={`${th} hidden w-28 md:table-cell`}>Contact</th>
            <th scope="col" className={`${th} w-[5.5rem]`}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {channels.map((c) => (
            <tr key={c.id} className="table-row h-12">
              <td className="px-3">
                <Link href={`/channels/${c.id}`} className="group flex min-w-0 items-center gap-2.5">
                  <Avatar src={c.thumbnail_url} name={c.title} size={28} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-fg group-hover:text-accent">{c.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {[c.handle, c.country ? countryLabel(c.country) : null].filter(Boolean).join(", ") || "Country not set"}
                    </span>
                  </span>
                </Link>
              </td>
              <td className="hidden truncate px-3 text-muted lg:table-cell">
                {c.primary_niche ? nicheLabel(c.primary_niche) : <span className="text-faint">—</span>}
              </td>
              <td className={num}>{formatNumber(c.subscriber_count)}</td>
              <td className={`${num} hidden sm:table-cell`}>{formatNumber(recentViews(c))}</td>
              <td className={`${num} hidden md:table-cell`}>{formatEngagement(recentEngagement(c))}</td>
              <td className="hidden px-3 text-muted lg:table-cell">
                {c.is_inactive ? <StatusTag tone="warn">Inactive</StatusTag> : formatDaysAgo(c.latest_upload_at)}
              </td>
              <td className="hidden px-3 md:table-cell">
                <ContactCell channel={c} />
              </td>
              <td className="px-2">
                <div className="flex items-center justify-end gap-0.5">
                  {onOutreach && channelHasEmailContact(c) && (
                    <IconButton
                      label={c.email_locked ? `Draft outreach email (${UPGRADE_LABEL})` : "Draft outreach email"}
                      onClick={() => onOutreach(c)}
                    >
                      <Mail size={15} strokeWidth={1.75} />
                    </IconButton>
                  )}
                  {onSave && (
                    <IconButton label="Add to campaign" onClick={() => onSave(c)}>
                      <BookmarkPlus size={15} strokeWidth={1.75} />
                    </IconButton>
                  )}
                  <IconButton label="Open on YouTube" href={youtubeChannelUrl(c)}>
                    <ExternalLink size={15} strokeWidth={1.75} />
                  </IconButton>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden" role="status" aria-label="Loading creators">
      <div className="h-9 border-b border-line bg-canvas" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-12 items-center gap-3 border-b border-line px-3 last:border-0">
          <span className="skeleton h-7 w-7 rounded-full" />
          <span className="skeleton h-3 w-40" />
          <span className="skeleton ml-auto h-3 w-12" />
          <span className="skeleton hidden h-3 w-12 sm:block" />
          <span className="skeleton hidden h-3 w-16 md:block" />
        </div>
      ))}
    </div>
  );
}

/* ── States ── */

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16" role="status" aria-label="Loading">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-accent" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <SearchX size={20} strokeWidth={1.75} className="text-faint" aria-hidden />
      <h3 className="mt-3 text-sm font-semibold text-fg">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
      <AlertCircle size={16} strokeWidth={1.75} className="shrink-0" aria-hidden />
      <p className="flex-1">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn-secondary btn-sm">
          Try again
        </button>
      ) : null}
    </div>
  );
}

/* ── Creator detail: contact panel ── */

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
      ? "text-success"
      : validationTone === "warn"
        ? "text-accent"
        : validationTone === "bad"
          ? "text-danger"
          : "text-muted";
  const formUrl = channel.contact_form_url;

  return (
    <div className="space-y-3">
      {channel.email && !channel.email_locked ? (
        <a href={`mailto:${channel.email}`} className="btn-primary w-full gap-2">
          <Mail size={16} strokeWidth={1.75} aria-hidden /> Send email
        </a>
      ) : PAYMENTS_ENABLED ? (
        <Link href="/subscribe" className="btn-primary w-full gap-2">
          <Mail size={16} strokeWidth={1.75} aria-hidden /> Unlock contact
        </Link>
      ) : null}

      <div className="rounded-md border border-line bg-subtle px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted">Email</p>
          {statusHint ? (
            <span className="text-xs font-medium text-muted">{statusHint}</span>
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
          <p className={`mt-2 text-xs font-medium ${validationClass}`}>
            {validationLabel}
            {channel.email_is_role ? " · Role inbox" : ""}
          </p>
        ) : null}
        {hasProvenance ? (
          <div className="mt-2 space-y-0.5 border-t border-line pt-2">
            <p className="text-xs font-semibold text-muted">
              Contact source
            </p>
            <p className="text-xs text-muted">
              {sourceTypeLabel ?? "Public web"}
              {sourceHost ? ` · ${sourceHost}` : ""}
            </p>
            {channel.email_source_url ? (
              <a
                href={channel.email_source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs text-accent hover:text-accent-hover"
              >
                View source page
              </a>
            ) : null}
          </div>
        ) : null}
        {channel.email_status === "locked" && !channel.has_email && !channel.email ? (
          <p className="mt-2 text-xs leading-relaxed text-muted">
            A contact may exist on the channel&apos;s About or website, but it was locked
            (sign-in / captcha) when we last checked.
          </p>
        ) : null}
      </div>

      {(channel.has_contact_form || formUrl) && formUrl ? (
        <div className="rounded-md border border-line bg-subtle px-4 py-3">
          <p className="text-xs font-medium text-muted">Contact form</p>
          <p className="mt-1 text-xs text-muted">
            {channel.contact_form_purpose ?? "Public contact available"}
            {channel.contact_form_has_captcha ? " · CAPTCHA present" : ""}
          </p>
          <a
            href={formUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link mt-2 inline-flex text-xs"
          >
            Open contact page
          </a>
          <p className="mt-1.5 text-xs text-muted">
            We never submit this form automatically.
          </p>
        </div>
      ) : null}

      {channel.website_robots_allowed === false ? (
        <p className="text-xs text-accent">
          Website crawl limited by robots.txt for CreatorScoutBot.
        </p>
      ) : null}

      <a href={aboutUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full gap-2 text-sm">
        <ExternalLink size={16} strokeWidth={1.75} aria-hidden /> YouTube About page
      </a>

      {!hasContact && (
        <p className="text-xs text-muted">
          {PAYMENTS_ENABLED
            ? "Upgrade to Pro to unlock emails, or check the YouTube About page directly."
            : "Emails unlock with Pro (coming soon). Check the YouTube About page directly."}
        </p>
      )}
      <div className="space-y-1 border-t border-line pt-3">
        {channel.website && <SocialRow label="Website" href={channel.website} />}
        {channel.instagram && <SocialRow label="Instagram" href={channel.instagram} />}
        {channel.twitter && <SocialRow label="X (Twitter)" href={channel.twitter} />}
        {channel.tiktok && <SocialRow label="TikTok" href={channel.tiktok} />}
      </div>
    </div>
  );
}

function SocialRow({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-8 items-center justify-between gap-3 rounded-md px-2 text-sm text-fg hover:bg-subtle"
    >
      <span className="truncate">{label}</span>
      <ExternalLink size={14} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden />
    </a>
  );
}
