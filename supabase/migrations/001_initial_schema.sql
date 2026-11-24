-- YouTube Influencer Platform — Free Tier Schema
-- Run this in Supabase SQL Editor

-- Channels
CREATE TABLE IF NOT EXISTS channels (
    id VARCHAR(255) PRIMARY KEY,
    handle VARCHAR(255) UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    subscriber_count BIGINT,
    view_count BIGINT NOT NULL DEFAULT 0,
    video_count INTEGER NOT NULL DEFAULT 0,
    country VARCHAR(10),
    published_at TIMESTAMPTZ,
    category VARCHAR(100),
    email VARCHAR(255),
    website TEXT,
    instagram VARCHAR(255),
    twitter VARCHAR(255),
    tiktok VARCHAR(255),
    influencer_score FLOAT DEFAULT 0,
    tier VARCHAR(20) CHECK (tier IN ('nano', 'micro', 'mid', 'macro', 'mega')),
    engagement_rate FLOAT,
    avg_views_per_video BIGINT,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    data_source VARCHAR(20) DEFAULT 'api',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channels_subscribers ON channels(subscriber_count);
CREATE INDEX IF NOT EXISTS idx_channels_tier ON channels(tier);
CREATE INDEX IF NOT EXISTS idx_channels_category ON channels(category);
CREATE INDEX IF NOT EXISTS idx_channels_score ON channels(influencer_score DESC);
CREATE INDEX IF NOT EXISTS idx_channels_email ON channels(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_channels_handle ON channels(handle);
CREATE INDEX IF NOT EXISTS idx_channels_search ON channels
    USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Analytics history
CREATE TABLE IF NOT EXISTS channel_analytics (
    id SERIAL PRIMARY KEY,
    channel_id VARCHAR(255) REFERENCES channels(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    subscriber_count BIGINT,
    view_count BIGINT NOT NULL,
    video_count INTEGER NOT NULL,
    weekly_growth_rate FLOAT,
    UNIQUE(channel_id, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_analytics_channel ON channel_analytics(channel_id);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON channel_analytics(recorded_at);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    target_categories TEXT[] DEFAULT '{}',
    target_tiers TEXT[] DEFAULT '{}',
    min_subscribers INTEGER DEFAULT 0,
    max_subscribers INTEGER DEFAULT 10000000,
    budget DECIMAL(12, 2),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign influencers junction
CREATE TABLE IF NOT EXISTS campaign_influencers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    channel_id VARCHAR(255) REFERENCES channels(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'identified'
        CHECK (status IN ('identified', 'contacted', 'negotiating', 'contracted', 'completed')),
    email_sent_at TIMESTAMPTZ,
    email_opened BOOLEAN DEFAULT FALSE,
    replied BOOLEAN DEFAULT FALSE,
    deal_value DECIMAL(12, 2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_influencers_campaign ON campaign_influencers(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_influencers_channel ON campaign_influencers(channel_id);

-- API quota tracking (daily)
CREATE TABLE IF NOT EXISTS api_quota_log (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    units_used INTEGER NOT NULL DEFAULT 0,
    operation VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quota_date ON api_quota_log(date);

-- Row Level Security (optional — enable when using Supabase Auth)
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_analytics ENABLE ROW LEVEL SECURITY;

-- Public read for channels (adjust when adding auth)
CREATE POLICY "Allow public read channels" ON channels FOR SELECT USING (true);
CREATE POLICY "Allow public insert channels" ON channels FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update channels" ON channels FOR UPDATE USING (true);

CREATE POLICY "Allow public read campaigns" ON campaigns FOR SELECT USING (true);
CREATE POLICY "Allow public insert campaigns" ON campaigns FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update campaigns" ON campaigns FOR UPDATE USING (true);
CREATE POLICY "Allow public delete campaigns" ON campaigns FOR DELETE USING (true);

CREATE POLICY "Allow public read campaign_influencers" ON campaign_influencers FOR SELECT USING (true);
CREATE POLICY "Allow public insert campaign_influencers" ON campaign_influencers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update campaign_influencers" ON campaign_influencers FOR UPDATE USING (true);
CREATE POLICY "Allow public delete campaign_influencers" ON campaign_influencers FOR DELETE USING (true);

CREATE POLICY "Allow public read analytics" ON channel_analytics FOR SELECT USING (true);
CREATE POLICY "Allow public insert analytics" ON channel_analytics FOR INSERT WITH CHECK (true);
