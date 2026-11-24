-- One-pager: quality gates, activity cadence, location tier, recent video snapshot

ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS latest_upload_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS avg_views_last5 BIGINT,
  ADD COLUMN IF NOT EXISTS engagement_last5 DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS quality_pass BOOLEAN,
  ADD COLUMN IF NOT EXISTS quality_fail_reasons TEXT[],
  ADD COLUMN IF NOT EXISTS quality_scored_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS location_tier VARCHAR(10),
  ADD COLUMN IF NOT EXISTS is_emerging BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_inactive BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS activity_bucket VARCHAR(20),
  ADD COLUMN IF NOT EXISTS next_refresh_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discovery_source VARCHAR(40),
  ADD COLUMN IF NOT EXISTS recent_videos JSONB;

ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_location_tier_check;
ALTER TABLE channels
  ADD CONSTRAINT channels_location_tier_check
  CHECK (
    location_tier IS NULL
    OR location_tier IN ('tier1', 'tier2', 'other')
  );

ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_activity_bucket_check;
ALTER TABLE channels
  ADD CONSTRAINT channels_activity_bucket_check
  CHECK (
    activity_bucket IS NULL
    OR activity_bucket IN ('hot', 'warm', 'cold', 'unknown')
  );

CREATE INDEX IF NOT EXISTS idx_channels_quality_pass
  ON channels (quality_pass)
  WHERE quality_pass = true;

CREATE INDEX IF NOT EXISTS idx_channels_latest_upload
  ON channels (latest_upload_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_channels_next_refresh
  ON channels (next_refresh_at ASC NULLS LAST)
  WHERE is_inactive IS NOT TRUE;

CREATE INDEX IF NOT EXISTS idx_channels_emerging
  ON channels (is_emerging)
  WHERE is_emerging = true;

CREATE INDEX IF NOT EXISTS idx_channels_location_tier
  ON channels (location_tier);

COMMENT ON COLUMN channels.avg_views_last5 IS
  'Mean view count of last 5 uploads (quality gate)';
COMMENT ON COLUMN channels.engagement_last5 IS
  '(likes+comments)/views over last 5 uploads';
COMMENT ON COLUMN channels.quality_pass IS
  'Clears last-5 views + upload recency + engagement gates';
COMMENT ON COLUMN channels.activity_bucket IS
  'hot=upload≤30d (refresh 2w), warm=≤60d (monthly), cold=>60d inactive';
COMMENT ON COLUMN channels.recent_videos IS
  'Snapshot of last N public videos (title, stats, tags, dates)';
