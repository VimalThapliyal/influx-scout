"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatNumber } from "@/components/ui";
import type { AdminOpsSnapshot } from "@/lib/admin-ops";

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "Just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return minutes <= 1 ? "Just now" : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="card p-5">
      <p className="metric-label">{label}</p>
      <p
        className={`metric-value mt-1 ${accent ? "text-warn" : "text-fg"}`}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-2.5 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-medium tabular-nums text-fg">
        {formatNumber(value)}
      </span>
    </div>
  );
}

export default function AdminOpsPage() {
  const [data, setData] = useState<AdminOpsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [newWorkerName, setNewWorkerName] = useState("");
  const [creatingWorker, setCreatingWorker] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<{ name: string; key: string } | null>(
    null
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ops", { cache: "no-store" });
      setStatus(res.status);
      const body = await res.json();
      if (!res.ok) {
        setData(null);
        setError(body.error ?? "Failed to load");
        return;
      }
      setData(body as AdminOpsSnapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createWorker = useCallback(async () => {
    const name = newWorkerName.trim();
    if (!name) return;
    setCreatingWorker(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json();
      if (!res.ok) {
        setCreateError(body.error ?? "Failed to create worker key");
        return;
      }
      setCreatedKey({ name, key: body.key });
      setNewWorkerName("");
      load();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create worker key");
    } finally {
      setCreatingWorker(false);
    }
  }, [newWorkerName, load]);

  if (loading && !data) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-violet-500" />
      </div>
    );
  }

  if (status === 401) {
    return (
      <div className="card space-y-4 p-8 text-center">
        <h1 className="h-page">Admin ops</h1>
        <p className="text-muted">Sign in to view the crawler dashboard.</p>
        <Link href="/login?redirect=/admin" className="btn-primary inline-flex">
          Sign in
        </Link>
      </div>
    );
  }

  if (status === 403) {
    return (
      <div className="card space-y-3 p-8 text-center">
        <h1 className="h-page">Admin ops</h1>
        <p className="text-muted">
          Your account is not on the admin allowlist.
        </p>
        <p className="text-sm text-muted">
          Add your email to{" "}
          <code className="text-fg">ADMIN_EMAILS</code> in env (local +
          Vercel), then redeploy.
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card space-y-4 p-8 text-center">
        <h1 className="h-page">Admin ops</h1>
        <p className="text-rose-400">{error ?? "No data"}</p>
        <button type="button" onClick={load} className="btn-secondary">
          Retry
        </button>
      </div>
    );
  }

  const { library, seeds, pending, workers, recent_failures, robots_blocked_sample, quota } =
    data;
  const emailRate =
    library.channels > 0
      ? Math.round((library.with_email / library.channels) * 100)
      : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-violet-400">
            Operations
          </p>
          <h1 className="h-page mt-1">Crawler & pipeline</h1>
          <p className="page-subtitle">
            Pending queue, seeds, enrich failures, robots blocks, and expired
            YouTube metrics.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="btn-secondary shrink-0"
        >
          {loading ? "Refreshing" : "Refresh"}
        </button>
      </div>

      <p className="text-xs text-muted">
        Snapshot {formatRelative(data.generated_at)}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Channels"
          value={formatNumber(library.channels)}
          sub={`${emailRate}% with email · ${formatNumber(library.with_contact_form)} contact forms`}
        />
        <MetricCard
          label="Metrics expired"
          value={formatNumber(library.metrics_expired)}
          sub={`${formatNumber(library.metrics_unknown)} never stamped`}
          accent={library.metrics_expired > 0}
        />
        <MetricCard
          label="Robots blocked"
          value={formatNumber(library.robots_disallowed)}
          sub={`${formatNumber(library.robots_checked)} sites checked`}
          accent={library.robots_disallowed > 0}
        />
        <MetricCard
          label="Pending enrich"
          value={formatNumber(pending.unclaimed + pending.claimed)}
          sub={`${formatNumber(pending.unclaimed)} free · ${formatNumber(pending.claimed)} claimed`}
          accent={pending.unclaimed + pending.claimed > 0}
        />
      </div>

      {quota ? (
        <section className="card p-5">
          <h2 className="h-section">YouTube API quota</h2>
          <div className="mt-3 flex flex-wrap items-end gap-6">
            <div>
              <p className="metric-label">Used today</p>
              <p className="metric-value text-fg">
                {formatNumber(quota.used)}
                <span className="text-base font-normal text-muted">
                  {" "}
                  / {formatNumber(quota.limit)}
                </span>
              </p>
            </div>
            <div className="min-w-[12rem] flex-1">
              <div className="h-2 overflow-hidden rounded-full bg-subtle">
                <div
                  className={`h-full rounded-full ${
                    quota.percent_used > 80
                      ? "bg-rose-500"
                      : quota.percent_used > 50
                        ? "bg-warn"
                        : "bg-success"
                  }`}
                  style={{ width: `${Math.min(100, quota.percent_used)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {quota.percent_used}% · {formatNumber(quota.remaining)} remaining
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5">
          <h2 className="h-section">Seed URLs</h2>
          <div className="mt-2">
            <StatusRow label="Available" value={seeds.available} />
            <StatusRow label="Claimed" value={seeds.claimed} />
            <StatusRow label="Done" value={seeds.done} />
            <StatusRow label="Failed" value={seeds.failed} />
          </div>
        </section>

        <section className="card p-5">
          <h2 className="h-section">Channel pending</h2>
          <div className="mt-2">
            <StatusRow label="Unclaimed" value={pending.unclaimed} />
            <StatusRow label="Claimed (in flight)" value={pending.claimed} />
            <StatusRow label="Enriched" value={pending.enriched} />
            <StatusRow label="Rejected" value={pending.rejected} />
            <StatusRow label="Failed" value={pending.failed} />
          </div>
        </section>

        <section className="card p-5">
          <h2 className="h-section">Email status</h2>
          <div className="mt-2">
            <StatusRow label="Found" value={library.email_found} />
            <StatusRow label="Locked on source" value={library.email_locked} />
            <StatusRow label="Not available" value={library.email_not_available} />
            <StatusRow label="Raw email column set" value={library.with_email} />
          </div>
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="h-section">Workers</h2>
          <p className="mt-1 text-sm text-muted">
            Contributor keys and submit activity
          </p>
        </div>

        <div className="border-b border-line px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newWorkerName}
              onChange={(e) => setNewWorkerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createWorker();
              }}
              placeholder="Contributor name (e.g. alice)"
              className="min-w-0 flex-1 rounded-lg border border-line bg-subtle px-3 py-2 text-sm text-fg placeholder:text-muted focus:border-violet-500 focus:outline-none"
            />
            <button
              onClick={createWorker}
              disabled={creatingWorker || !newWorkerName.trim()}
              className="btn-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingWorker ? "Creating" : "Create worker key"}
            </button>
          </div>
          {createError ? (
            <p className="mt-2 text-sm text-danger">{createError}</p>
          ) : null}
          {createdKey ? (
            <div className="mt-3 rounded-lg border border-success/30 bg-success-soft p-3">
              <p className="text-sm text-success">
                Key for <span className="font-medium">{createdKey.name}</span> —
                shown once, copy it now:
              </p>
              <code className="mt-1 block break-all text-sm text-fg">
                {createdKey.key}
              </code>
            </div>
          ) : null}
        </div>

        {workers.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">
            No scrape workers yet — create one above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="table-head">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Submitted</th>
                  <th className="px-5 py-3 font-medium">Accepted</th>
                  <th className="px-5 py-3 font-medium">Last submit</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w.id} className="table-row">
                    <td className="px-5 py-3 text-fg">{w.name}</td>
                    <td className="px-5 py-3">
                      <span
                        className={
                          w.active
                            ? "text-success"
                            : "text-muted"
                        }
                      >
                        {w.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3 tabular-nums text-fg">
                      {formatNumber(w.channels_submitted)}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-fg">
                      {formatNumber(w.channels_accepted)}
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {formatRelative(w.last_submit_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="h-section">Recent enrich failures</h2>
          </div>
          {recent_failures.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">
              No failed pending rows.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {recent_failures.map((row) => (
                <li key={row.id} className="px-5 py-3">
                  <p className="text-sm text-fg">
                    {row.handle || row.title || row.id.slice(0, 8)}
                  </p>
                  {row.handle && row.title && row.title !== row.handle ? (
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {row.title}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-rose-400/90">
                    {row.reject_reason || "failed"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatRelative(row.updated_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="h-section">Robots-disallowed sample</h2>
          </div>
          {robots_blocked_sample.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">
              No robots-blocked websites recorded.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {robots_blocked_sample.map((row) => (
                <li key={row.id} className="px-5 py-3">
                  <Link
                    href={`/channels/${row.id}`}
                    className="text-sm text-violet-300 hover:text-violet-200"
                  >
                    {row.title}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {row.website || "No website URL"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Checked {formatRelative(row.website_robots_checked_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
