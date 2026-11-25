import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/MarketingShell";
import { BRAND_NAME } from "@/lib/brand";
import {
  COMPARISONS,
  COMPARISONS_LAST_CHECKED,
  INFLUX_ROW,
  INFLUX_STRENGTHS,
  comparisonBySlug,
} from "@/lib/comparisons";

export const dynamicParams = false;
export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

type Params = { params: { slug: string } };

export function generateMetadata({ params }: Params): Metadata {
  const c = comparisonBySlug(params.slug);
  if (!c) return {};
  const title = `${c.name} Alternative for YouTube Influencers — ${BRAND_NAME}`;
  const description =
    `Looking for a ${c.name} alternative focused on YouTube? Compare ${BRAND_NAME} and ${c.name} on ` +
    `platforms, pricing, data quality and contact info for USA & Europe creators.`;
  return { title, description, alternates: { canonical: `/compare/${c.slug}` } };
}

export default function ComparePage({ params }: Params) {
  const c = comparisonBySlug(params.slug);
  if (!c) notFound();

  const rows: [string, string, string][] = [
    ["Platforms", INFLUX_ROW.platforms, c.platforms],
    ["Pricing", INFLUX_ROW.pricing, c.pricing],
    ["Free plan", INFLUX_ROW.freePlan, c.freePlan],
    ["Audience demographics", INFLUX_ROW.audienceData, c.audienceData],
  ];

  const faq = [
    {
      q: `Is ${BRAND_NAME} a good ${c.name} alternative?`,
      a: `If you mainly work with YouTube creators in the USA and Europe, yes: ${BRAND_NAME} only lists active creators that pass a quality check and shows their public business contacts. If you need Instagram/TikTok or audience demographics, ${c.name} is the better fit.`,
    },
    {
      q: `How much does ${c.name} cost?`,
      a: `${c.pricing} (as of ${COMPARISONS_LAST_CHECKED}). Pricing changes, so check ${c.name}'s pricing page for current plans.`,
    },
    {
      q: `How much does ${BRAND_NAME} cost?`,
      a: `${BRAND_NAME} is free during early access.`,
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
        <Link href="/compare" className="hover:text-fg">Compare</Link> / <span>{c.name}</span>
      </nav>
      <h1 className="h-page mt-4">The YouTube-focused {c.name} alternative</h1>
      <p className="text-body mt-3 max-w-2xl">
        {c.name} is {c.tagline}. {BRAND_NAME} does one thing: helps brands find active YouTube creators in the
        USA and Europe and reach them. Here&apos;s an honest comparison.
      </p>

      <div className="card mt-8 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="px-4 py-3" />
              <th className="px-4 py-3 text-accent">{BRAND_NAME}</th>
              <th className="px-4 py-3">{c.name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, ours, theirs]) => (
              <tr key={label} className="border-t border-line align-top">
                <td className="px-4 py-3 text-xs text-muted">{label}</td>
                <td className="px-4 py-3 text-fg">{ours}</td>
                <td className="px-4 py-3 text-fg">{theirs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        {c.name} details from public sources, last checked {COMPARISONS_LAST_CHECKED}. See{" "}
        <a href={c.pricingUrl} rel="nofollow noopener noreferrer" target="_blank" className="text-link">
          {c.name}&apos;s pricing
        </a>{" "}
        for current plans.
      </p>

      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="h-section">Choose {BRAND_NAME} if…</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            {INFLUX_STRENGTHS.map((s) => (
              <li key={s} className="flex gap-2"><span className="text-success">✓</span>{s}</li>
            ))}
          </ul>
        </div>
        <div className="card p-6">
          <h2 className="h-section">Choose {c.name} if…</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            {c.chooseThemIf.map((s) => (
              <li key={s} className="flex gap-2"><span className="text-muted"></span>{s}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">{c.name} strengths: {c.strengths.join("; ")}.</p>
        </div>
      </section>

      <div className="card mt-10 p-6 text-center">
        <p className="h-section">Try {BRAND_NAME} free</p>
        <p className="text-body mx-auto mt-2 max-w-md !text-sm">
          Browse ranked lists of active YouTube creators — no credit card.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/youtubers" className="btn-primary inline-flex">Browse creator lists</Link>
          <Link href="/login" className="btn-secondary inline-flex">Sign up free</Link>
        </div>
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
        Other comparisons:{" "}
        {COMPARISONS.filter((o) => o.slug !== c.slug).map((o, i, arr) => (
          <span key={o.slug}>
            <Link href={`/compare/${o.slug}`} className="text-link">{o.name} alternative</Link>
            {i < arr.length - 1 ? " · " : ""}
          </span>
        ))}
      </p>
    </MarketingShell>
  );
}
