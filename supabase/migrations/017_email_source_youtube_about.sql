-- Allow About-page scrape provenance (enrich:socials)
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
      'youtube_about',
      'other'
    )
  );
