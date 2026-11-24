-- Contact provenance (scrape.txt §5.5 / §18)
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS email_source_url TEXT,
  ADD COLUMN IF NOT EXISTS email_source_type VARCHAR(40),
  ADD COLUMN IF NOT EXISTS email_extracted_at TIMESTAMPTZ;

ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_email_source_type_check;
ALTER TABLE channels
  ADD CONSTRAINT channels_email_source_type_check
  CHECK (
    email_source_type IS NULL
    OR email_source_type IN (
      'description',
      'creator_website',
      'link_in_bio',
      'management_website',
      'instagram',
      'other'
    )
  );

CREATE INDEX IF NOT EXISTS idx_channels_email_source_type
  ON channels(email_source_type)
  WHERE email_source_type IS NOT NULL;
