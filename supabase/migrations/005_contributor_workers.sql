-- Contributor workers (Chrome extension + paste import)
CREATE TABLE IF NOT EXISTS scrape_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  label VARCHAR(100),
  active BOOLEAN NOT NULL DEFAULT true,
  channels_submitted INT NOT NULL DEFAULT 0,
  channels_accepted INT NOT NULL DEFAULT 0,
  last_submit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrape_workers_active ON scrape_workers(active) WHERE active = true;

COMMENT ON TABLE scrape_workers IS 'API keys for contributor imports (extension / paste import)';
