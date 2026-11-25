import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/MarketingShell";
import { Prose } from "@/components/blog/Prose";
import { BRAND_NAME } from "@/lib/brand";
import { SITE_URL } from "@/lib/seo";
import { POSTS, postBySlug } from "@/content/blog";

type Params = { params: { slug: string } };

export const dynamicParams = false;
export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: Params): Metadata {
  const post = postBySlug(params.slug);
  if (!post) return {};
  const path = `/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: path },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${SITE_URL}${path}`,
      type: "article",
      publishedTime: post.published,
    },
  };
}

export default function BlogPostPage({ params }: Params) {
  const post = postBySlug(params.slug);
  if (!post) notFound();
  const others = POSTS.filter((p) => p.slug !== post.slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.published,
    author: { "@type": "Organization", name: BRAND_NAME },
    publisher: { "@type": "Organization", name: BRAND_NAME },
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
  };

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="font-mono text-xs uppercase tracking-wider text-mkt-ash">
        <Link href="/blog" className="hover:text-mkt-paper">Blog</Link>
      </nav>
      <h1 className="mkt-h2 mt-4 max-w-3xl !text-4xl">{post.title}</h1>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-mkt-ash">
        {new Date(post.published).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </p>

      <article className="mt-8">
        <Prose>{post.body()}</Prose>
      </article>

      <div className="mkt-card mt-12 max-w-2xl p-6">
        <p className="mkt-h3 !text-xl">Find creators who pass these checks</p>
        <p className="mkt-body mt-2 !text-sm">
          Ranked lists of active YouTube creators in the US, UK and Europe, filtered for recent views and real
          engagement.
        </p>
        <Link href="/youtubers" className="mkt-btn-primary mt-5 inline-flex">
          Browse creator lists — free
        </Link>
      </div>

      {others.length > 0 && (
        <section className="mt-12 max-w-2xl">
          <h2 className="font-mono text-xs uppercase tracking-wider text-mkt-ash">More from the blog</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {others.map((p) => (
              <li key={p.slug}>
                <Link href={`/blog/${p.slug}`} className="mkt-link">{p.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </MarketingShell>
  );
}
