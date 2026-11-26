export type Tier = "nano" | "micro" | "mid" | "macro" | "mega";

export type CampaignStatus = "draft" | "active" | "completed";

export type InfluencerStatus =
  | "identified"
  | "contacted"
  | "negotiating"
  | "contracted"
  | "completed";

export interface Channel {
  id: string;
  handle: string | null;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  subscriber_count: number | null;
  view_count: number;
  video_count: number;
  country: string | null;
  published_at: string | null;
  category: string | null;
  email: string | null;
  email_masked?: string | null;
  email_locked?: boolean;
  has_email?: boolean;
  /** Scrape / enrichment outcome: found | locked | not_available */
  email_status?: "found" | "locked" | "not_available" | null;
  /** Where the public email was found (safe to show when locked). */
  email_source_url?: string | null;
  email_source_type?:
    | "description"
    | "creator_website"
    | "link_in_bio"
    | "management_website"
    | "instagram"
    | "youtube_about"
    | "other"
    | null;
  email_extracted_at?: string | null;
  /** scrape.txt §19 validation result */
  email_validation_status?:
    | "public_source_found"
    | "format_valid"
    | "mx_valid"
    | "provider_verified"
    | "risky"
    | "invalid"
    | "unknown"
    | null;
  email_is_role?: boolean | null;
  email_validated_at?: string | null;
  /** Public contact form on creator website (scrape.txt §20) */
  has_contact_form?: boolean | null;
  contact_form_url?: string | null;
  contact_form_purpose?: string | null;
  contact_form_has_captcha?: boolean | null;
  contact_form_checked_at?: string | null;
  /** Last website crawl robots.txt outcome (scrape.txt §17) */
  website_robots_allowed?: boolean | null;
  website_robots_checked_at?: string | null;
  /** Niche classification (scrape.txt §22) */
  primary_niche?: string | null;
  niche_confidence?: number | null;
  niche_method?: string | null;
  niche_evidence?: string[] | null;
  niche_classified_at?: string | null;
  /** Country confidence (scrape.txt §23) */
  country_confidence?:
    | "confirmed"
    | "high"
    | "medium"
    | "low"
    | "unknown"
    | null;
  country_evidence?: string[] | null;
  country_classified_at?: string | null;
  website: string | null;
  instagram: string | null;
  twitter: string | null;
  tiktok: string | null;
  influencer_score: number;
  tier: Tier | null;
  engagement_rate: number | null;
  avg_views_per_video: number | null;
  /** Last-5 quality gates (migration 019) */
  /** Sponsorship disclosures found in the last five videos' descriptions. */
  sponsored_recent?: boolean | null;
  recent_sponsors?: string[] | null;
  latest_upload_at?: string | null;
  avg_views_last5?: number | null;
  engagement_last5?: number | null;
  quality_pass?: boolean | null;
  quality_fail_reasons?: string[] | null;
  quality_scored_at?: string | null;
  location_tier?: "tier1" | "tier2" | "other" | null;
  is_emerging?: boolean | null;
  is_inactive?: boolean | null;
  activity_bucket?: "hot" | "warm" | "cold" | "unknown" | null;
  next_refresh_at?: string | null;
  discovery_source?: string | null;
  last_updated: string;
  /** YouTube API metrics snapshot times (scrape.txt §14) */
  metrics_fetched_at?: string | null;
  metrics_expires_at?: string | null;
  metrics_source_provider?: string | null;
  data_source: string;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  user_id?: string | null;
  name: string;
  description: string | null;
  target_categories: string[];
  target_tiers: string[];
  min_subscribers: number;
  max_subscribers: number;
  budget: number | null;
  status: CampaignStatus;
  created_at: string;
  updated_at: string;
}

export interface CampaignInfluencer {
  id: string;
  campaign_id: string;
  channel_id: string;
  status: InfluencerStatus;
  email_sent_at: string | null;
  email_opened: boolean;
  replied: boolean;
  deal_value: number | null;
  notes: string | null;
  created_at: string;
  channel?: Channel;
}

export interface DiscoverSearchRequest {
  keywords: string[];
  min_subscribers?: number;
  max_subscribers?: number;
  limit?: number;
  page_token?: string;
  region_code?: string;
  target_markets_only?: boolean;
  /** Search recent videos (This Week / Month) then unique channels */
  published_window?: "week" | "month" | "any";
  /** Prefer video-dated discovery over channel search */
  discovery_mode?: "channels" | "recent_videos";
}

export interface DiscoverSearchResponse {
  channels: Channel[];
  total_results: number;
  next_page_token: string | null;
  quota_used: number;
}

export interface YouTubeSearchItem {
  id: { channelId: string };
  snippet: {
    title: string;
    description: string;
    thumbnails: { default?: { url: string }; medium?: { url: string } };
    publishedAt: string;
  };
}

export interface YouTubeChannelItem {
  id: string;
  snippet?: {
    title: string;
    description: string;
    customUrl?: string;
    publishedAt: string;
    country?: string;
    thumbnails?: { default?: { url: string }; medium?: { url: string } };
  };
  statistics?: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
    hiddenSubscriberCount?: boolean;
  };
  brandingSettings?: {
    channel?: {
      title?: string;
      description?: string;
      unsubscribedTrailer?: string;
    };
  };
}
