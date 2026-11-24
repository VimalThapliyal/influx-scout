-- Creator opt-out ("Remove my listing").
-- A request immediately hides the channel from public pages and the app
-- (channels.opted_out_at); the row itself is kept so a mistaken or abusive
-- request can be reviewed and undone. Requests are logged for follow-up.

ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_channels_opted_out
  ON channels (opted_out_at)
  WHERE opted_out_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS removal_requests (
  id              BIGSERIAL PRIMARY KEY,
  channel_input   TEXT NOT NULL,          -- what the requester pasted
  channel_id      VARCHAR(64),            -- resolved UC… id, if found
  requester_email TEXT NOT NULL,
  reason          TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'hidden'
    CHECK (status IN ('hidden', 'not_found', 'restored', 'deleted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_removal_requests_created ON removal_requests (created_at DESC);

-- Server-only table: written by the API route with the service role.
ALTER TABLE removal_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON removal_requests FROM anon, authenticated;
