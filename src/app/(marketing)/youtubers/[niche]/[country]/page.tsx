import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/MarketingShell";
import { CreatorRankList } from "@/components/seo/CreatorRankList";
import { BRAND_NAME } from "@/lib/brand";
import {
  MIN_CREATORS_PER_PAGE,
  SITE_URL,
  countryByCode,
  countryBySlug,
  countryPath,
  getSeoCombos,
  getTopCreators,
  isNicheSlug,
  listPath,
  nicheName,
} from "@/lib/seo";

// Rendered on first visit, then cached and rebuilt at most once a day.
export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Params = { params: { niche: string; country: string } };

function resolve(params: Params["params"]) {
  const country = countryBySlug(params.country);
  if (!country || !isNicheSlug(params.niche)) return null;
  return { niche: params.niche, country };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const r = resolve(params);
  if (!r) return {};
  const year = new Date().getFullYear();
  const label = nicheName(r.niche);
  const title = `Top ${label} YouTubers in ${r.country.name} (${year})`;
  const description =
    `The top ${label.toLowerCase()} YouTube creators in ${r.country.name}, ranked by average views on their last five videos. Updated daily. Find and contact ${r.country.demonym} creators with ${BRAND_NAME}.`;
  const path = listPath(r.niche, r.country.slug);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: `${SITE_URL}${path}`, type: "website" },
  };
}

export default async function NicheCountryPage({ params }: Params) {
  const r = resolve(params);
  if (!r) notFound();
  const creators = await getTopCreators(r.niche, r.country.code);
  if (creators.length < MIN_CREATORS_PER_PAGE) notFound();

  const label = nicheName(r.niche);
  const combos = await getSeoCombos();
  const listed = combos.find((c) => c.niche === r.niche && c.country === r.country.code)?.count ?? creators.length;
  const otherCountries = combos.filter((c) => c.niche === r.niche && c.country !== r.country.code);
  const otherNiches = combos.filter((c) => c.country === r.country.code && c.niche !== r.niche);
  const withContact = creators.filter((c) => c.has_contact).length;
  const updated = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const unlockHref = `/login?redirect=${encodeURIComponent(`/channels?niche=${r.niche}&country=${r.country.code}`)}`;

  const faq = [
    {
      q: `How are these ${label.toLowerCase()} YouTubers ranked?`,
      a: `By average views on their last five videos. Every creator listed is independent, active (uploaded in the last 45 days), averages at least 5,000 views on recent videos (1,500 for channels under 50K subscribers), and has an engagement rate of 2% or more.`,
    },
    {
      q: `How do I contact ${r.country.demonym} ${label.toLowerCase()} YouTubers?`,
      a: `${withContact} of the ${creators.length} creators on this list have a public business contact (email, website, or contact form). Sign up to ${BRAND_NAME} to see contact details, save creators to lists, and track outreach.`,
    },
    {
      q: "How often is this list updated?",
      a: "Creator statistics are refreshed daily, and creators who stop uploading drop off the list automatically.",
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `Top ${label} YouTubers in ${r.country.name}`,
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
        <Link href={listPath(r.niche)} className="hover:text-fg">{label}</Link>
        {" / "}
        <Link href={countryPath(r.country.slug)} className="hover:text-fg">
          {r.country.name.replace(/^the /, "")}
        </Link>
      </nav>

      <h1 className="h-page mt-4">
        Top {label} YouTubers in {r.country.name}
      </h1>
      <p className="text-body mt-3 max-w-2xl">
        {listed > creators.length
          ? `The ${creators.length} most-viewed of ${listed.toLocaleString("en-US")} independent ${r.country.demonym} ${label.toLowerCase()} creators`
          : `${creators.length} independent ${r.country.demonym} ${label.toLowerCase()} creators`}
        , ranked by average views on their last five videos. Each one posted in the last 45 days.{" "}
        {withContact} of those shown have a public business contact.
      </p>
      <p className="mt-2 text-xs text-muted">Updated {updated}</p>

      <div className="mt-8">
        <CreatorRankList creators={creators} unlockHref={unlockHref} />
      </div>

      <div className="card mt-8 p-6 text-center">
        <p className="h-section">Reach these creators</p>
        <p className="text-body mx-auto mt-2 max-w-md !text-sm">
          See contact details, filter by views and engagement, and track outreach in one place.
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

      {(otherCountries.length > 0 || otherNiches.length > 0) && (
        <section className="mt-12 grid gap-8 md:grid-cols-2">
          {otherCountries.length > 0 && (
            <div>
              <h2 className="text-xs text-muted">
                {label} YouTubers in other countries
              </h2>
              <ul className="mt-3 space-y-1.5 text-sm">
                {otherCountries.map((c) => {
                  const co = countryByCode(c.country)!;
                  return (
                    <li key={c.country}>
                      <Link href={listPath(r.niche, co.slug)} className="text-link">
                        {label} YouTubers in {co.name.replace(/^the /, "")}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {otherNiches.length > 0 && (
            <div>
              <h2 className="text-xs text-muted">
                More {r.country.demonym} YouTubers
              </h2>
              <ul className="mt-3 space-y-1.5 text-sm">
                {otherNiches.map((c) => (
                  <li key={c.niche}>
                    <Link href={listPath(c.niche, r.country.slug)} className="text-link">
                      {nicheName(c.niche)} YouTubers in {r.country.name.replace(/^the /, "")}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </MarketingShell>
  );
}
