/**
 * Public SEO pages: "Top <niche> YouTubers in <country>" lists built from
 * quality-passing creators. Server-only (uses the service role); never exposes
 * email addresses — only whether contact info exists.
 */
import { cache } from "react";
import { getSupabaseAdmin } from "./supabase";
import { INDEPENDENT_FILTER, activeSince } from "./library-counts";
import { NICHE_LABELS, type NicheSlug } from "./classify";

/** Canonical site origin. Change NEXT_PUBLIC_APP_URL when a custom domain is added. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL || "https://influencer-platform-mu.vercel.app"
).replace(/\/$/, "");

/** A list page is published only with at least this many creators. */
export const MIN_CREATORS_PER_PAGE = 10;
export const CREATORS_PER_PAGE = 50;

export const SEO_COUNTRIES: { code: string; slug: string; name: string; demonym: string }[] = [
  { code: "US", slug: "united-states", name: "the United States", demonym: "American" },
  { code: "GB", slug: "united-kingdom", name: "the United Kingdom", demonym: "British" },
  { code: "CA", slug: "canada", name: "Canada", demonym: "Canadian" },
  { code: "AU", slug: "australia", name: "Australia", demonym: "Australian" },
  { code: "DE", slug: "germany", name: "Germany", demonym: "German" },
  { code: "FR", slug: "france", name: "France", demonym: "French" },
  { code: "NL", slug: "netherlands", name: "the Netherlands", demonym: "Dutch" },
  { code: "ES", slug: "spain", name: "Spain", demonym: "Spanish" },
  { code: "IT", slug: "italy", name: "Italy", demonym: "Italian" },
  { code: "IE", slug: "ireland", name: "Ireland", demonym: "Irish" },
  { code: "SE", slug: "sweden", name: "Sweden", demonym: "Swedish" },
  { code: "PL", slug: "poland", name: "Poland", demonym: "Polish" },
];

export function countryBySlug(slug: string) {
  return SEO_COUNTRIES.find((c) => c.slug === slug) ?? null;
}

export function countryByCode(code: string | null | undefined) {
  return SEO_COUNTRIES.find((c) => c.code === code) ?? null;
}

export function isNicheSlug(slug: string): slug is NicheSlug {
  return Object.prototype.hasOwnProperty.call(NICHE_LABELS, slug);
}

export function nicheName(slug: NicheSlug): string {
  return NICHE_LABELS[slug];
}

export interface SeoCreator {
  id: string;
  title: string;
  handle: string | null;
  thumbnail_url: string | null;
  subscriber_count: number | null;
  avg_views_last5: number | null;
  latest_upload_at: string | null;
  country: string | null;
  primary_niche: string | null;
  has_contact: boolean;
}

export interface SeoCombo {
  niche: NicheSlug;
  country: string; // ISO code
  count: number;
}

export interface SeoData {
  /** (niche, country) pairs with enough creators for a list page. */
  combos: SeoCombo[];
  /** Listed independent creators per country, whatever their niche. */
  countryTotals: { code: string; count: number }[];
}

/**
 * Counts for the public lists: independent creators who pass the checks and
 * uploaded in the last 45 days, in the SEO countries. One pass over ~8k rows
 * (two columns), paged past PostgREST's 1000 cap, shared within a request.
 */
export const getSeoData = cache(async (): Promise<SeoData> => {
  const db = getSupabaseAdmin();
  const codes = SEO_COUNTRIES.map((c) => c.code);
  const pairs = new Map<string, number>();
  const countries = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("channels")
      .select("primary_niche, country")
      .eq("quality_pass", true)
      .is("opted_out_at", null)
      .gte("latest_upload_at", activeSince())
      .or(INDEPENDENT_FILTER)
      .in("country", codes)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      countries.set(r.country, (countries.get(r.country) ?? 0) + 1);
      if (!r.primary_niche || !isNicheSlug(r.primary_niche)) continue;
      const key = `${r.primary_niche}|${r.country}`;
      pairs.set(key, (pairs.get(key) ?? 0) + 1);
    }
    if (!data || data.length < 1000) break;
  }
  return {
    combos: Array.from(pairs.entries())
      .map(([key, count]) => {
        const [niche, country] = key.split("|") as [NicheSlug, string];
        return { niche, country, count };
      })
      .filter((c) => c.count >= MIN_CREATORS_PER_PAGE)
      .sort((a, b) => b.count - a.count),
    countryTotals: Array.from(countries.entries())
      .map(([code, count]) => ({ code, count }))
      .filter((c) => c.count >= MIN_CREATORS_PER_PAGE)
      .sort((a, b) => b.count - a.count),
  };
});

export async function getSeoCombos(): Promise<SeoCombo[]> {
  return (await getSeoData()).combos;
}

const CREATOR_COLUMNS =
  "id, title, handle, thumbnail_url, subscriber_count, avg_views_last5, latest_upload_at, country, primary_niche, email, email_validation_status, website, instagram, has_contact_form";

function toSeoCreator(r: Record<string, any>): SeoCreator {
  return {
    id: r.id,
    title: r.title,
    handle: r.handle ?? null,
    thumbnail_url: r.thumbnail_url ?? null,
    subscriber_count: r.subscriber_count ?? null,
    avg_views_last5: r.avg_views_last5 ?? null,
    latest_upload_at: r.latest_upload_at ?? null,
    country: r.country ?? null,
    primary_niche: r.primary_niche ?? null,
    // Only a boolean leaves the server — never the address itself.
    has_contact: Boolean((r.email && r.email_validation_status !== "risky") || r.has_contact_form || r.website || r.instagram),
  };
}

/** Top passing creators for a niche, optionally limited to one country (else all SEO countries). */
export async function getTopCreators(
  niche: NicheSlug,
  countryCode?: string,
  limit = CREATORS_PER_PAGE
): Promise<SeoCreator[]> {
  const db = getSupabaseAdmin();
  let q = db
    .from("channels")
    .select(CREATOR_COLUMNS)
    .eq("quality_pass", true)
    .is("opted_out_at", null)
    .gte("latest_upload_at", activeSince())
    .eq("primary_niche", niche)
    .or(INDEPENDENT_FILTER)
    .order("avg_views_last5", { ascending: false, nullsFirst: false })
    .limit(limit);
  q = countryCode ? q.eq("country", countryCode) : q.in("country", SEO_COUNTRIES.map((c) => c.code));
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(toSeoCreator);
}

/** Top passing creators in one country across every niche (country hub pages). */
export async function getTopCreatorsInCountry(
  countryCode: string,
  limit = CREATORS_PER_PAGE
): Promise<SeoCreator[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("channels")
    .select(CREATOR_COLUMNS)
    .eq("quality_pass", true)
    .is("opted_out_at", null)
    .gte("latest_upload_at", activeSince())
    .eq("country", countryCode)
    .or(INDEPENDENT_FILTER)
    .order("avg_views_last5", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toSeoCreator);
}

export function countryPath(countrySlug: string): string {
  return `/youtubers/${countrySlug}`;
}

export function formatCount(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`;
  return String(n);
}

export function listPath(niche: NicheSlug, countrySlug?: string): string {
  return countrySlug ? `/youtubers/${niche}/${countrySlug}` : `/youtubers/${niche}`;
}
