import type { Tier } from "./types";

const DAILY_QUOTA_LIMIT = 10_000;

export function classifyTier(subscriberCount: number): Tier {
  if (subscriberCount >= 1_000_000) return "mega";
  if (subscriberCount >= 500_000) return "macro";
  if (subscriberCount >= 100_000) return "mid";
  if (subscriberCount >= 10_000) return "micro";
  return "nano";
}

function normalizeSubscribers(count: number): number {
  return Math.min(Math.log10(Math.max(count, 1)) / 7, 1);
}

function normalizeViews(views: number): number {
  return Math.min(Math.log10(Math.max(views, 1)) / 6, 1);
}

function normalizeEngagement(rate: number): number {
  if (rate >= 0.05) return 1;
  if (rate >= 0.01) return 0.5 + (rate - 0.01) / 0.08;
  return rate / 0.02;
}

function normalizeFrequency(freq: number): number {
  return Math.min(freq / 3, 1);
}

export function calculateScore(params: {
  subscriberCount: number;
  avgViews: number;
  engagementRate: number;
  uploadFrequency: number;
  accountAgeDays: number;
  viewToSubRatio: number;
}): number {
  const {
    subscriberCount,
    avgViews,
    engagementRate,
    uploadFrequency,
    accountAgeDays,
    viewToSubRatio,
  } = params;

  const score =
    (normalizeSubscribers(subscriberCount) * 0.25 +
      normalizeViews(avgViews) * 0.3 +
      normalizeEngagement(engagementRate) * 0.25 +
      normalizeFrequency(uploadFrequency) * 0.1 +
      Math.min(accountAgeDays / 365, 1) * 0.05 +
      Math.min(viewToSubRatio / 0.3, 1) * 0.05) *
    100;

  return Math.round(score * 100) / 100;
}

export function estimateEngagementRate(
  likes: number,
  comments: number,
  views: number
): number {
  if (views <= 0) return 0;
  return (likes + comments) / views;
}

export function extractEmail(text: string): string | null {
  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(regex);
  if (!matches) return null;

  const filtered = matches.filter(
    (e) =>
      !e.includes("youtube.com") &&
      !e.includes("google.com") &&
      !e.endsWith(".png") &&
      !e.endsWith(".jpg")
  );

  return filtered[0] ?? null;
}

export function extractSocialLinks(description: string) {
  const instagram = description.match(
    /https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9._]+/
  );
  const twitter = description.match(
    /https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+/
  );
  const tiktok = description.match(
    /https?:\/\/(www\.)?tiktok\.com\/@[a-zA-Z0-9._]+/
  );
  const website = description.match(
    /https?:\/\/(?!www\.youtube\.com|youtube\.com|instagram\.com|twitter\.com|x\.com|tiktok\.com)[^\s]+/
  );

  return {
    instagram: instagram?.[0] ?? null,
    twitter: twitter?.[0] ?? null,
    tiktok: tiktok?.[0] ?? null,
    website: website?.[0] ?? null,
  };
}

export { DAILY_QUOTA_LIMIT };
