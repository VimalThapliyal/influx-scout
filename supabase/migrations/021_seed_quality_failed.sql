-- Storage-slimming: channels that fail the quality gate no longer keep a full
-- ~5KB row in `channels` (title, description, thumbnail, stats, indexes).
-- Instead their channel_seed row (already ~400 bytes, already exists for
-- every validated channel) is marked 'quality_failed' so the validator and
-- scorer both know never to re-check it. This cuts the storage cost of a
-- rejected channel by ~90% with no loss of "don't re-check this" memory.

ALTER TABLE channel_seed DROP CONSTRAINT IF EXISTS channel_seed_status_check;
ALTER TABLE channel_seed ADD CONSTRAINT channel_seed_status_check
  CHECK (status IN ('new', 'validated', 'dead', 'skipped', 'error', 'quality_failed'));

ALTER TABLE channel_seed ADD COLUMN IF NOT EXISTS quality_fail_reasons TEXT[];

COMMENT ON COLUMN channel_seed.quality_fail_reasons IS
  'Set when status=quality_failed. Mirrors channels.quality_fail_reasons before that row was deleted to reclaim space.';
