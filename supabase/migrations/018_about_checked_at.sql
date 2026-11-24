-- Track YouTube About-page scrape attempts so enrich:socials advances past the same top channels
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS about_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_channels_about_unchecked
  ON channels (subscriber_count DESC NULLS LAST)
  WHERE about_checked_at IS NULL;

COMMENT ON COLUMN channels.about_checked_at IS
  'Last time enrich:socials scraped the YouTube /about page (null = never checked)';
