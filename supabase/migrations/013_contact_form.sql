-- Public contact form discovery (scrape.txt §20)
-- Do not auto-submit forms.
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS has_contact_form BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_form_url TEXT,
  ADD COLUMN IF NOT EXISTS contact_form_purpose TEXT,
  ADD COLUMN IF NOT EXISTS contact_form_has_captcha BOOLEAN,
  ADD COLUMN IF NOT EXISTS contact_form_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_channels_has_contact_form
  ON channels(has_contact_form)
  WHERE has_contact_form = true;
