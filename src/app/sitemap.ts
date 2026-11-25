import type { MetadataRoute } from "next";
import { SITE_URL, countryByCode, countryPath, getSeoCombos, hubCountries, listPath } from "@/lib/seo";
import { COMPARISONS } from "@/lib/comparisons";
import { POSTS } from "@/content/blog";

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/youtubers`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/tools`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/tools/youtube-engagement-rate-calculator`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/tools/youtube-sponsorship-calculator`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    ...POSTS.map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: new Date(p.published),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: `${SITE_URL}/compare`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    ...COMPARISONS.map((c) => ({
      url: `${SITE_URL}/compare/${c.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  let combos: Awaited<ReturnType<typeof getSeoCombos>> = [];
  try {
    combos = await getSeoCombos();
  } catch {
    return staticPages; // never fail the sitemap because the DB is slow
  }

  const niches = Array.from(new Set(combos.map((c) => c.niche)));
  const nichePages = niches.map((n) => ({
    url: `${SITE_URL}${listPath(n)}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));
  const listPages = combos.map((c) => ({
    url: `${SITE_URL}${listPath(c.niche, countryByCode(c.country)!.slug)}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  const countryPages = hubCountries(combos).map((c) => ({
    url: `${SITE_URL}${countryPath(countryByCode(c.code)!.slug)}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...countryPages, ...nichePages, ...listPages];
}
