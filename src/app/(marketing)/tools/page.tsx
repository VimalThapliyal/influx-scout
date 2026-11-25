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
      <h1 className="h-page">Free YouTube influencer marketing tools</h1>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className="card block p-6 hover:border-accent/50">
            <h2 className="h-section">{t.title}</h2>
            <p className="text-body mt-2 !text-sm">{t.desc}</p>
            <span className="mt-4 inline-block text-xs text-accent">Open</span>
          </Link>
        ))}
      </div>
    </MarketingShell>
  );
}
