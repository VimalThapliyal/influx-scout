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
      <h1 className="h-page">YouTube influencer marketing, by the numbers</h1>
      <p className="text-body mt-3 max-w-2xl">
        Guides built on data from the 200,000+ YouTube channels Influx has scored.
      </p>
      <div className="mt-10 grid gap-6">
        {POSTS.map((p) => (
          <Link key={p.slug} href={`/blog/${p.slug}`} className="card block p-6 hover:border-accent/50">
            <p className="text-xs text-muted">{fmt(p.published)}</p>
            <h2 className="h-section mt-2">{p.title}</h2>
            <p className="text-body mt-2 !text-sm">{p.description}</p>
          </Link>
        ))}
      </div>
    </MarketingShell>
  );
}
