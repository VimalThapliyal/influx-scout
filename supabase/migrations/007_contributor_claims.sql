-- Shared seed pool + enrich leases so multiple contributors never do the same work.

CREATE TABLE IF NOT EXISTS seed_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  url_norm TEXT NOT NULL,
  niche VARCHAR(100),
  title VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'claimed', 'done', 'failed')),
  claimed_by UUID REFERENCES scrape_workers(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  claim_expires_at TIMESTAMPTZ,
  done_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seed_urls_norm ON seed_urls (url_norm);
CREATE INDEX IF NOT EXISTS idx_seed_urls_status
  ON seed_urls (status, claim_expires_at)
  WHERE status IN ('available', 'claimed');

COMMENT ON TABLE seed_urls IS 'Shared roundup URL pool; workers claim exclusive batches';

-- Enrich leases on pending rows
ALTER TABLE channel_pending
  ADD COLUMN IF NOT EXISTS enrich_claimed_by UUID REFERENCES scrape_workers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS enrich_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrich_claim_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_channel_pending_enrich_claim
  ON channel_pending (status, enrich_claim_expires_at)
  WHERE status = 'pending';

-- Atomically claim up to p_limit available (or expired) seeds for a worker
CREATE OR REPLACE FUNCTION claim_seed_urls(
  p_worker_id UUID,
  p_limit INT DEFAULT 10,
  p_lease_minutes INT DEFAULT 30
)
RETURNS SETOF seed_urls
LANGUAGE plpgsql
AS $$
BEGIN
  -- Free expired claims back to the pool
  UPDATE seed_urls
  SET status = 'available',
      claimed_by = NULL,
      claimed_at = NULL,
      claim_expires_at = NULL,
      updated_at = NOW()
  WHERE status = 'claimed'
    AND claim_expires_at IS NOT NULL
    AND claim_expires_at < NOW();

  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM seed_urls
    WHERE status = 'available'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(p_limit, 50))
  )
  UPDATE seed_urls s
  SET status = 'claimed',
      claimed_by = p_worker_id,
      claimed_at = NOW(),
      claim_expires_at = NOW() + (p_lease_minutes || ' minutes')::interval,
      updated_at = NOW()
  FROM picked
  WHERE s.id = picked.id
  RETURNING s.*;
END;
$$;

-- Atomically claim pending rows for enrich
CREATE OR REPLACE FUNCTION claim_pending_enrich(
  p_worker_id UUID,
  p_limit INT DEFAULT 50,
  p_lease_minutes INT DEFAULT 45
)
RETURNS SETOF channel_pending
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE channel_pending
  SET enrich_claimed_by = NULL,
      enrich_claimed_at = NULL,
      enrich_claim_expires_at = NULL,
      updated_at = NOW()
  WHERE status = 'pending'
    AND enrich_claim_expires_at IS NOT NULL
    AND enrich_claim_expires_at < NOW();

  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM channel_pending
    WHERE status = 'pending'
      AND (
        enrich_claimed_by IS NULL
        OR enrich_claim_expires_at IS NULL
        OR enrich_claim_expires_at < NOW()
      )
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(p_limit, 200))
  )
  UPDATE channel_pending p
  SET enrich_claimed_by = p_worker_id,
      enrich_claimed_at = NOW(),
      enrich_claim_expires_at = NOW() + (p_lease_minutes || ' minutes')::interval,
      updated_at = NOW()
  FROM picked
  WHERE p.id = picked.id
  RETURNING p.*;
END;
$$;
