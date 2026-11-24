import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { EngagementCalculator, type TierBenchmark } from "@/components/tools/EngagementCalculator";
import { BRAND_NAME } from "@/lib/brand";
import benchmarks from "@/data/engagement-benchmarks.json";

const PATH = "/tools/youtube-engagement-rate-calculator";

export const metadata: Metadata = {
  title: "YouTube Engagement Rate Calculator (Free) — with Benchmarks by Channel Size",
  description:
    "Calculate a YouTube video's engagement rate from views, likes and comments, and see how it compares to creators of the same size. Free, no sign-up.",
  alternates: { canonical: PATH },
};

export default function EngagementRateCalculatorPage() {
  const tiers = benchmarks.tiers as TierBenchmark[];
  const updated = new Date(benchmarks.generatedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const faq = [
    {
      q: "How is YouTube engagement rate calculated?",
      a: "Engagement rate = (likes + comments) ÷ views × 100. Using views instead of subscribers measures how the people who actually watched reacted, which is a fairer comparison between channels.",
    },
    {
      q: "What is a good engagement rate on YouTube?",
      a: `It depends on channel size. Across the creators we track, the median is about ${tiers[0]?.median}% for 1K–10K subscriber channels and about ${tiers[tiers.length - 1]?.median}% for channels over 1M. Anything in the top 25% for its size is strong.`,
    },
    {
      q: "Should brands care about engagement rate?",
      a: "Yes. Subscriber counts can be inflated or out of date; engagement on recent videos shows whether an audience is still active. Most brands look at recent average views and engagement together.",
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="font-mono text-xs uppercase tracking-wider text-mkt-ash">
        <Link href="/tools" className="hover:text-mkt-paper">Free tools</Link> / <span>Engagement rate</span>
      </nav>
      <h1 className="mkt-h2 mt-4 !text-4xl">YouTube Engagement Rate Calculator</h1>
      <p className="mkt-body mt-3 max-w-2xl">
        Enter a video&apos;s views, likes and comments to get its engagement rate — then see how it stacks up
        against YouTube creators of the same size.
      </p>

      <div className="mt-8">
        <EngagementCalculator tiers={tiers} />
      </div>

      <section className="mt-12">
        <h2 className="mkt-h3 !text-xl">YouTube engagement rate benchmarks by channel size</h2>
        <p className="mkt-body mt-2 !text-sm">
          Based on the last five uploads of active creators tracked by {BRAND_NAME} (updated {updated}).
        </p>
        <div className="mkt-card mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="font-mono text-[11px] uppercase tracking-wider text-mkt-ash">
              <tr>
                <th className="px-4 py-3">Subscribers</th>
                <th className="px-4 py-3">Bottom 25%</th>
                <th className="px-4 py-3">Median</th>
                <th className="px-4 py-3">Top 25%</th>
              </tr>
            </thead>
            <tbody className="font-mono text-mkt-paper">
              {tiers.map((t) => (
                <tr key={t.tier} className="border-t border-mkt-manila/15">
                  <td className="px-4 py-3">{t.label}</td>
                  <td className="px-4 py-3">below {t.p25}%</td>
                  <td className="px-4 py-3">{t.median}%</td>
                  <td className="px-4 py-3">above {t.p75}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12 space-y-5">
        <h2 className="mkt-h3 !text-xl">FAQ</h2>
        {faq.map((f) => (
          <div key={f.q}>
            <h3 className="font-medium text-mkt-paper">{f.q}</h3>
            <p className="mkt-body mt-1 !text-sm">{f.a}</p>
          </div>
        ))}
      </section>

      <p className="mt-10 text-sm text-mkt-ash">
        Also try the <Link href="/tools/youtube-sponsorship-calculator" className="mkt-link">YouTube sponsorship price calculator</Link>.
      </p>
    </MarketingShell>
  );
}
