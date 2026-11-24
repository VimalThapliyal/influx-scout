/** Trust / provenance helpers for channel cards and profiles. */

export type EmailStatus = "found" | "locked" | "not_available";

export type FreshnessLevel = "fresh" | "recent" | "stale" | "unknown";

const SOURCE_LABELS: Record<string, string> = {
  api: "YouTube API",
  scraped: "Website scrape",
  hybrid: "API + scrape",
  contributor: "Contributor",
};

const EMAIL_STATUS_LABELS: Record<EmailStatus, string> = {
  found: "Email on file",
  locked: "Email locked on source",
  not_available: "No public email",
};

export function channelSourceLabel(dataSource: string | null | undefined): string {
  if (!dataSource) return "Unknown source";
  return SOURCE_LABELS[dataSource] ?? dataSource;
}

export function emailStatusLabel(
  status: string | null | undefined
): string | null {
  if (!status) return null;
  if (status in EMAIL_STATUS_LABELS) {
    return EMAIL_STATUS_LABELS[status as EmailStatus];
  }
  return null;
}

/** Days since last_updated; null if missing/invalid. */
export function daysSinceUpdated(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, (Date.now() - t) / 86_400_000);
}

export function freshnessLevel(iso: string | null | undefined): FreshnessLevel {
  const days = daysSinceUpdated(iso);
  if (days == null) return "unknown";
  if (days < 7) return "fresh";
  if (days < 30) return "recent";
  return "stale";
}

export function freshnessLabel(level: FreshnessLevel): string {
  switch (level) {
    case "fresh":
      return "Fresh";
    case "recent":
      return "Recent";
    case "stale":
      return "Needs refresh";
    default:
      return "Unknown";
  }
}

export function formatRelativeUpdated(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "Just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return minutes <= 1 ? "Just now" : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
