import type { Metadata } from "next";
import { MarketingShell } from "@/components/MarketingShell";
import { PlanCards } from "@/components/PlanCards";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Pricing — ${BRAND_NAME}`,
  description: "Browsing creators, filters and campaign lists are free. Email addresses and CSV export will be part of Pro.",
  alternates: { canonical: "/pricing" },
};

const FAQ = [
  {
    q: "What can I do without paying?",
    a: "Everything except seeing full email addresses, exporting CSVs and AI-drafted emails. You can browse all listed creators, use every filter and track outreach in campaign lists.",
  },
  {
    q: "When will Pro be available?",
    a: "We haven't set a date or a price. Free accounts will be able to upgrade from inside the app when it opens.",
  },
  {
    q: "Where does the data come from?",
    a: "Channel statistics come from the YouTube Data API. Contact details are only those a creator has published themselves, and any creator can ask to be removed.",
  },
];

export default function PricingPage() {
  return (
    <MarketingShell>
      <h1 className="h-page">Pricing</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Browsing, filters and campaign lists are free. Email addresses and CSV export will be part of a paid
        plan that isn&apos;t open yet.
      </p>
      <div className="mt-8">
        <PlanCards />
      </div>
      <section className="mt-14 max-w-2xl">
        <h2 className="h-section">Questions</h2>
        <dl className="mt-4 divide-y divide-line border-y border-line">
          {FAQ.map((f) => (
            <div key={f.q} className="py-4">
              <dt className="text-sm font-medium text-fg">{f.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </MarketingShell>
  );
}
