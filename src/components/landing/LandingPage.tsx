import Link from "next/link";
import { MarketingFooter, MarketingHeader } from "@/components/MarketingShell";
import { formatCount, countryByCode, countryPath, hubCountries, listPath, nicheName, type SeoCombo } from "@/lib/seo";
import type { LandingData, LedgerCreator } from "@/lib/landing-data";

/** Snapshot from the scored library, November 2026 (same data as the blog). */
const CHECKS: { rule: string; detail: string; failShare: number }[] = [
  { rule: "Uploaded in the last 45 days", detail: "Quiet channels deliver late and get less reach.", failShare: 41.9 },
  { rule: "Based in the US, UK, Canada, Australia or Europe", detail: "Set by the creator on their channel.", failShare: 40.5 },
  { rule: "Averages 5,000+ views on its last five videos", detail: "Higher for gaming and music, lower for finance and education.", failShare: 38.7 },
  { rule: "Engagement of 2% or more", detail: "Likes and comments divided by views, last five videos.", failShare: 27.1 },
];
const SCORED_SNAPSHOT = 204_278;
const PASS_SHARE_SNAPSHOT = 4.8;

const VIEWS_PER_SUB: { tier: string; pct: number }[] = [
  { tier: "1K–10K", pct: 45.6 },
  { tier: "10K–100K", pct: 15.5 },
  { tier: "100K–500K", pct: 8.3 },
  { tier: "500K–1M", pct: 5.4 },
  { tier: "1M+", pct: 2.9 },
];

const nf = (n: number) => n.toLocaleString("en-US");

function ViewStrip({ views, label }: { views: number[]; label: string }) {
  const max = Math.max(...views, 1);
  const w = 84;
  const h = 26;
  const gap = 4;
  const bw = (w - gap * (views.length - 1)) / views.length;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="shrink-0">
      {views.map((v, i) => {
        const bh = Math.max(2, (v / max) * h);
        return (
          <rect
            key={i}
            x={i * (bw + gap)}
            y={h - bh}
            width={bw}
            height={bh}
            rx={1.5}
            className={i === views.length - 1 ? "fill-mkt-tally" : "fill-mkt-tally/35"}
          />
        );
      })}
    </svg>
  );
}

function Ledger({ creators }: { creators: LedgerCreator[] }) {
  if (!creators.length) return null;
  return (
    <figure className="rounded-lg border border-mkt-manila/20 bg-mkt-surface">
      <figcaption className="border-b border-mkt-manila/15 px-5 py-3.5">
        <p className="font-medium text-mkt-paper">Passing creators who posted in the last three weeks</p>
        <p className="mt-0.5 text-sm text-mkt-ash">Bars show views on each creator&apos;s last five uploads, newest on the right.</p>
      </figcaption>
      <ol>
        {creators.map((c) => (
          <li key={c.id} className="flex items-center gap-4 border-b border-mkt-manila/10 px-5 py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <a
                href={`https://www.youtube.com/channel/${c.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate font-medium text-mkt-paper hover:underline"
              >
                {c.title}
              </a>
              <p className="text-sm text-mkt-ash">
                {c.niche}, {countryByCode(c.country)?.name.replace(/^the /, "") ?? c.country}
              </p>
              <p className="mt-0.5 text-sm tabular-nums text-mkt-ash">
                <span className="font-medium text-mkt-paper">{formatCount(c.avgViews)}</span> avg views,{" "}
                <span className="font-medium text-mkt-paper">{(c.engagement * 100).toFixed(1)}%</span> engagement,{" "}
                {formatCount(c.subscribers)} subscribers
              </p>
            </div>
            <ViewStrip
              views={c.views}
              label={`Views on last five uploads: ${c.views.map((v) => nf(v)).join(", ")}`}
            />
          </li>
        ))}
      </ol>
    </figure>
  );
}

export default function LandingPage({ data, combos }: { data: LandingData; combos: SeoCombo[] }) {
  const countries = hubCountries(combos).slice(0, 9);
  const nicheTotals = new Map<string, number>();
  for (const c of combos) nicheTotals.set(c.niche, (nicheTotals.get(c.niche) ?? 0) + c.count);
  const niches = Array.from(nicheTotals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const pass = data.passCount;

  return (
    <div className="mkt-shell">
      <MarketingHeader width="max-w-6xl" />

      <main>
        {/* Hero: the claim, and the evidence for it next to it. */}
        <section className="mx-auto grid max-w-6xl items-start gap-12 px-5 pb-20 pt-14 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:pt-20">
          <div className="max-w-xl">
            <h1 className="mkt-h1 font-poster">YouTube creators in the US and Europe who still get views.</h1>
            <p className="mt-6 text-lg leading-relaxed text-mkt-ash">
              Subscriber counts are years old. Influx looks at what a channel did in the last few weeks: its
              last five uploads, their views and how many viewers liked or commented.
              {pass ? (
                <>
                  {" "}
                  Right now <span className="font-semibold text-mkt-paper">{nf(pass)}</span> creators pass.
                </>
              ) : null}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/youtubers" className="mkt-btn-primary">
                Browse creator lists
              </Link>
              <a href="#method" className="mkt-btn-secondary">
                How a channel gets listed
              </a>
            </div>
            <p className="mt-4 text-sm text-mkt-ash">Free to browse. No card needed to sign up.</p>
          </div>
          <Ledger creators={data.creators} />
        </section>

        {/* Method: the four checks, with how many channels each one removes. */}
        <section id="method" className="border-y border-mkt-manila/15 bg-mkt-surface/60">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
              <div className="max-w-md">
                <h2 className="mkt-h2 font-poster">Four checks, every two weeks</h2>
                <p className="mt-4 leading-relaxed text-mkt-ash">
                  We scored {nf(SCORED_SNAPSHOT)} channels. Most fail more than one check, and{" "}
                  {PASS_SHARE_SNAPSHOT}% pass all four. Creators who stop posting drop off the lists on their next
                  check.
                </p>
              </div>
              <ul className="space-y-6">
                {CHECKS.map((c) => (
                  <li key={c.rule}>
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="font-medium text-mkt-paper">{c.rule}</p>
                      <p className="shrink-0 text-sm tabular-nums text-mkt-ash">{c.failShare}% fail</p>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-mkt-manila/10" aria-hidden>
                      <div className="h-2 rounded-full bg-mkt-fail/70" style={{ width: `${c.failShare}%` }} />
                    </div>
                    <p className="mt-1.5 text-sm text-mkt-ash">{c.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* One finding from the data, linked to the full write-up. */}
        <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
          <div className="max-w-md">
            <h2 className="mkt-h2 font-poster">Bigger channels reach less of their audience</h2>
            <p className="mt-4 leading-relaxed text-mkt-ash">
              A new video from a channel with a million subscribers is typically seen by under 3% of them. Price a
              sponsorship on recent views, not on the subscriber count.
            </p>
            <Link href="/blog/youtube-subscribers-vs-views" className="mkt-link mt-4 inline-block">
              Read the analysis
            </Link>
          </div>
          <figure>
            <ul className="space-y-3">
              {VIEWS_PER_SUB.map((t) => (
                <li key={t.tier} className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-3 text-sm">
                  <span className="text-mkt-ash">{t.tier}</span>
                  <span className="h-6 rounded-sm bg-mkt-manila/10">
                    <span
                      className="block h-6 rounded-sm bg-mkt-tally/80"
                      style={{ width: `${(t.pct / VIEWS_PER_SUB[0].pct) * 100}%` }}
                    />
                  </span>
                  <span className="text-right font-medium tabular-nums text-mkt-paper">{t.pct}%</span>
                </li>
              ))}
            </ul>
            <figcaption className="mt-3 text-sm text-mkt-ash">
              Median views on the last five uploads as a share of subscribers, by channel size. 121,583 channels,
              November 2026.
            </figcaption>
          </figure>
        </section>

        {/* Browse: real lists with real counts. */}
        <section className="border-t border-mkt-manila/15">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-6 md:grid-cols-2">
            <div>
              <h2 className="mkt-h3 font-poster">Lists by country</h2>
              <ul className="mt-4 columns-2 gap-6 space-y-2 text-[0.95rem]">
                {countries.map((c) => {
                  const co = countryByCode(c.code)!;
                  return (
                    <li key={c.code} className="break-inside-avoid">
                      <Link href={countryPath(co.slug)} className="text-mkt-paper hover:underline">
                        {co.name.replace(/^the /, "")}
                      </Link>{" "}
                      <span className="tabular-nums text-mkt-ash">{nf(c.count)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <h2 className="mkt-h3 font-poster">Lists by niche</h2>
              <ul className="mt-4 columns-2 gap-6 space-y-2 text-[0.95rem]">
                {niches.map(([n, count]) => (
                  <li key={n} className="break-inside-avoid">
                    <Link href={listPath(n as any)} className="text-mkt-paper hover:underline">
                      {nicheName(n as any)}
                    </Link>{" "}
                    <span className="tabular-nums text-mkt-ash">{nf(count)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Free resources. */}
        <section className="border-t border-mkt-manila/15">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-6 md:grid-cols-2">
            <div>
              <h2 className="mkt-h3 font-poster">Free calculators</h2>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link href="/tools/youtube-engagement-rate-calculator" className="font-medium text-mkt-paper hover:underline">
                    Engagement rate calculator
                  </Link>
                  <p className="text-sm text-mkt-ash">Compare a channel with others of the same size.</p>
                </li>
                <li>
                  <Link href="/tools/youtube-sponsorship-calculator" className="font-medium text-mkt-paper hover:underline">
                    Sponsorship price calculator
                  </Link>
                  <p className="text-sm text-mkt-ash">A starting price from recent views, niche and format.</p>
                </li>
              </ul>
            </div>
            <div>
              <h2 className="mkt-h3 font-poster">From the data</h2>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link href="/blog/youtube-engagement-rate-benchmarks" className="font-medium text-mkt-paper hover:underline">
                    Engagement rate benchmarks by niche and channel size
                  </Link>
                </li>
                <li>
                  <Link href="/blog/how-to-vet-a-youtube-creator" className="font-medium text-mkt-paper hover:underline">
                    How to vet a YouTube creator before a sponsorship
                  </Link>
                </li>
                <li>
                  <Link href="/blog/youtube-subscribers-vs-views" className="font-medium text-mkt-paper hover:underline">
                    Subscriber count is a bad way to pick YouTubers
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter width="max-w-6xl" />
    </div>
  );
}
