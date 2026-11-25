import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { BRAND_NAME } from "@/lib/brand";
import { COMPARISONS } from "@/lib/comparisons";

export const metadata: Metadata = {
  title: `${BRAND_NAME} vs Other Influencer Marketing Tools`,
  description: `Honest comparisons of ${BRAND_NAME} with Modash, HypeAuditor, Upfluence and Heepsy for finding YouTube influencers in the USA & Europe.`,
  alternates: { canonical: "/compare" },
};

export default function CompareIndexPage() {
  return (
    <MarketingShell>
      <h1 className="h-page">{BRAND_NAME} vs other influencer tools</h1>
      <p className="text-body mt-3 max-w-2xl">
        {BRAND_NAME} is built only for YouTube. If that&apos;s where your creators are, here&apos;s how it compares.
      </p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {COMPARISONS.map((c) => (
          <Link key={c.slug} href={`/compare/${c.slug}`} className="card block p-6 hover:border-accent/50">
            <h2 className="h-section">{c.name} alternative</h2>
            <p className="text-body mt-2 !text-sm">{c.name} is {c.tagline}.</p>
            <span className="mt-4 inline-block text-xs text-accent">Compare</span>
          </Link>
        ))}
      </div>
    </MarketingShell>
  );
}
