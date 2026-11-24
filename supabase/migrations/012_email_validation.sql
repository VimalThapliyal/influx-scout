-- Email validation status (scrape.txt §19)
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS email_validation_status VARCHAR(32),
  ADD COLUMN IF NOT EXISTS email_is_role BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_validated_at TIMESTAMPTZ;

ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_email_validation_status_check;
ALTER TABLE channels
  ADD CONSTRAINT channels_email_validation_status_check
  CHECK (
    email_validation_status IS NULL
    OR email_validation_status IN (
      'public_source_found',
      'format_valid',
      'mx_valid',
      'provider_verified',
      'risky',
      'invalid',
      'unknown'
    )
  );

CREATE INDEX IF NOT EXISTS idx_channels_email_validation_status
  ON channels(email_validation_status)
  WHERE email_validation_status IS NOT NULL;
