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
      <p className="mkt-eyebrow">Compare</p>
      <h1 className="mkt-h2 mt-3 !text-4xl">{BRAND_NAME} vs other influencer tools</h1>
      <p className="mkt-body mt-3 max-w-2xl">
        {BRAND_NAME} is built only for YouTube. If that&apos;s where your creators are, here&apos;s how it compares.
      </p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {COMPARISONS.map((c) => (
          <Link key={c.slug} href={`/compare/${c.slug}`} className="mkt-card block p-6 hover:border-mkt-tally/50">
            <h2 className="mkt-h3 !text-lg">{c.name} alternative</h2>
            <p className="mkt-body mt-2 !text-sm">{c.name} is {c.tagline}.</p>
            <span className="mt-4 inline-block font-mono text-xs uppercase tracking-wider text-mkt-tally">Compare →</span>
          </Link>
        ))}
      </div>
    </MarketingShell>
  );
}
