import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { BRAND_NAME } from "@/lib/brand";
import {
  countryByCode,
  countryPath,
  getSeoCombos,
  hubCountries,
  listPath,
  nicheName,
  type SeoCombo,
} from "@/lib/seo";
import type { NicheSlug } from "@/lib/classify";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: `YouTube Influencer Lists by Niche & Country — ${BRAND_NAME}`,
  description:
    "Browse ranked lists of active YouTube creators in the USA, UK, Canada, Australia and Europe by niche: fitness, beauty, gaming, tech, finance and more. Updated daily.",
  alternates: { canonical: "/youtubers" },
};

export default async function YoutubersIndexPage() {
  const combos = await getSeoCombos();
  const byNiche = new Map<NicheSlug, SeoCombo[]>();
  for (const c of combos) {
    if (!byNiche.has(c.niche)) byNiche.set(c.niche, []);
    byNiche.get(c.niche)!.push(c);
  }
  const niches = Array.from(byNiche.entries()).sort(
    (a, b) => b[1].reduce((s, c) => s + c.count, 0) - a[1].reduce((s, c) => s + c.count, 0)
  );

  return (
    <MarketingShell>
      <h1 className="h-page">YouTube influencers by niche &amp; country</h1>
      <p className="text-body mt-3 max-w-2xl">
        Ranked lists of active YouTube creators in the USA and Europe. Every creator posted in the last
        45 days, averages 5,000+ views on recent videos, and has real engagement.
      </p>

      <section className="mt-8">
        <h2 className="text-xs text-muted">Browse by country</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {hubCountries(combos).map((c) => {
            const co = countryByCode(c.code)!;
            return (
              <Link key={c.code} href={countryPath(co.slug)} className="tag-pill hover:text-fg">
                {co.demonym} YouTubers ({c.count})
              </Link>
            );
          })}
        </div>
      </section>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {niches.map(([niche, list]) => (
          <section key={niche} className="card p-5">
            <h2 className="h-section">
              <Link href={listPath(niche)} className="hover:underline">
                {nicheName(niche)} YouTubers
              </Link>
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {list.map((c) => {
                const co = countryByCode(c.country)!;
                return (
                  <li key={c.country}>
                    <Link href={listPath(niche, co.slug)} className="text-link">
                      {co.name.replace(/^the /, "")}
                    </Link>{" "}
                    <span className="text-xs text-muted">({c.count})</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </MarketingShell>
  );
}
