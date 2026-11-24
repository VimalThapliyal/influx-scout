-- Close the anon-key paywall bypass.
--
-- The anon key ships in the browser bundle. 001 granted it full read/write on
-- channels (including every email), campaigns, campaign_influencers and
-- channel_analytics; channel_seed never had RLS. 002 let a signed-in user
-- UPDATE their own profile row, i.e. set is_subscribed = true themselves.
--
-- The web app reads/writes all of these through server routes using the
-- service role (bypasses RLS), and the anon key is only used for auth, so
-- removing these policies does not affect the app, scripts, Scout or workers.

-- 1) channels / campaigns / analytics: no direct anon or authenticated access
DROP POLICY IF EXISTS "Allow public read channels" ON channels;
DROP POLICY IF EXISTS "Allow public insert channels" ON channels;
DROP POLICY IF EXISTS "Allow public update channels" ON channels;

DROP POLICY IF EXISTS "Allow public read campaigns" ON campaigns;
DROP POLICY IF EXISTS "Allow public insert campaigns" ON campaigns;
DROP POLICY IF EXISTS "Allow public update campaigns" ON campaigns;
DROP POLICY IF EXISTS "Allow public delete campaigns" ON campaigns;

DROP POLICY IF EXISTS "Allow public read campaign_influencers" ON campaign_influencers;
DROP POLICY IF EXISTS "Allow public insert campaign_influencers" ON campaign_influencers;
DROP POLICY IF EXISTS "Allow public update campaign_influencers" ON campaign_influencers;
DROP POLICY IF EXISTS "Allow public delete campaign_influencers" ON campaign_influencers;

DROP POLICY IF EXISTS "Allow public read analytics" ON channel_analytics;
DROP POLICY IF EXISTS "Allow public insert analytics" ON channel_analytics;

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_analytics ENABLE ROW LEVEL SECURITY;

-- 2) channel_seed was created without RLS (fully open to anon)
ALTER TABLE IF EXISTS channel_seed ENABLE ROW LEVEL SECURITY;

-- 3) profiles: users may read their own row but never write it.
--    Subscription state is set only by the server (Stripe webhook).
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON profiles(stripe_customer_id);

-- 4) Defence in depth: strip table privileges from the public roles.
REVOKE ALL ON channels, campaigns, campaign_influencers, channel_analytics
  FROM anon, authenticated;
DO $$
BEGIN
  IF to_regclass('public.channel_seed') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON channel_seed FROM anon, authenticated';
  END IF;
END $$;
REVOKE INSERT, UPDATE, DELETE ON profiles FROM anon, authenticated;
