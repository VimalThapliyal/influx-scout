-- Independent creator vs organisation (studio, network, label, brand, league).
-- Set by the niche classifier; NULL = not classified yet (treated as independent).
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS channel_kind text;

-- Default ranking in the library and public lists: recent average views.
CREATE INDEX IF NOT EXISTS idx_channels_pass_recent_views
  ON public.channels (avg_views_last5 DESC NULLS LAST, id)
  WHERE quality_pass;

-- People who asked to hear when Pro opens. Server-side (service role) only.
CREATE TABLE IF NOT EXISTS public.pro_waitlist (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE,
  user_id uuid,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pro_waitlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pro_waitlist FROM anon, authenticated;
