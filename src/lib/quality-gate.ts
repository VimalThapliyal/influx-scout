/**
 * Creator quality gates + activity cadence (product one-pager).
 * Soft by default: score & flag; hard reject is optional at enrich time.
 */

import { EUROPE_COUNTRY_CODES, USA_COUNTRY_CODE } from "./markets";

/** Avg views on last 5 uploads — override per niche when needed. */
export const DEFAULT_MIN_AVG_VIEWS_LAST5 = 5_000;
export const DEFAULT_MAX_DAYS_SINCE_UPLOAD = 45;
export const DEFAULT_MIN_ENGAGEMENT = 0.02; // 2%
export const DEFAULT_MIN_VIDEOS_REQUIRED = 3;

/** Location tiers for outreach markets. */
export const LOCATION_TIER1 = new Set<string>([
  USA_COUNTRY_CODE,
  "GB",
  "CA",
  "AU",
  "DE",
  "FR",
  "NL",
]);

export const LOCATION_TIER2 = new Set<string>(
  EUROPE_COUNTRY_CODES.filter((c) => !LOCATION_TIER1.has(c))
);

export type LocationTier = "tier1" | "tier2" | "other";

export type ActivityBucket = "hot" | "warm" | "cold" | "unknown";

export interface QualityGateConfig {
  minAvgViewsLast5: number;
  maxDaysSinceUpload: number;
  minEngagement: number;
  minVideosRequired: number;
  /** Niche → override min avg views */
  nicheAvgViews?: Partial<Record<string, number>>;
}

export const DEFAULT_QUALITY_CONFIG: QualityGateConfig = {
  minAvgViewsLast5: DEFAULT_MIN_AVG_VIEWS_LAST5,
  maxDaysSinceUpload: DEFAULT_MAX_DAYS_SINCE_UPLOAD,
  minEngagement: DEFAULT_MIN_ENGAGEMENT,
  minVideosRequired: DEFAULT_MIN_VIDEOS_REQUIRED,
  nicheAvgViews: {
    gaming: 8_000,
    "personal-finance": 3_000,
    finance: 3_000,
    education: 3_000,
    beauty: 5_000,
    fitness: 5_000,
    music: 10_000,
  },
};

export interface RecentVideoSnapshot {
  id: string;
  title: string;
  description?: string | null;
  tags?: string[] | null;
  view_count: number;
  like_count: number | null;
  comment_count: number | null;
  published_at: string;
  duration?: string | null;
}

export interface QualityScoreInput {
  videos: RecentVideoSnapshot[];
  country?: string | null;
  subscriberCount?: number | null;
  primaryNiche?: string | null;
  config?: Partial<QualityGateConfig>;
}

export interface QualityScoreResult {
  latest_upload_at: string | null;
  avg_views_last5: number | null;
  engagement_last5: number | null;
  quality_pass: boolean;
  quality_fail_reasons: string[];
  location_tier: LocationTier | null;
  is_emerging: boolean;
  is_inactive: boolean;
  activity_bucket: ActivityBucket;
  next_refresh_at: string | null;
  recent_videos: RecentVideoSnapshot[];
  days_since_upload: number | null;
}

export function locationTier(
  country: string | null | undefined
): LocationTier | null {
  if (!country || !String(country).trim()) return null; // blank = soft keep
  const cc = country.toUpperCase();
  if (LOCATION_TIER1.has(cc)) return "tier1";
  if (LOCATION_TIER2.has(cc)) return "tier2";
  return "other";
}

export function activityFromLatestUpload(
  latestUploadAt: string | null
): {
  bucket: ActivityBucket;
  is_inactive: boolean;
  next_refresh_at: string | null;
  days_since_upload: number | null;
} {
  if (!latestUploadAt) {
    return {
      bucket: "unknown",
      is_inactive: false,
      next_refresh_at: null,
      days_since_upload: null,
    };
  }
  const days = Math.floor(
    (Date.now() - new Date(latestUploadAt).getTime()) / 86_400_000
  );
  if (days <= 30) {
    // Refresh every 2 weeks
    return {
      bucket: "hot",
      is_inactive: false,
      next_refresh_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      days_since_upload: days,
    };
  }
  if (days <= 60) {
    // Monthly
    return {
      bucket: "warm",
      is_inactive: false,
      next_refresh_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      days_since_upload: days,
    };
  }
  return {
    bucket: "cold",
    is_inactive: true,
    next_refresh_at: null,
    days_since_upload: days,
  };
}

function parseDurationSeconds(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  return (
    (parseInt(m[1] || "0", 10) || 0) * 3600 +
    (parseInt(m[2] || "0", 10) || 0) * 60 +
    (parseInt(m[3] || "0", 10) || 0)
  );
}

export function scoreChannelQuality(
  input: QualityScoreInput
): QualityScoreResult {
  const cfg: QualityGateConfig = {
    ...DEFAULT_QUALITY_CONFIG,
    ...input.config,
    nicheAvgViews: {
      ...DEFAULT_QUALITY_CONFIG.nicheAvgViews,
      ...input.config?.nicheAvgViews,
    },
  };

  const niche = input.primaryNiche ?? "";
  const minViews =
    (niche && cfg.nicheAvgViews?.[niche]) || cfg.minAvgViewsLast5;

  const videos = [...input.videos]
    .filter((v) => v.published_at)
    .sort(
      (a, b) =>
        new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    )
    .slice(0, 5);

  const tier = locationTier(input.country);
  const fail: string[] = [];

  if (videos.length < cfg.minVideosRequired) {
    fail.push("insufficient_videos");
  }

  const latest = videos[0]?.published_at ?? null;
  const activity = activityFromLatestUpload(latest);

  if (
    activity.days_since_upload != null &&
    activity.days_since_upload > cfg.maxDaysSinceUpload
  ) {
    fail.push("upload_stale");
  }
  if (!latest) fail.push("no_upload_date");

  const viewSum = videos.reduce((s, v) => s + (v.view_count || 0), 0);
  const avgViews =
    videos.length > 0 ? Math.round(viewSum / videos.length) : null;
  if (avgViews == null || avgViews < minViews) {
    fail.push("avg_views_low");
  }

  let likeSum = 0;
  let commentSum = 0;
  let viewsForEng = 0;
  let hasEngStats = false;
  for (const v of videos) {
    if (v.like_count == null && v.comment_count == null) continue;
    hasEngStats = true;
    likeSum += v.like_count ?? 0;
    commentSum += v.comment_count ?? 0;
    viewsForEng += v.view_count || 0;
  }
  const engagement =
    hasEngStats && viewsForEng > 0
      ? (likeSum + commentSum) / viewsForEng
      : null;

  if (engagement == null) {
    fail.push("engagement_unknown");
  } else if (engagement < cfg.minEngagement) {
    fail.push("engagement_low");
  }

  // Location: blank country = soft keep (null tier). Only explicit non-tier fails.
  if (tier === "other") {
    fail.push("location_outside_tiers");
  }

  const quality_pass = fail.length === 0;
  const subs = input.subscriberCount ?? 0;
  // Emerging = nano/micro clearing quality (subs secondary, never primary gate)
  const is_emerging =
    quality_pass && subs > 0 && subs < 100_000;

  return {
    latest_upload_at: latest,
    avg_views_last5: avgViews,
    engagement_last5: engagement,
    quality_pass,
    quality_fail_reasons: fail,
    location_tier: tier,
    is_emerging,
    is_inactive: activity.is_inactive,
    activity_bucket: activity.bucket,
    next_refresh_at: activity.next_refresh_at,
    recent_videos: videos,
    days_since_upload: activity.days_since_upload,
  };
}

/** Fields to merge onto a channels row after scoring. */
export function qualityFieldsForDb(score: QualityScoreResult) {
  return {
    latest_upload_at: score.latest_upload_at,
    avg_views_last5: score.avg_views_last5,
    engagement_last5: score.engagement_last5,
    quality_pass: score.quality_pass,
    quality_fail_reasons: score.quality_fail_reasons,
    quality_scored_at: new Date().toISOString(),
    location_tier: score.location_tier,
    is_emerging: score.is_emerging,
    is_inactive: score.is_inactive,
    activity_bucket: score.activity_bucket,
    next_refresh_at: score.next_refresh_at,
    // Only keep video snapshots for sellable creators: failing channels made up
    // ~195 MB of recent_videos and pushed the free-tier database over quota.
    recent_videos: score.quality_pass ? score.recent_videos : null,
    // Keep legacy engagement_rate / avg_views in sync when we have last-5
    engagement_rate: score.engagement_last5,
    avg_views_per_video: score.avg_views_last5,
  };
}

export function isMissingQualityColumnError(message: string): boolean {
  return /latest_upload_at|avg_views_last5|engagement_last5|quality_pass|location_tier|is_emerging|is_inactive|activity_bucket|next_refresh_at|recent_videos|quality_fail|quality_scored/i.test(
    message
  );
}

export function stripQualityFields<T extends Record<string, unknown>>(
  row: T
): T {
  const out = { ...row };
  for (const k of [
    "latest_upload_at",
    "avg_views_last5",
    "engagement_last5",
    "quality_pass",
    "quality_fail_reasons",
    "quality_scored_at",
    "location_tier",
    "is_emerging",
    "is_inactive",
    "activity_bucket",
    "next_refresh_at",
    "recent_videos",
    "discovery_source",
  ]) {
    delete out[k];
  }
  return out;
}

export { parseDurationSeconds };
