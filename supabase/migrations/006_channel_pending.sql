-- Light-save queue: extension scrapes page data with no YouTube API quota.
-- Nightly enrich promotes rows into channels via batched channels.list (1 unit / 50).

CREATE TABLE IF NOT EXISTS channel_pending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  channel_id VARCHAR(255),
  handle VARCHAR(255),
  title VARCHAR(255),
  subscriber_count BIGINT,
  thumbnail_url TEXT,
  worker_id UUID REFERENCES scrape_workers(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'enriched', 'rejected', 'failed')),
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_pending_url
  ON channel_pending (lower(url));

CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_pending_channel_id
  ON channel_pending (channel_id)
  WHERE channel_id IS NOT NULL AND status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_pending_handle
  ON channel_pending (lower(handle))
  WHERE handle IS NOT NULL AND status = 'pending';

CREATE INDEX IF NOT EXISTS idx_channel_pending_status
  ON channel_pending (status, created_at)
  WHERE status = 'pending';

COMMENT ON TABLE channel_pending IS 'Zero-quota light saves from extension; enriched overnight into channels';
