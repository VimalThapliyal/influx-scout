-- YouTube API metrics fetch/expiry (scrape.txt §14)
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS metrics_fetched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metrics_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metrics_source_provider TEXT DEFAULT 'youtube_data_api';

-- Backfill from last_updated (30-day window)
UPDATE channels
SET
  metrics_fetched_at = COALESCE(metrics_fetched_at, last_updated, updated_at, now()),
  metrics_expires_at = COALESCE(
    metrics_expires_at,
    COALESCE(last_updated, updated_at, now()) + interval '30 days'
  ),
  metrics_source_provider = COALESCE(metrics_source_provider, 'youtube_data_api')
WHERE metrics_fetched_at IS NULL OR metrics_expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_channels_metrics_expires_at
  ON channels(metrics_expires_at ASC NULLS FIRST);
