-- Scope campaign lists to authenticated users
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);

COMMENT ON COLUMN campaigns.user_id IS 'Owner of this campaign list; NULL = legacy/orphan rows not shown in app';
