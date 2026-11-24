"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Channel } from "@/lib/types";
import {
  FilterBar,
  ViewToggle,
  defaultFilters,
  subscriberRangeToMinMax,
  avgViewsToMin,
  uploadedWithinToDays,
  type SearchFilters,
  type UploadedWithinFilter,
  type SubscriberRange,
  type AvgViewsFilter,
  type MarketFilter,
  type ContactFilter,
} from "@/components/FilterBar";
import {
  CreatorGridCard,
  CreatorListRow,
  LoadingSpinner,
  EmptyState,
} from "@/components/ui";
import { SaveToCampaignModal } from "@/components/SaveToCampaignModal";
import { EmailOutreachModal } from "@/components/EmailOutreachModal";
import { EmailLockedBanner } from "@/components/EmailGate";
import { DATA_SOURCE } from "@/lib/data-sources";

const PAGE_SIZE = 24;

export type LibrarySort = "recent" | "score";

function parseUploadedWithin(v: string | null): UploadedWithinFilter {
  if (v === "7" || v === "30" || v === "45" || v === "90") return v;
  return "all";
}

function filtersFromSearchParams(params: URLSearchParams): SearchFilters {
  const filters = { ...defaultFilters };
  const subs = params.get("subscribers") as SubscriberRange | null;
  if (subs && ["nano", "micro", "mid", "macro", "mega"].includes(subs)) {
    filters.subscriberRange = subs;
  }
  const views = params.get("avg_views") as AvgViewsFilter | null;
  if (views && ["1k", "10k", "100k"].includes(views)) {
    filters.avgViews = views;
  }
  const market = params.get("market") as MarketFilter | null;
  if (market === "worldwide" || market === "us-eu") filters.market = market;
  const country = params.get("country");
  if (country) filters.country = country;
  const niche = params.get("niche");
  if (niche) filters.niche = niche;
  if (params.get("has_email") === "true") filters.contact = "email";
  else if (params.get("has_contact_form") === "true") filters.contact = "form";
  else if (params.get("has_social") === "true") filters.contact = "social";
  else if (params.get("has_contact") === "true") filters.contact = "any";
  const contact = params.get("contact") as ContactFilter | null;
  if (contact && ["email", "social", "any", "all", "form"].includes(contact)) {
    filters.contact = contact;
  }
  filters.uploadedWithin = parseUploadedWithin(
    params.get("uploaded_within") ?? params.get("uploaded_within_days")
  );
  const quality = params.get("quality");
  if (quality === "all" || quality === "ready" || quality === "emerging" || quality === "inactive") {
    filters.quality = quality;
  }
  return filters;
}

function sortFromSearchParams(params: URLSearchParams): LibrarySort {
  return params.get("sort") === "score" ? "score" : "recent";
}

function pageFromSearchParams(params: URLSearchParams): number {
  const p = parseInt(params.get("page") ?? "1", 10);
  return Number.isFinite(p) && p > 0 ? p : 1;
}

function buildQueryParams(
  filters: SearchFilters,
  q: string,
  sort: LibrarySort,
  page: number
): URLSearchParams {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
  });
  if (sort === "recent") {
    params.set("sort", "created_at");
    params.set("order", "desc");
  } else {
    params.set("sort", "influencer_score");
    params.set("order", "desc");
  }
  if (q) params.set("q", q);
  const { min, max } = subscriberRangeToMinMax(filters.subscriberRange);
  if (min) params.set("min_subscribers", String(min));
  if (max) params.set("max_subscribers", String(max));
  const minViews = avgViewsToMin(filters.avgViews);
  if (minViews) params.set("min_avg_views", String(minViews));
  if (filters.country) params.set("country", filters.country);
  else if (filters.market === "us-eu") params.set("market", "us-eu");
  else if (filters.market === "worldwide") params.set("market", "worldwide");
  if (filters.niche) params.set("niche", filters.niche);
  if (filters.contact === "email") params.set("has_email", "true");
  if (filters.contact === "form") params.set("has_contact_form", "true");
  if (filters.contact === "social") params.set("has_social", "true");
  if (filters.contact === "any") params.set("has_contact", "true");
  const days = uploadedWithinToDays(filters.uploadedWithin);
  if (days) params.set("uploaded_within_days", String(days));
  if (filters.quality !== "all") params.set("quality", filters.quality);
  return params;
}

function buildShareParams(
  filters: SearchFilters,
  q: string,
  sort: LibrarySort,
  page: number
): URLSearchParams {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (sort !== "recent") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  if (filters.subscriberRange !== "all") params.set("subscribers", filters.subscriberRange);
  if (filters.avgViews !== "all") params.set("avg_views", filters.avgViews);
  if (filters.market !== "us-eu") params.set("market", filters.market);
  if (filters.country) params.set("country", filters.country);
  if (filters.niche) params.set("niche", filters.niche);
  if (filters.contact !== "all") params.set("contact", filters.contact);
  if (filters.uploadedWithin !== "all") params.set("uploaded_within", filters.uploadedWithin);
  params.set("quality", filters.quality);
  return params;
}

function LibrarySortToggle({
  value,
  onChange,
}: {
  value: LibrarySort;
  onChange: (sort: LibrarySort) => void;
}) {
  const options: { id: LibrarySort; label: string }[] = [
    { id: "recent", label: "Recently added" },
    { id: "score", label: "Top score" },
  ];

  return (
    <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            value === opt.id
              ? "bg-mkt-tally/20 text-mkt-tally"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function PaginationBar({
  page,
  total,
  pageSize,
  loading,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  loading: boolean;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
      <p className="text-xs text-slate-500">
        Showing {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={loading || page <= 1}
          onClick={() => onChange(page - 1)}
          className="btn-ghost min-h-[36px] px-3 text-xs disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-xs text-slate-400">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={loading || page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="btn-ghost min-h-[36px] px-3 text-xs disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function ChannelsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ChannelsPageContent />
    </Suspense>
  );
}

function ChannelsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [filters, setFilters] = useState<SearchFilters>(() =>
    filtersFromSearchParams(searchParams)
  );
  const [sort, setSort] = useState<LibrarySort>(() => sortFromSearchParams(searchParams));
  const [page, setPage] = useState(() => pageFromSearchParams(searchParams));
  const [view, setView] = useState<"grid" | "list">("grid");
  const [saveChannel, setSaveChannel] = useState<Channel | null>(null);
  const [outreachChannel, setOutreachChannel] = useState<Channel | null>(null);

  const syncUrl = useCallback(
    (next: {
      filters?: SearchFilters;
      q?: string;
      sort?: LibrarySort;
      page?: number;
    }) => {
      const params = buildShareParams(
        next.filters ?? filters,
        next.q ?? q,
        next.sort ?? sort,
        next.page ?? page
      );
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [filters, q, sort, page, pathname, router]
  );

  const loadChannels = useCallback(
    async (searchQuery = q, pageNum = page) => {
      setLoading(true);
      try {
        const params = buildQueryParams(filters, searchQuery, sort, pageNum);
        const res = await fetch(`/api/channels?${params}`);
        const data = await res.json();
        if (res.ok) {
          setChannels(data.channels ?? []);
          setTotal(data.total ?? 0);
        }
      } finally {
        setLoading(false);
      }
    },
    [filters, q, sort, page]
  );

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  function updateFilters(next: SearchFilters) {
    setFilters(next);
    setPage(1);
    syncUrl({ filters: next, page: 1 });
  }

  function updateSort(next: LibrarySort) {
    setSort(next);
    setPage(1);
    syncUrl({ sort: next, page: 1 });
  }

  function updatePage(next: number) {
    setPage(next);
    syncUrl({ page: next });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearFilters() {
    setFilters(defaultFilters);
    setPage(1);
    syncUrl({ filters: defaultFilters, page: 1 });
  }

  function runSearch() {
    setPage(1);
    syncUrl({ q, page: 1 });
    loadChannels(q, 1);
  }

  const emailOnly = filters.contact === "email";
  const hasSearchQuery = q.trim().length > 0;

  function toggleEmailFilter() {
    updateFilters({
      ...filters,
      contact: filters.contact === "email" ? "all" : "email",
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-mkt-tally">
          {DATA_SOURCE.database.label}
        </p>
        <h1 className="page-title mt-1">Browse enriched creators</h1>
        <p className="page-subtitle">
          Your enriched YouTube library (USA & Europe focus) — emails, scores, and outreach
          filters.
        </p>
      </div>

      <div className="card flex gap-3 p-4">
        <input
          type="search"
          className="input-field flex-1"
          placeholder="Search your database by name or niche…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
        />
        <button type="button" onClick={runSearch} className="btn-primary shrink-0">
          Search database
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <LibrarySortToggle value={sort} onChange={updateSort} />
          <button
            type="button"
            onClick={toggleEmailFilter}
            className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
              emailOnly
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200"
            }`}
          >
            ✉ Has email
          </button>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>

      <FilterBar filters={filters} onChange={updateFilters} onClear={clearFilters} />

      <p className="text-sm text-slate-400">
        Quality and market filters show a subset of saved creators. Choose All quality
        and Worldwide to browse the complete library. Refreshing a creator keeps its original added date.
      </p>

      <EmailLockedBanner />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">
              {DATA_SOURCE.database.label}
            </h2>
            <p className="text-xs text-slate-500">
              {loading
                ? "Loading…"
                : `${total.toLocaleString()} creators match`}
              {emailOnly ? " with email" : ""}
              {filters.uploadedWithin !== "all"
                ? ` · active ${filters.uploadedWithin}d`
                : ""}
              {filters.market === "us-eu" && !filters.country
                ? " · USA & Europe (+ unknown country)"
                : ""}
            </p>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : channels.length === 0 ? (
          <EmptyState
            title="No matches in your database"
            description={
              emailOnly
                ? 'No email contacts in this view. Try turning off "Has email" or resetting filters.'
                : hasSearchQuery
                  ? `No creators match "${q.trim()}" in your database yet. Try a different search.`
                  : "Your database is empty for these filters. Try resetting filters."
            }
          />
        ) : (
          <>
            <div
              className={
                view === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-3"
              }
            >
              {channels.map((ch) =>
                view === "grid" ? (
                  <CreatorGridCard
                    key={ch.id}
                    channel={ch}
                    onSave={() => setSaveChannel(ch)}
                    onOutreach={() => setOutreachChannel(ch)}
                    showEmailBadge
                  />
                ) : (
                  <CreatorListRow
                    key={ch.id}
                    channel={ch}
                    onSave={() => setSaveChannel(ch)}
                    onOutreach={() => setOutreachChannel(ch)}
                    showEmailBadge
                  />
                )
              )}
            </div>
            <PaginationBar
              page={page}
              total={total}
              pageSize={PAGE_SIZE}
              loading={loading}
              onChange={updatePage}
            />
          </>
        )}
      </section>

      {outreachChannel && (
        <EmailOutreachModal
          channel={outreachChannel}
          open={!!outreachChannel}
          onClose={() => setOutreachChannel(null)}
        />
      )}

      {saveChannel && (
        <SaveToCampaignModal
          channelId={saveChannel.id}
          channelTitle={saveChannel.title}
          open={!!saveChannel}
          onClose={() => setSaveChannel(null)}
        />
      )}
    </div>
  );
}
