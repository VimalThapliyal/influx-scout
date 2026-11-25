import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { POSTS } from "@/content/blog";

export const metadata: Metadata = {
  title: "YouTube Influencer Marketing Data & Guides",
  description:
    "Data-backed guides for brands working with YouTube creators: engagement benchmarks, views versus subscribers, and how to vet creators.",
  alternates: { canonical: "/blog" },
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

export default function BlogIndexPage() {
  return (
    <MarketingShell>
      <p className="mkt-eyebrow">Blog</p>
      <h1 className="mkt-h2 mt-3 !text-4xl">YouTube influencer marketing, by the numbers</h1>
      <p className="mkt-body mt-3 max-w-2xl">
        Guides built on data from the 200,000+ YouTube channels Influx has scored.
      </p>
      <div className="mt-10 grid gap-6">
        {POSTS.map((p) => (
          <Link key={p.slug} href={`/blog/${p.slug}`} className="mkt-card block p-6 hover:border-mkt-tally/50">
            <p className="font-mono text-[11px] uppercase tracking-wider text-mkt-ash">{fmt(p.published)}</p>
            <h2 className="mkt-h3 mt-2 !text-xl">{p.title}</h2>
            <p className="mkt-body mt-2 !text-sm">{p.description}</p>
          </Link>
        ))}
      </div>
    </MarketingShell>
  );
}
