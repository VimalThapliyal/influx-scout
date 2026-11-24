import Link from "next/link";
import {
  RecommendedCreatorsGrid,
  RecentCreatorsGrid,
} from "@/components/DashboardCreatorGrids";
import { BRAND_NAME } from "@/lib/brand";
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

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-mkt-tally">Home</p>
        <h1 className="page-title mt-1">Welcome back</h1>
        <p className="page-subtitle">
          Your {BRAND_NAME} hub — browse your YouTube library, run outreach, and track replies by
          list.
        </p>
      </div>

      <div className="card overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <h2 className="text-xl font-semibold text-white sm:text-2xl">
              Start with outreach-ready creators
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {stats.withEmail.toLocaleString()} creators with email in your database
              {stats.inTargetMarket > 0
                ? ` · ${stats.inTargetMarket.toLocaleString()} in ${TARGET_MARKET_LABEL}`
                : ""}
              .
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={OUTREACH_LIBRARY_HREF} className="btn-primary inline-flex gap-2">
                Browse with email filter →
              </Link>
              <Link href="/campaigns" className="btn-secondary inline-flex gap-2">
                View campaigns
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 lg:w-72">
            <MiniStat label="With email" value={stats.withEmail} accent="text-emerald-400" />
            <MiniStat label="In database" value={stats.total} accent="text-mkt-tally" />
            <MiniStat label="Lists" value={pipeline.listCount} accent="text-slate-300" />
          </div>
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="section-title">Campaign pipeline</h2>
            <p className="mt-1 text-sm text-slate-500">
              {pipeline.creatorCount > 0
                ? `${pipeline.creatorCount} creators across your lists`
                : "Add creators to a list to track outreach"}
            </p>
          </div>
          <Link href="/campaigns" className="text-link text-sm">
            Manage lists →
          </Link>
        </div>

        {pipeline.creatorCount === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-500">
            {user ? (
              <>
                No creators in campaign lists yet.{" "}
                <Link href={OUTREACH_LIBRARY_HREF} className="text-link">
                  Pick creators with email
                </Link>
                , then add them to a list.
              </>
            ) : (
              <>
                <Link href={`/login?redirect=${encodeURIComponent("/campaigns")}`} className="text-link">
                  Sign in
                </Link>{" "}
                to create campaign lists and track outreach.
              </>
            )}
          </p>
        ) : (
          <div className="flex flex-wrap gap-4 px-6 py-4">
            <PipelinePill label="Identified" value={pipeline.identified} color="text-slate-400" />
            <PipelinePill label="Contacted" value={pipeline.contacted} color="text-mkt-tally" />
            <PipelinePill label="Negotiating" value={pipeline.negotiating} color="text-amber-300" />
            <PipelinePill label="Contracted" value={pipeline.contracted} color="text-emerald-300" />
            <PipelinePill label="Replied" value={pipeline.replied} color="text-cyan-300" />
          </div>
        )}
      </section>

      <section className="card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="section-title">Recommended for outreach</h2>
            <p className="mt-1 text-sm text-slate-500">
              Top scores with email · {TARGET_MARKET_LABEL}
            </p>
          </div>
          <Link href={OUTREACH_LIBRARY_HREF} className="text-link text-sm shrink-0">
            View all →
          </Link>
        </div>

        {recommended.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">
            No outreach-ready creators yet.{" "}
            <Link href="/channels" className="text-link">Browse your database</Link>
          </p>
        ) : (
          <RecommendedCreatorsGrid channels={recommended} />
        )}
      </section>

      <section className="card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="section-title">Recently added</h2>
            <p className="mt-1 text-sm text-slate-500">Newest creators in your database</p>
          </div>
          <Link href="/channels" className="text-link text-sm shrink-0">
            View library →
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">
            Your database is growing nightly. Check back soon.
          </p>
        ) : (
          <RecentCreatorsGrid channels={recent} />
        )}
      </section>
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center">
      <p className={`text-lg font-semibold ${accent}`}>{value.toLocaleString()}</p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
    </div>
  );
}

function PipelinePill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex min-w-[5.5rem] flex-col rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <span className={`text-xl font-semibold ${color}`}>{value}</span>
      <span className="mt-0.5 text-xs text-slate-500">{label}</span>
    </div>
  );
}
