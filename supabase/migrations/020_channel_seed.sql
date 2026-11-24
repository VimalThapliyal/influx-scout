-- TubeCensus-style discovery seed pool (the "index", separate from validated `channels`).
-- Holds raw channel identifiers (100M+ possible) with zero API cost.
-- A cheap batched channels.list validator promotes canonical UC IDs into `channels`.

CREATE TABLE IF NOT EXISTS channel_seed (
  -- Normalised composite key, e.g. "channel:UCabc", "handle:@name", "user:LegacyName"
  seed_key       TEXT PRIMARY KEY,
  channel_id     VARCHAR(255),          -- canonical UC… when id_format = 'channel'
  handle         VARCHAR(255),          -- @handle when id_format = 'handle'
  username       VARCHAR(255),          -- legacy /user/ name when id_format = 'user'
  custom_url     VARCHAR(255),          -- /c/ slug when id_format = 'custom'
  id_format      VARCHAR(16) NOT NULL   -- channel | handle | user | custom
    CHECK (id_format IN ('channel', 'handle', 'user', 'custom')),
  source         VARCHAR(40) NOT NULL DEFAULT 'tubecensus',
  status         VARCHAR(20) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'validated', 'dead', 'skipped', 'error')),
  in_library     BOOLEAN NOT NULL DEFAULT false,  -- true once promoted into channels
  attempts       INTEGER NOT NULL DEFAULT 0,
  last_error     TEXT,
  discovered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_at   TIMESTAMPTZ
);

-- One canonical channel id at most once across the pool
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_seed_channel_id
  ON channel_seed (channel_id)
  WHERE channel_id IS NOT NULL;

-- Validator queue: cheapest first (canonical channel format), oldest first
CREATE INDEX IF NOT EXISTS idx_channel_seed_queue
  ON channel_seed (id_format, status, discovered_at)
  WHERE status = 'new';

CREATE INDEX IF NOT EXISTS idx_channel_seed_status
  ON channel_seed (status);

COMMENT ON TABLE channel_seed IS
  'Discovery seed pool (TubeCensus etc.). Zero-quota IDs; validated into channels via batched channels.list.';
