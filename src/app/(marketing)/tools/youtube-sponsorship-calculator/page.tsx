import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { SponsorshipCalculator } from "@/components/tools/SponsorshipCalculator";
import { FORMAT_CPM } from "@/lib/sponsorship-pricing";

const PATH = "/tools/youtube-sponsorship-calculator";

export const metadata: Metadata = {
  title: "YouTube Sponsorship Price Calculator — How Much to Pay a YouTuber",
  description:
    "Estimate how much a YouTube sponsorship costs from average views, niche and format (integration, dedicated video or Short). Free, no sign-up.",
  alternates: { canonical: PATH },
};

export default function SponsorshipCalculatorPage() {
  const i = FORMAT_CPM.integration!;
  const d = FORMAT_CPM.dedicated!;
  const faq = [
    {
      q: "How much does a YouTube sponsorship cost?",
      a: `Most sponsorships are priced per thousand views (CPM). A 60–90 second integrated mention commonly falls around $${i.low}–$${i.high} per 1,000 views, and a dedicated video around $${d.low}–$${d.high}, with finance, business and tech at the high end.`,
    },
    {
      q: "Should I price on subscribers or views?",
      a: "Views. Subscriber counts include people who no longer watch; the average views of a creator's recent videos is a much better predictor of what your sponsorship will get.",
    },
    {
      q: "Why is this an estimate?",
      a: "Creators set their own rates. Audience location, engagement, usage rights, exclusivity and the number of deliverables all move the price, so use this range as a starting point for negotiation.",
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
      <nav className="text-xs text-muted">
        <Link href="/tools" className="hover:text-fg">Free tools</Link> / <span>Sponsorship price</span>
      </nav>
      <h1 className="h-page mt-4">YouTube Sponsorship Price Calculator</h1>
      <p className="text-body mt-3 max-w-2xl">
        Estimate a fair price for a YouTube sponsorship from a creator&apos;s average views, their niche and the
        format you want.
      </p>

      <div className="mt-8">
        <SponsorshipCalculator />
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

      <p className="mt-10 text-sm text-muted">
        Also try the <Link href="/tools/youtube-engagement-rate-calculator" className="text-link">YouTube engagement rate calculator</Link>.
      </p>
    </MarketingShell>
  );
}
