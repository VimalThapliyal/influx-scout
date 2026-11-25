import Link from "next/link";
import {
  RecommendedCreatorsGrid,
  RecentCreatorsGrid,
} from "@/components/DashboardCreatorGrids";
import { getSessionUser } from "@/lib/auth";
import {
  getLibraryStats,
  getPipelineStats,
  getRecentCreators,
  getRecommendedCreators,
  TARGET_MARKET_LABEL,
} from "@/lib/dashboard";
import { OUTREACH_LIBRARY_HREF } from "@/lib/routes";

export default async function OverviewPage() {
  const user = await getSessionUser();
  const [stats, pipeline, recommended, recent] = await Promise.all([
    getLibraryStats(),
    getPipelineStats(user?.id ?? null),
    getRecommendedCreators(),
    getRecentCreators(),
  ]);

  const stages = [
    { label: "Identified", value: pipeline.identified },
    { label: "Contacted", value: pipeline.contacted },
    { label: "Replied", value: pipeline.replied },
    { label: "Negotiating", value: pipeline.negotiating },
    { label: "Contracted", value: pipeline.contracted },
  ];
  const summary = [
    { label: "Creators with a public email", value: stats.withEmail },
    { label: `In ${TARGET_MARKET_LABEL}`, value: stats.inTargetMarket },
    { label: "Your campaign lists", value: pipeline.listCount },
    { label: "Creators in your lists", value: pipeline.creatorCount },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h-page">Home</h1>
          <p className="page-subtitle">
            {user ? "Your outreach at a glance." : "Browse creators freely. Sign in to save lists and track outreach."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/campaigns" className="btn-secondary">
            Campaigns
          </Link>
          <Link href={OUTREACH_LIBRARY_HREF} className="btn-primary">
            Find creators
          </Link>
        </div>
      </div>

      <dl className="card grid grid-cols-2 divide-line lg:grid-cols-4 lg:divide-x">
        {summary.map((m, i) => (
          <div key={m.label} className={`px-4 py-3.5 ${i < 2 ? "border-b border-line lg:border-b-0" : ""} ${i % 2 === 0 ? "border-r border-line lg:border-r-0" : ""}`}>
            <dt className="text-xs text-muted">{m.label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums tracking-[-0.01em] text-fg">
              {m.value.toLocaleString()}
            </dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="pipeline-title">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="pipeline-title" className="h-section">Outreach pipeline</h2>
          <Link href="/campaigns" className="text-link text-[0.8125rem]">
            Manage lists
          </Link>
        </div>
        {pipeline.creatorCount === 0 ? (
          <p className="card px-4 py-5 text-sm text-muted">
            {user ? (
              <>
                You haven&apos;t added anyone to a list yet.{" "}
                <Link href={OUTREACH_LIBRARY_HREF} className="text-link">
                  Find creators
                </Link>{" "}
                and use the bookmark button to add them.
              </>
            ) : (
              <>
                <Link href={`/login?redirect=${encodeURIComponent("/campaigns")}`} className="text-link">
                  Sign in
                </Link>{" "}
                to create campaign lists and track who you contacted.
              </>
            )}
          </p>
        ) : (
          <ol className="card grid grid-cols-2 sm:grid-cols-5 sm:divide-x sm:divide-line">
            {stages.map((st) => (
              <li key={st.label} className="px-4 py-3.5">
                <p className="text-xs text-muted">{st.label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-fg">{st.value.toLocaleString()}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="recommended-title">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div>
            <h2 id="recommended-title" className="h-section">Highest scoring creators with an email</h2>
          </div>
          <Link href={OUTREACH_LIBRARY_HREF} className="text-link shrink-0 text-[0.8125rem]">
            View all
          </Link>
        </div>
        {recommended.length === 0 ? (
          <p className="card px-4 py-5 text-sm text-muted">
            No creators with a public email match yet.{" "}
            <Link href="/channels" className="text-link">Browse all creators</Link>
          </p>
        ) : (
          <RecommendedCreatorsGrid channels={recommended} />
        )}
      </section>

      <section aria-labelledby="recent-title">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="recent-title" className="h-section">Recently added</h2>
          <Link href="/channels" className="text-link shrink-0 text-[0.8125rem]">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="card px-4 py-5 text-sm text-muted">New creators are added every day. Check back soon.</p>
        ) : (
          <RecentCreatorsGrid channels={recent} />
        )}
      </section>
    </div>
  );
}
