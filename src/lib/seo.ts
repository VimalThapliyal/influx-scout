/**
 * Public SEO pages: "Top <niche> YouTubers in <country>" lists built from
 * quality-passing creators. Server-only (uses the service role); never exposes
 * email addresses — only whether contact info exists.
 */
import { getSupabaseAdmin } from "./supabase";
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

/**
 * Count passing creators per (niche, country) for the SEO countries.
 * One pass over ~10k rows (two columns), paged past PostgREST's 1000 cap.
 */
export async function getSeoCombos(): Promise<SeoCombo[]> {
  const db = getSupabaseAdmin();
  const codes = SEO_COUNTRIES.map((c) => c.code);
  const counts = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("channels")
      .select("primary_niche, country")
      .eq("quality_pass", true)
      .not("primary_niche", "is", null)
      .in("country", codes)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      if (!r.primary_niche || !isNicheSlug(r.primary_niche)) continue;
      const key = `${r.primary_niche}|${r.country}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if (!data || data.length < 1000) break;
  }
  return Array.from(counts.entries())
    .map(([key, count]) => {
      const [niche, country] = key.split("|") as [NicheSlug, string];
      return { niche, country, count };
    })
    .filter((c) => c.count >= MIN_CREATORS_PER_PAGE)
    .sort((a, b) => b.count - a.count);
}

const CREATOR_COLUMNS =
  "id, title, handle, thumbnail_url, subscriber_count, avg_views_last5, latest_upload_at, country, primary_niche, email, website, instagram, has_contact_form";

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
    has_contact: Boolean(r.email || r.has_contact_form || r.website || r.instagram),
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
    .eq("primary_niche", niche)
    .order("subscriber_count", { ascending: false, nullsFirst: false })
    .limit(limit);
  q = countryCode ? q.eq("country", countryCode) : q.in("country", SEO_COUNTRIES.map((c) => c.code));
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(toSeoCreator);
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
