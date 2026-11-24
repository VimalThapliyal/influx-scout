-- Niche + country confidence (scrape.txt §§22–23)
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS primary_niche TEXT,
  ADD COLUMN IF NOT EXISTS niche_confidence REAL,
  ADD COLUMN IF NOT EXISTS niche_method TEXT,
  ADD COLUMN IF NOT EXISTS niche_evidence TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS niche_classified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS country_confidence TEXT,
  ADD COLUMN IF NOT EXISTS country_evidence TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS country_classified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_channels_primary_niche
  ON channels(primary_niche)
  WHERE primary_niche IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_channels_niche_confidence
  ON channels(niche_confidence DESC NULLS LAST)
  WHERE primary_niche IS NOT NULL;
