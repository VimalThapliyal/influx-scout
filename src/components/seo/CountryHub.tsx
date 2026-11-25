import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/MarketingShell";
import { CreatorRankList } from "@/components/seo/CreatorRankList";
import { BRAND_NAME } from "@/lib/brand";
import {
  MIN_CREATORS_PER_PAGE,
  SITE_URL,
  countryPath,
  getSeoCombos,
  getTopCreatorsInCountry,
  listPath,
  nicheName,
} from "@/lib/seo";

type Country = { code: string; slug: string; name: string; demonym: string };

const plainName = (c: Country) => c.name.replace(/^the /, "");

export function countryHubMetadata(country: Country): Metadata {
  const year = new Date().getFullYear();
  const title = `Top ${country.demonym} YouTubers for Brand Deals (${year})`;
  const description =
    `Active YouTube creators in ${country.name} across fitness, beauty, gaming, tech, finance and more, ` +
    `ranked by subscribers with recent views. Updated daily. Find and contact ${country.demonym} creators with ${BRAND_NAME}.`;
  const path = countryPath(country.slug);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: `${SITE_URL}${path}`, type: "website" },
  };
}

/** "/youtubers/<country>": every niche list for one country plus the biggest creators there. */
export async function CountryHub({ country }: { country: Country }) {
  const [creators, combos] = await Promise.all([getTopCreatorsInCountry(country.code), getSeoCombos()]);
  if (creators.length < MIN_CREATORS_PER_PAGE) notFound();

  const niches = combos.filter((c) => c.country === country.code);
  const total = niches.reduce((s, c) => s + c.count, 0);
  const withContact = creators.filter((c) => c.has_contact).length;
  const unlockHref = `/login?redirect=${encodeURIComponent(`/channels?country=${country.code}`)}`;
  const name = plainName(country);

  const faq = [
    {
      q: `How do I find ${country.demonym} YouTubers for a brand campaign?`,
      a: `Pick a niche below to see active ${country.demonym} creators in it, ranked by subscribers. Every creator uploaded in the last 45 days, averages at least 5,000 views on recent videos, and has an engagement rate of 2% or more.`,
    },
    {
      q: `How do I contact ${country.demonym} YouTubers?`,
      a: `${withContact} of the ${creators.length} creators below have a public business contact (email, website, or contact form). Sign up to ${BRAND_NAME} to see contact details, save creators to lists, and track outreach.`,
    },
    {
      q: "How often are these lists updated?",
      a: "Creator statistics are refreshed daily, and creators who stop uploading drop off automatically.",
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `Top ${country.demonym} YouTubers`,
      itemListElement: creators.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `https://www.youtube.com/channel/${c.id}`,
        name: c.title,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="text-xs text-muted">
        <Link href="/youtubers" className="hover:text-fg">YouTubers</Link>
        {" / "}
        <span>{name}</span>
      </nav>

      <h1 className="h-page mt-4">Top {country.demonym} YouTubers for brand deals</h1>
      <p className="text-body mt-3 max-w-2xl">
        {niches.length > 0
          ? `${total} active YouTube creators in ${country.name} across ${niches.length} niches. `
          : `Active YouTube creators in ${country.name}. `}
        Every one posted in the last 45 days and gets real engagement on recent videos.{" "}
        {niches.length > 0 ? "Browse by niche, or see" : "See"} the biggest {country.demonym} creators below.
      </p>

      {niches.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs text-muted">
            {country.demonym} YouTubers by niche
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {niches.map((c) => (
              <Link key={c.niche} href={listPath(c.niche, country.slug)} className="tag-pill hover:text-fg">
                {nicheName(c.niche)} ({c.count})
              </Link>
            ))}
          </div>
        </section>
      )}

      <h2 className="h-section mt-10">Biggest active {country.demonym} creators</h2>
      <div className="mt-4">
        <CreatorRankList creators={creators} unlockHref={unlockHref} />
      </div>

      <div className="card mt-8 p-6 text-center">
        <p className="h-section">Reach {country.demonym} creators</p>
        <p className="text-body mx-auto mt-2 max-w-md !text-sm">
          See contact details, filter by niche, views and engagement, and track outreach in one place.
        </p>
        <Link href={unlockHref} className="btn-primary mt-5 inline-flex">
          Get contact details — free
        </Link>
      </div>

      <section className="mt-12 space-y-5">
        <h2 className="h-section">FAQ</h2>
        {faq.map((f) => (
          <div key={f.q}>
            <h3 className="font-medium text-fg">{f.q}</h3>
            <p className="text-body mt-1 !text-sm">{f.a}</p>
          </div>
        ))}
      </section>
    </MarketingShell>
  );
}
