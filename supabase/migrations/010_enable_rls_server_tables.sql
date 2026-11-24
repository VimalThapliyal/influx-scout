-- Lock down server-only tables that were created without RLS.
-- These tables are only accessed via SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
-- Enabling RLS with no anon/authenticated policies blocks public access via the
-- project URL + anon key, which fixes Supabase advisor: rls_disabled_in_public.

ALTER TABLE IF EXISTS api_quota_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scrape_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS channel_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS seed_urls ENABLE ROW LEVEL SECURITY;

-- Document intent: only the service role should touch these tables.
-- (service_role already bypasses RLS; these policies are belt-and-suspenders.)
DROP POLICY IF EXISTS "Service role full access api_quota_log" ON api_quota_log;
CREATE POLICY "Service role full access api_quota_log"
  ON api_quota_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access scrape_workers" ON scrape_workers;
CREATE POLICY "Service role full access scrape_workers"
  ON scrape_workers FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access channel_pending" ON channel_pending;
CREATE POLICY "Service role full access channel_pending"
  ON channel_pending FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access seed_urls" ON seed_urls;
CREATE POLICY "Service role full access seed_urls"
  ON seed_urls FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
