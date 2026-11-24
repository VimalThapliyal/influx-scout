import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";

export const metadata: Metadata = {
  title: "Free YouTube Influencer Marketing Tools",
  description:
    "Free calculators for YouTube influencer marketing: engagement rate with benchmarks by channel size, and sponsorship price estimates.",
  alternates: { canonical: "/tools" },
};

const TOOLS = [
  {
    href: "/tools/youtube-engagement-rate-calculator",
    title: "YouTube Engagement Rate Calculator",
    desc: "Engagement rate from views, likes and comments — compared with creators of the same size.",
  },
  {
    href: "/tools/youtube-sponsorship-calculator",
    title: "YouTube Sponsorship Price Calculator",
    desc: "Estimate what to pay for an integration, dedicated video or Short from average views and niche.",
  },
];

export default function ToolsPage() {
  return (
    <MarketingShell>
      <p className="mkt-eyebrow">Free tools</p>
      <h1 className="mkt-h2 mt-3 !text-4xl">Free YouTube influencer marketing tools</h1>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className="mkt-card block p-6 hover:border-mkt-tally/50">
            <h2 className="mkt-h3 !text-lg">{t.title}</h2>
            <p className="mkt-body mt-2 !text-sm">{t.desc}</p>
            <span className="mt-4 inline-block font-mono text-xs uppercase tracking-wider text-mkt-tally">Open →</span>
          </Link>
        ))}
      </div>
    </MarketingShell>
  );
}
