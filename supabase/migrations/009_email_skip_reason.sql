-- Mark channels that were checked for captcha/public email but have none,
-- so they drop out of the captcha queue without inventing a fake email.

ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS email_skip_reason TEXT,
  ADD COLUMN IF NOT EXISTS email_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_channels_email_skip
  ON channels (email_skip_reason)
  WHERE email IS NULL;

COMMENT ON COLUMN channels.email_skip_reason IS
  'Set when manual captcha/About check found no usable email (e.g. no_public_email)';
