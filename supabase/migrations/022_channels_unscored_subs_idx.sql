-- score-quality.ts's fetchPage runs, every page of every daily run:
--   SELECT ... FROM channels WHERE quality_scored_at IS NULL
--   ORDER BY subscriber_count DESC NULLS LAST
--   LIMIT 1000
-- There was no index covering quality_scored_at at all, forcing a full-table
-- sort on every page. A partial index scoped to the unscored subset (which
-- shrinks as channels get scored) matches this query shape exactly.

CREATE INDEX IF NOT EXISTS idx_channels_unscored_by_subs
  ON channels (subscriber_count DESC NULLS LAST)
  WHERE quality_scored_at IS NULL;
