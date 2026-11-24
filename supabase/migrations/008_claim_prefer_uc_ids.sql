-- Prefer pending rows that already have a real UC channel id (faster, fewer resolve fails).
-- Also release expired enrich leases (already in 007; keep claim order improved).

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
      -- Skip obvious junk @domain.com style handles unless they also have a UC id
      AND (
        channel_id IS NOT NULL
        OR handle IS NULL
        OR handle !~ '\.[a-zA-Z]{2,}$'
      )
    ORDER BY
      CASE WHEN channel_id IS NOT NULL AND channel_id ~ '^UC[\w-]{22}$' THEN 0 ELSE 1 END,
      created_at ASC
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

-- Mark junk domain-like handles as failed (cannot resolve on YouTube)
UPDATE channel_pending
SET status = 'failed',
    reject_reason = 'junk handle (looks like website domain)',
    updated_at = NOW()
WHERE status = 'pending'
  AND channel_id IS NULL
  AND handle IS NOT NULL
  AND handle ~* '@.+\.[a-z]{2,}$';
