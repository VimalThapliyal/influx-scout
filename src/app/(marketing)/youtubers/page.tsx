import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { BRAND_NAME } from "@/lib/brand";
import { countryByCode, getSeoCombos, listPath, nicheName, type SeoCombo } from "@/lib/seo";
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
      <p className="mkt-eyebrow">Creator lists</p>
      <h1 className="mkt-h2 mt-3 !text-4xl">YouTube influencers by niche &amp; country</h1>
      <p className="mkt-body mt-3 max-w-2xl">
        Ranked lists of active YouTube creators in the USA and Europe. Every creator posted in the last
        45 days, averages 5,000+ views on recent videos, and has real engagement.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {niches.map(([niche, list]) => (
          <section key={niche} className="mkt-card p-5">
            <h2 className="mkt-h3 !text-lg">
              <Link href={listPath(niche)} className="hover:underline">
                {nicheName(niche)} YouTubers
              </Link>
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {list.map((c) => {
                const co = countryByCode(c.country)!;
                return (
                  <li key={c.country}>
                    <Link href={listPath(niche, co.slug)} className="mkt-link">
                      {co.name.replace(/^the /, "")}
                    </Link>{" "}
                    <span className="font-mono text-xs text-mkt-ash">({c.count})</span>
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
