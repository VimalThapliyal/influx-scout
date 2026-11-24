-- Record last robots.txt decision for website crawls (scrape.txt §17)
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS website_robots_allowed BOOLEAN,
  ADD COLUMN IF NOT EXISTS website_robots_checked_at TIMESTAMPTZ;
