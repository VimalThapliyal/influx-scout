"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { formatNumber } from "@/components/ui";
import { EmptyState, LoadingSpinner } from "@/components/ui";
import { OUTREACH_LIBRARY_HREF } from "@/lib/routes";

interface CampaignListInsight {
  id: string;
  name: string;
  total: number;
  identified: number;
  contacted: number;
  negotiating: number;
  contracted: number;
  replied: number;
  reply_rate: number;
  contact_rate: number;
}

interface CampaignInsightsSummary {
  list_count: number;
  total_creators: number;
  identified: number;
  contacted: number;
  negotiating: number;
  contracted: number;
  replied: number;
  reply_rate: number;
  contact_rate: number;
}

interface PlatformInsights {
  quota: { used: number; limit: number; remaining: number; percent_used: number };
  channels: number;
  withEmail: number;
  emailRate: number;
}

export default function AnalyticsPage() {
  const [campaign, setCampaign] = useState<{
    requiresAuth: boolean;
    summary: CampaignInsightsSummary | null;
    lists: CampaignListInsight[];
  } | null>(null);
  const [platform, setPlatform] = useState<PlatformInsights | null>(null);
  const [showPlatform, setShowPlatform] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [campRes, platRes] = await Promise.all([
          fetch("/api/insights/campaigns"),
          fetch("/api/insights/platform"),
        ]);
        if (campRes.ok) setCampaign(await campRes.json());
        if (platRes.ok) setPlatform(await platRes.json());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <LoadingSpinner />
    );
  }

  const summary = campaign?.summary;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="h-page">Insights</h1>
        <p className="page-subtitle">How many creators you contacted, how many replied, and where each list stands.</p>
      </div>

      {campaign?.requiresAuth ? (
        <EmptyState
          title="Sign in to see your outreach results"
          description="Insights are built from your own campaign lists."
          action={
            <Link href={`/login?redirect=${encodeURIComponent("/analytics")}`} className="btn-primary btn-sm">
              Sign in
            </Link>
          }
        />
      ) : !summary || summary.total_creators === 0 ? (
        <EmptyState
          title="Nothing to report yet"
          description="Add creators to a campaign list and mark who you contacted. Reply rates show up here."
          action={
            <Link href={OUTREACH_LIBRARY_HREF} className="btn-secondary btn-sm">
              Find creators
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Creators in lists"
              value={String(summary.total_creators)}
              sub={`${summary.list_count} campaign list${summary.list_count === 1 ? "" : "s"}`}
            />
            <MetricCard
              label="Contacted"
              value={String(summary.contacted)}
              sub={`${summary.contact_rate}% of list`}
              bar={summary.contact_rate}
              accent="bg-accent"
            />
            <MetricCard
              label="Replied"
              value={String(summary.replied)}
              sub={`${summary.reply_rate}% reply rate`}
              bar={summary.reply_rate}
              accent="bg-cyan-500"
            />
            <MetricCard
              label="In pipeline"
              value={String(summary.negotiating + summary.contracted)}
              sub={`${summary.negotiating} negotiating · ${summary.contracted} contracted`}
            />
          </div>

          <section className="card overflow-hidden">
            <div className="border-b border-line px-6 py-4">
              <h2 className="h-section">By campaign list</h2>
              <p className="mt-1 text-sm text-muted">
                Contact and reply rates per list — click a row to manage outreach.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="px-6 py-3 text-left">List</th>
                    <th className="px-4 py-3 text-right">Creators</th>
                    <th className="px-4 py-3 text-right">Contacted</th>
                    <th className="px-4 py-3 text-right">Replied</th>
                    <th className="px-4 py-3 text-right">Reply rate</th>
                    <th className="px-4 py-3 text-right">Pipeline</th>
                  </tr>
                </thead>
                <tbody>
                  {campaign?.lists.map((list) => (
                    <tr key={list.id} className="table-row">
                      <td className="px-6 py-4">
                        <Link href="/campaigns" className="font-medium text-fg hover:text-accent">
                          {list.name}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-right text-fg">{list.total}</td>
                      <td className="px-4 py-4 text-right text-accent">
                        {list.contacted}
                        <span className="ml-1 text-xs text-muted">({list.contact_rate}%)</span>
                      </td>
                      <td className="px-4 py-4 text-right text-cyan-300">{list.replied}</td>
                      <td className="px-4 py-4 text-right font-medium text-fg">
                        {list.reply_rate}%
                      </td>
                      <td className="px-4 py-4 text-right text-muted">
                        {list.negotiating > 0 && `${list.negotiating} neg`}
                        {list.negotiating > 0 && list.contracted > 0 && " · "}
                        {list.contracted > 0 && `${list.contracted} won`}
                        {list.negotiating === 0 && list.contracted === 0 && "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="h-section">Pipeline breakdown</h2>
            <div className="mt-4 flex flex-wrap gap-4">
              <PipelinePill label="Identified" value={summary.identified} color="text-muted" />
              <PipelinePill label="Contacted" value={summary.contacted} color="text-accent" />
              <PipelinePill label="Negotiating" value={summary.negotiating} color="text-warn" />
              <PipelinePill label="Contracted" value={summary.contracted} color="text-success" />
              <PipelinePill label="Replied" value={summary.replied} color="text-cyan-300" />
            </div>
          </section>
        </>
      )}

      <section className="card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowPlatform((v) => !v)}
          className="flex w-full items-center justify-between px-6 py-4 text-left transition hover:bg-subtle"
          aria-expanded={showPlatform}
        >
          <div>
            <h2 className="text-sm font-medium text-fg">Library size and data refresh</h2>
            <p className="mt-0.5 text-xs text-muted">How many creators are in Influx and how much was updated today.</p>
          </div>
          <ChevronDown size={16} strokeWidth={1.75} aria-hidden className={`text-muted transition-transform ${showPlatform ? "rotate-180" : ""}`} />
        </button>

        {showPlatform && platform && (
          <div className="space-y-6 border-t border-line px-6 py-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <MetricCard
                label="API quota used"
                value={`${platform.quota.percent_used}%`}
                sub={`${formatNumber(platform.quota.used)} / ${formatNumber(platform.quota.limit)} units`}
                bar={platform.quota.percent_used}
                accent="bg-warn"
              />
              <MetricCard
                label="Creators in database"
                value={String(platform.channels)}
                sub="Total scraped profiles"
              />
              <MetricCard
                label="Email coverage"
                value={`${platform.emailRate}%`}
                sub={`${platform.withEmail} with email`}
                bar={platform.emailRate}
                accent="bg-success"
              />
            </div>

            <div>
              <h3 className="text-sm font-medium text-fg">Quota notes</h3>
              <p className="mt-2 text-xs text-muted">
                Your enriched library grows nightly via the automated pipeline. Resets at
                midnight Pacific.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  bar,
  accent = "bg-accent",
}: {
  label: string;
  value: string;
  sub: string;
  bar?: number;
  accent?: string;
}) {
  return (
    <div className="card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-fg">{value}</p>
      <p className="mt-1 text-xs text-muted">{sub}</p>
      {bar !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-subtle">
          <div
            className={`h-full rounded-full transition-all ${accent}`}
            style={{ width: `${Math.min(bar, 100)}%` }}
          />
        </div>
      )}
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
    <div className="min-w-[5.5rem] rounded-lg border border-line bg-subtle px-4 py-3">
      <span className={`text-xl font-semibold ${color}`}>{value}</span>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}
