/**
 * Quality gates (one-pager) — CommonJS port for Electron.
 */
const TIER1 = new Set(["US", "GB", "CA", "AU", "DE", "FR", "NL"]);
const TIER2 = new Set([
  "ES", "IT", "SE", "PL", "IE", "BE", "AT", "CH", "NO", "DK", "FI", "PT",
  "CZ", "RO", "HU", "GR",
]);

const DEFAULTS = {
  minAvgViewsLast5: 5000,
  maxDaysSinceUpload: 45,
  minEngagement: 0.02,
  minVideosRequired: 3,
  nicheAvgViews: {
    gaming: 8000,
    finance: 3000,
    education: 3000,
    beauty: 5000,
    fitness: 5000,
    music: 10000,
  },
};

function locationTier(country) {
  if (!country || !String(country).trim()) return null; // unknown — soft, do not fail
  const cc = String(country).toUpperCase();
  if (TIER1.has(cc)) return "tier1";
  if (TIER2.has(cc)) return "tier2";
  return "other";
}

function activityFromLatestUpload(latestUploadAt) {
  if (!latestUploadAt) {
    return {
      bucket: "unknown",
      is_inactive: false,
      next_refresh_at: null,
      days_since_upload: null,
    };
  }
  const days = Math.floor(
    (Date.now() - new Date(latestUploadAt).getTime()) / 86400000
  );
  if (days <= 30) {
    return {
      bucket: "hot",
      is_inactive: false,
      next_refresh_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      days_since_upload: days,
    };
  }
  if (days <= 60) {
    return {
      bucket: "warm",
      is_inactive: false,
      next_refresh_at: new Date(Date.now() + 30 * 86400000).toISOString(),
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

function scoreChannelQuality({
  videos,
  country,
  subscriberCount,
  primaryNiche,
  config = {},
}) {
  const cfg = { ...DEFAULTS, ...config, nicheAvgViews: { ...DEFAULTS.nicheAvgViews, ...config.nicheAvgViews } };
  const niche = primaryNiche || "";
  const minViews = (niche && cfg.nicheAvgViews[niche]) || cfg.minAvgViewsLast5;

  const sorted = [...(videos || [])]
    .filter((v) => v.published_at)
    .sort(
      (a, b) =>
        new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    )
    .slice(0, 5);

  const tier = locationTier(country);
  const fail = [];

  if (sorted.length < cfg.minVideosRequired) fail.push("insufficient_videos");

  const latest = sorted[0]?.published_at || null;
  const activity = activityFromLatestUpload(latest);

  if (
    activity.days_since_upload != null &&
    activity.days_since_upload > cfg.maxDaysSinceUpload
  ) {
    fail.push("upload_stale");
  }
  if (!latest) fail.push("no_upload_date");

  const viewSum = sorted.reduce((s, v) => s + (v.view_count || 0), 0);
  const avgViews =
    sorted.length > 0 ? Math.round(viewSum / sorted.length) : null;
  if (avgViews == null || avgViews < minViews) fail.push("avg_views_low");

  let likeSum = 0;
  let commentSum = 0;
  let viewsForEng = 0;
  let hasEng = false;
  for (const v of sorted) {
    if (v.like_count == null && v.comment_count == null) continue;
    hasEng = true;
    likeSum += v.like_count || 0;
    commentSum += v.comment_count || 0;
    viewsForEng += v.view_count || 0;
  }
  const engagement =
    hasEng && viewsForEng > 0 ? (likeSum + commentSum) / viewsForEng : null;
  if (engagement == null) fail.push("engagement_unknown");
  else if (engagement < cfg.minEngagement) fail.push("engagement_low");

  // Location: blank = soft keep (null tier). Only explicit non-tier countries fail.
  if (tier === "other") fail.push("location_outside_tiers");

  const quality_pass = fail.length === 0;
  const subs = subscriberCount || 0;
  const is_emerging = quality_pass && subs > 0 && subs < 100000;

  return {
    latest_upload_at: latest,
    avg_views_last5: avgViews,
    engagement_last5: engagement,
    quality_pass,
    quality_fail_reasons: fail,
    quality_scored_at: new Date().toISOString(),
    location_tier: tier,
    is_emerging,
    is_inactive: activity.is_inactive,
    activity_bucket: activity.bucket,
    next_refresh_at: activity.next_refresh_at,
    recent_videos: sorted,
    // Computed only — NOT a channels column (do not upsert)
    days_since_upload: activity.days_since_upload,
  };
}

/** Fields safe to write onto channels (matches migration 019). */
function qualityFieldsForDb(score) {
  if (!score || typeof score !== "object") return {};
  return {
    latest_upload_at: score.latest_upload_at ?? null,
    avg_views_last5: score.avg_views_last5 ?? null,
    engagement_last5: score.engagement_last5 ?? null,
    quality_pass: score.quality_pass ?? null,
    quality_fail_reasons: score.quality_fail_reasons ?? null,
    quality_scored_at: score.quality_scored_at || new Date().toISOString(),
    location_tier: score.location_tier ?? null,
    is_emerging: score.is_emerging ?? false,
    is_inactive: score.is_inactive ?? false,
    activity_bucket: score.activity_bucket ?? null,
    next_refresh_at: score.next_refresh_at ?? null,
    recent_videos: score.recent_videos ?? null,
    engagement_rate: score.engagement_last5 ?? null,
    avg_views_per_video: score.avg_views_last5 ?? null,
  };
}

module.exports = {
  scoreChannelQuality,
  qualityFieldsForDb,
  locationTier,
  activityFromLatestUpload,
  DEFAULTS,
};
