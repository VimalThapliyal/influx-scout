/** YouTube API metrics retention helpers (scrape.txt §14). */

export const YOUTUBE_METRICS_TTL_DAYS = 30;
export const YOUTUBE_METRICS_PROVIDER = "youtube_data_api";

export const YOUTUBE_METRICS_COLUMN_KEYS = [
  "metrics_fetched_at",
  "metrics_expires_at",
  "metrics_source_provider",
] as const;

export type MetricsExpiryFields = {
  metrics_fetched_at: string;
  metrics_expires_at: string;
  metrics_source_provider: string;
};

export function youtubeMetricsExpiry(
  fetchedAt: Date | string = new Date(),
  ttlDays = YOUTUBE_METRICS_TTL_DAYS
): MetricsExpiryFields {
  const fetched =
    typeof fetchedAt === "string" ? new Date(fetchedAt) : fetchedAt;
  const fetchedIso = fetched.toISOString();
  const expires = new Date(fetched.getTime() + ttlDays * 86_400_000);
  return {
    metrics_fetched_at: fetchedIso,
    metrics_expires_at: expires.toISOString(),
    metrics_source_provider: YOUTUBE_METRICS_PROVIDER,
  };
}

/** An API response without contact information is not evidence that saved enrichment is invalid. */
export function preserveMissingContactFields<T extends Record<string, unknown>>(payload: T): T {
  const next = { ...payload };
  for (const key of ["email", "website", "instagram", "twitter", "tiktok", "country", "category", "handle"]) {
    if (next[key] == null || next[key] === "") delete next[key];
  }
  return next;
}

/** Merge metrics expiry onto a channel upsert payload after a YouTube API fetch. */
export function withYoutubeMetricsExpiry<T extends Record<string, unknown>>(
  payload: T,
  fetchedAt?: Date | string
): T & MetricsExpiryFields {
  return {
    ...preserveMissingContactFields(payload),
    ...youtubeMetricsExpiry(fetchedAt),
  };
}

export function stripYoutubeMetricsFields<T extends Record<string, unknown>>(
  payload: T
): Omit<T, (typeof YOUTUBE_METRICS_COLUMN_KEYS)[number]> {
  const next = { ...payload };
  for (const key of YOUTUBE_METRICS_COLUMN_KEYS) {
    delete next[key];
  }
  return next as Omit<T, (typeof YOUTUBE_METRICS_COLUMN_KEYS)[number]>;
}

export function isMissingMetricsColumnError(
  message: string | null | undefined
): boolean {
  if (!message) return false;
  return /metrics_(fetched_at|expires_at|source_provider)|schema cache/i.test(
    message
  );
}

import {
  isMissingClassificationColumnError,
  stripClassificationFields,
} from "./classify";

/**
 * Upsert a channel; if metrics or classification columns are missing from
 * PostgREST cache, retry without them so enrich does not false-fail.
 */
export async function upsertChannelWithMetricsExpiry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any },
  payload: Record<string, unknown>,
  options?: { onConflict?: string }
): Promise<{ data: unknown; error: { message: string } | null }> {
  let attempt: Record<string, unknown> = preserveMissingContactFields(payload);
  let result = await supabase.from("channels").upsert(attempt, options);

  if (
    result.error &&
    isMissingMetricsColumnError(result.error.message) &&
    YOUTUBE_METRICS_COLUMN_KEYS.some((k) => k in attempt)
  ) {
    attempt = stripYoutubeMetricsFields(attempt);
    result = await supabase.from("channels").upsert(attempt, options);
  }

  if (
    result.error &&
    isMissingClassificationColumnError(result.error.message) &&
    CLASSIFICATION_KEYS_PRESENT(attempt)
  ) {
    attempt = stripClassificationFields(attempt);
    result = await supabase.from("channels").upsert(attempt, options);
  }

  return result;
}

function CLASSIFICATION_KEYS_PRESENT(payload: Record<string, unknown>): boolean {
  return [
    "primary_niche",
    "niche_confidence",
    "niche_method",
    "niche_evidence",
    "niche_classified_at",
    "country_confidence",
    "country_evidence",
    "country_classified_at",
  ].some((k) => k in payload);
}

export function isYoutubeMetricsExpired(
  expiresAt: string | null | undefined,
  now = Date.now()
): boolean {
  if (!expiresAt) return true;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return true;
  return t <= now;
}

export function youtubeMetricsStatus(
  expiresAt: string | null | undefined,
  fetchedAt?: string | null
): "current" | "expiring_soon" | "expired" | "unknown" {
  if (!expiresAt && !fetchedAt) return "unknown";
  if (!expiresAt) return "unknown";
  const expires = new Date(expiresAt).getTime();
  if (Number.isNaN(expires)) return "unknown";
  const now = Date.now();
  if (expires <= now) return "expired";
  // Warn inside last 7 days of window
  if (expires - now < 7 * 86_400_000) return "expiring_soon";
  return "current";
}

export function youtubeMetricsStatusLabel(
  status: ReturnType<typeof youtubeMetricsStatus>
): string {
  switch (status) {
    case "current":
      return "YouTube metrics current";
    case "expiring_soon":
      return "YouTube metrics expiring soon";
    case "expired":
      return "YouTube metrics expired — refresh";
    default:
      return "YouTube metrics unknown";
  }
}
