-- Track email extraction outcome from scraper
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS email_status VARCHAR(20)
    CHECK (email_status IN ('found', 'locked', 'not_available'));

CREATE INDEX IF NOT EXISTS idx_channels_email_status ON channels(email_status);
