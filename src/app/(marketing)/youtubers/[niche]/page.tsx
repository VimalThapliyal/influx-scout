import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/MarketingShell";
import { CreatorRankList } from "@/components/seo/CreatorRankList";
import { CountryHub, countryHubMetadata } from "@/components/seo/CountryHub";
import { BRAND_NAME } from "@/lib/brand";
import {
  MIN_CREATORS_PER_PAGE,
  SITE_URL,
  countryByCode,
  countryBySlug,
  getSeoCombos,
  getTopCreators,
  isNicheSlug,
  listPath,
  nicheName,
} from "@/lib/seo";

export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

// This segment serves two kinds of page: a niche ("/youtubers/fitness") or a
// country hub ("/youtubers/germany"). Niche and country slugs never overlap.
type Params = { params: { niche: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const country = countryBySlug(params.niche);
  if (country) return countryHubMetadata(country);
  if (!isNicheSlug(params.niche)) return {};
  const label = nicheName(params.niche);
  const year = new Date().getFullYear();
  const title = `Top ${label} YouTubers in the USA & Europe (${year})`;
  const description =
    `The top active ${label.toLowerCase()} YouTube creators in the US, UK, Canada, Australia and Europe, ` +
    `ranked by subscribers with recent views. Updated daily. Find and contact them with ${BRAND_NAME}.`;
  const path = listPath(params.niche);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: `${SITE_URL}${path}`, type: "website" },
  };
}

export default async function NichePage({ params }: Params) {
  const country = countryBySlug(params.niche);
  if (country) return <CountryHub country={country} />;
  if (!isNicheSlug(params.niche)) notFound();
  const niche = params.niche;
  const creators = await getTopCreators(niche);
  if (creators.length < MIN_CREATORS_PER_PAGE) notFound();

  const label = nicheName(niche);
  const countries = (await getSeoCombos()).filter((c) => c.niche === niche);
  const unlockHref = `/login?redirect=${encodeURIComponent(`/channels?niche=${niche}`)}`;

  return (
    <MarketingShell>
      <nav className="text-xs text-muted">
        <Link href="/youtubers" className="hover:text-fg">YouTubers</Link>
        {" / "}
        <span>{label}</span>
      </nav>
      <h1 className="h-page mt-4">Top {label} YouTubers in the USA &amp; Europe</h1>
      <p className="text-body mt-3 max-w-2xl">
        Active {label.toLowerCase()} creators across the US, UK, Canada, Australia and Europe, ranked by
        subscribers. Every creator posted in the last 45 days and gets real engagement on recent videos.
      </p>

      {countries.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {countries.map((c) => {
            const co = countryByCode(c.country)!;
            return (
              <Link key={c.country} href={listPath(niche, co.slug)} className="tag-pill hover:text-fg">
                {co.name.replace(/^the /, "")} ({c.count})
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-8">
        <CreatorRankList creators={creators} unlockHref={unlockHref} />
      </div>

      <div className="mt-8 text-center">
        <Link href={unlockHref} className="btn-primary inline-flex">
          Get contact details — free
        </Link>
      </div>
    </MarketingShell>
  );
}
