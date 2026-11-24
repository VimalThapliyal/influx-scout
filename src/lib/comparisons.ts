/**
 * "<Competitor> alternative" comparison pages. Competitor facts are limited to
 * what their public sites / review listings said when last checked; keep them
 * conservative and dated, and link to the competitor's own pricing page.
 */
export const COMPARISONS_LAST_CHECKED = "November 2026";

export interface Comparison {
  slug: string; // URL: /compare/<slug>
  name: string;
  site: string;
  pricingUrl: string;
  tagline: string; // one-line positioning of the competitor
  platforms: string;
  pricing: string;
  freePlan: string;
  audienceData: string;
  strengths: string[];
  chooseThemIf: string[];
}

export const COMPARISONS: Comparison[] = [
  {
    slug: "modash-alternative",
    name: "Modash",
    site: "https://www.modash.io",
    pricingUrl: "https://www.modash.io/pricing",
    tagline: "a large multi-platform influencer discovery and campaign tool",
    platforms: "Instagram, TikTok, YouTube",
    pricing: "Paid plans from about $199/month (14-day trial)",
    freePlan: "Free trial",
    audienceData: "Yes — audience demographics and credibility",
    strengths: [
      "Covers Instagram and TikTok as well as YouTube",
      "Audience demographics on creator profiles",
      "Shopify integration for tracking sales from creators",
    ],
    chooseThemIf: [
      "You run campaigns across Instagram and TikTok, not only YouTube",
      "You need audience age, gender and location breakdowns",
      "You sell on Shopify and want sales attribution built in",
    ],
  },
  {
    slug: "hypeauditor-alternative",
    name: "HypeAuditor",
    site: "https://hypeauditor.com",
    pricingUrl: "https://hypeauditor.com/pricing/",
    tagline: "an influencer analytics platform known for audience-quality and fraud checks",
    platforms: "Instagram, YouTube, TikTok, Twitch, X, Snapchat",
    pricing: "Not published — request a demo",
    freePlan: "Limited free tools",
    audienceData: "Yes — audience quality and fake-follower analysis",
    strengths: [
      "Detailed audience authenticity and fraud analytics",
      "Covers six social platforms",
      "Market research and competitor reports",
    ],
    chooseThemIf: [
      "Fake-follower and audience-quality audits are your main need",
      "You work across many platforms including Twitch and Snapchat",
      "You have budget for an enterprise analytics contract",
    ],
  },
  {
    slug: "upfluence-alternative",
    name: "Upfluence",
    site: "https://www.upfluence.com",
    pricingUrl: "https://www.upfluence.com/pricing",
    tagline: "an all-in-one influencer and affiliate platform for e-commerce brands",
    platforms: "Instagram, TikTok, YouTube, X, Pinterest, Twitch, blogs",
    pricing: "Not published — sales call required",
    freePlan: "No",
    audienceData: "Yes",
    strengths: [
      "CRM, creator payments and affiliate tracking in one product",
      "E-commerce integrations",
      "Covers blogs and many social platforms",
    ],
    chooseThemIf: [
      "You want discovery, contracts, payments and affiliate tracking in one tool",
      "You run large always-on programs with many creators",
      "You have an annual software budget for influencer marketing",
    ],
  },
  {
    slug: "heepsy-alternative",
    name: "Heepsy",
    site: "https://www.heepsy.com",
    pricingUrl: "https://www.heepsy.com/pricing",
    tagline: "an influencer search tool with published, flat monthly pricing",
    platforms: "Instagram, TikTok, YouTube",
    pricing: "Published monthly plans, entry tier around $69/month",
    freePlan: "Yes (limited)",
    audienceData: "Yes",
    strengths: [
      "Simple, transparent monthly pricing",
      "Instagram and TikTok coverage",
      "Free plan to try searches",
    ],
    chooseThemIf: [
      "Instagram or TikTok is your main channel",
      "You want a simple paid search tool with a published price",
    ],
  },
];

/** What Influx actually offers today — keep in sync with the product. */
export const INFLUX_ROW = {
  platforms: "YouTube only (built deep for YouTube)",
  pricing: "Free during early access",
  freePlan: "Yes",
  audienceData: "Not yet — channel and recent-video metrics only",
};

export const INFLUX_STRENGTHS = [
  "Every listed creator passes a quality check: uploaded in the last 45 days, 5,000+ average views on recent videos, 2%+ engagement",
  "Focused on creators in the USA, UK, Canada, Australia and Europe",
  "Public business contacts: email, website or contact form",
  "Statistics refreshed continuously so lists don't go stale",
  "Save creators to lists and track outreach: contacted, replied, negotiating",
];

export function comparisonBySlug(slug: string) {
  return COMPARISONS.find((c) => c.slug === slug) ?? null;
}
