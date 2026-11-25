import Link from "next/link";
import { Check, Filter, ListChecks, Mail } from "lucide-react";
import { MarketingFooter, MarketingHeader } from "@/components/MarketingShell";
import { CreatorTable } from "@/components/ui";
import { PlanCards } from "@/components/PlanCards";
import { countryByCode, countryPath, hubCountries, listPath, nicheName, type SeoCombo } from "@/lib/seo";
import type { LandingData } from "@/lib/landing-data";

/** Share of scored channels failing each check. Scored library, November 2026 (see /blog). */
const CHECKS: { rule: string; failShare: number }[] = [
  { rule: "Posted a video in the last 45 days", failShare: 41.9 },
  { rule: "Based in the US, UK, Canada, Australia or Europe", failShare: 40.5 },
  { rule: "Averages 5,000+ views on the last five videos", failShare: 38.7 },
  { rule: "At least 2% of viewers like or comment", failShare: 27.1 },
];

const nf = (n: number) => n.toLocaleString("en-US");

export default function LandingPage({ data, combos }: { data: LandingData; combos: SeoCombo[] }) {
  const countries = hubCountries(combos).slice(0, 8);
  const nicheTotals = new Map<string, number>();
  for (const c of combos) nicheTotals.set(c.niche, (nicheTotals.get(c.niche) ?? 0) + c.count);
  const niches = Array.from(nicheTotals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const benefits = [
    {
      icon: Filter,
      title: "Filter on what a channel does now",
      body: "Sort and filter by average views on the last five videos, engagement and last upload date, along with niche, country and size.",
    },
    {
      icon: Mail,
      title: "See how each creator can be reached",
      body: data.withEmailCount
        ? `${nf(data.withEmailCount)} listed creators have a public business email. Others show a contact form or social links.`
        : "Each profile shows whether the creator has a public business email, a contact form or social links.",
    },
    {
      icon: ListChecks,
      title: "Keep outreach in one list",
      body: "Save creators to a campaign, mark who you contacted and who replied, and see the reply rate for each list.",
    },
  ];

  return (
    <div className="min-h-screen">
      <MarketingHeader width="max-w-6xl" />

      <main>
        <section className="mx-auto max-w-6xl px-4 pt-14 sm:px-6 sm:pt-20">
          <div className="max-w-2xl">
            <h1 className="h-display">Find YouTube creators who still get views</h1>
            <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
              Influx lists creators in the US and Europe by what their last five videos did, so you
              can shortlist channels for a sponsorship without checking each one by hand.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/channels" className="btn-primary btn-lg">
                Browse creators
              </Link>
              <Link href="/login" className="btn-secondary btn-lg">
                Create a free account
              </Link>
            </div>
          </div>

          {data.creators.length > 0 && (
            <div className="mt-12">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[0.8125rem] text-muted">
                  {data.passCount ? `${nf(data.passCount)} creators are listed today. ` : ""}
                  These eight posted in the last three weeks.
                </p>
                <Link href="/channels" className="text-link text-[0.8125rem]">
                  Open the full library
                </Link>
              </div>
              <CreatorTable channels={data.creators} />
            </div>
          )}
        </section>

        <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
          <div className="grid gap-x-10 gap-y-8 md:grid-cols-3">
            {benefits.map((b) => (
              <div key={b.title}>
                <b.icon size={18} strokeWidth={1.75} aria-hidden className="text-accent" />
                <h2 className="h-section mt-3">{b.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="method" className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
          <div className="grid gap-10 border-t border-line pt-12 lg:grid-cols-[1fr_1.4fr]">
            <div className="max-w-md">
              <h2 className="h-page">A creator is listed only if they pass four checks</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                We re-check listed creators every two weeks. Of 204,278 channels checked so far, 4.8% passed
                all four. A creator who stops posting drops off the list at the next check.
              </p>
              <Link href="/blog/how-to-vet-a-youtube-creator" className="text-link mt-4 inline-block text-sm">
                Read how we vet a creator
              </Link>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th scope="col" className="pb-2 font-medium">Check</th>
                  <th scope="col" className="w-40 pb-2 text-right font-medium">Channels that fail it</th>
                </tr>
              </thead>
              <tbody>
                {CHECKS.map((c) => (
                  <tr key={c.rule} className="border-b border-line last:border-0">
                    <td className="py-3 pr-4">
                      <span className="flex items-start gap-2 text-fg">
                        <Check size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-success" />
                        {c.rule}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="flex items-center justify-end gap-3">
                        <span className="hidden h-1.5 w-20 rounded-full bg-subtle sm:block" aria-hidden>
                          <span className="block h-1.5 rounded-full bg-muted/60" style={{ width: `${c.failShare}%` }} />
                        </span>
                        <span className="w-12 text-right tabular-nums text-fg">{c.failShare}%</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="pricing" className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
          <div className="border-t border-line pt-12">
            <h2 className="h-page">Pricing</h2>
            <p className="mt-2 max-w-xl text-sm text-muted">
              Browsing, filters and campaign lists are free. Email addresses and CSV export will be part of a
              paid plan that isn&apos;t open yet.
            </p>
            <div className="mt-6">
              <PlanCards />
            </div>
          </div>
        </section>

        {(countries.length > 0 || niches.length > 0) && (
          <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
            <div className="grid gap-10 border-t border-line pt-12 md:grid-cols-2">
              <div>
                <h2 className="h-section">Creator lists by country</h2>
                <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                  {countries.map((c) => {
                    const co = countryByCode(c.code)!;
                    return (
                      <li key={c.code} className="flex justify-between gap-2">
                        <Link href={countryPath(co.slug)} className="text-fg hover:text-accent hover:underline">
                          {co.name.replace(/^the /, "")}
                        </Link>
                        <span className="tabular-nums text-muted">{nf(c.count)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <h2 className="h-section">Creator lists by niche</h2>
                <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                  {niches.map(([n, count]) => (
                    <li key={n} className="flex justify-between gap-2">
                      <Link href={listPath(n as any)} className="text-fg hover:text-accent hover:underline">
                        {nicheName(n as any)}
                      </Link>
                      <span className="tabular-nums text-muted">{nf(count)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}
      </main>

      <MarketingFooter width="max-w-6xl" />
    </div>
  );
}
