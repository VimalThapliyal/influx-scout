"use client";

import { TARGET_MARKET_LABEL } from "@/lib/markets";
import { NICHE_FILTER_OPTIONS } from "@/lib/classify";

export type SubscriberRange = "all" | "nano" | "micro" | "mid" | "macro" | "mega";
export type ContactFilter = "all" | "email" | "social" | "any" | "form";
export type AvgViewsFilter = "all" | "1k" | "10k" | "100k";
export type MarketFilter = "us-eu" | "worldwide";
/** Prefer real latest_upload_at when scored; falls back to last_updated. */
export type UploadedWithinFilter = "all" | "7" | "30" | "45" | "90";
export type NicheFilter = string;
export type QualityFilter = "all" | "ready" | "emerging" | "inactive";

export interface SearchFilters {
  subscriberRange: SubscriberRange;
  avgViews: AvgViewsFilter;
  market: MarketFilter;
  country: string;
  niche: NicheFilter;
  contact: ContactFilter;
  tier: string;
  uploadedWithin: UploadedWithinFilter;
  quality: QualityFilter;
}

export const defaultFilters: SearchFilters = {
  subscriberRange: "all",
  avgViews: "all",
  market: "us-eu",
  country: "",
  niche: "",
  contact: "all",
  tier: "",
  uploadedWithin: "all",
  quality: "ready",
};

export function subscriberRangeToMinMax(range: SubscriberRange) {
  switch (range) {
    case "nano": return { min: 1_000, max: 9_999 };
    case "micro": return { min: 10_000, max: 99_999 };
    case "mid": return { min: 100_000, max: 499_999 };
    case "macro": return { min: 500_000, max: 999_999 };
    case "mega": return { min: 1_000_000 };
    default: return {};
  }
}

export function avgViewsToMin(filter: AvgViewsFilter) {
  switch (filter) {
    case "1k": return 1_000;
    case "10k": return 10_000;
    case "100k": return 100_000;
    default: return undefined;
  }
}

export function uploadedWithinToDays(filter: UploadedWithinFilter): number | undefined {
  if (filter === "all") return undefined;
  const n = parseInt(filter, 10);
  return Number.isFinite(n) ? n : undefined;
}

const SUBSCRIBER_OPTIONS: { value: SubscriberRange; label: string }[] = [
  { value: "all", label: "All subscribers" },
  { value: "nano", label: "Nano 1K–10K" },
  { value: "micro", label: "Micro 10K–100K" },
  { value: "mid", label: "Mid 100K–500K" },
  { value: "macro", label: "Macro 500K–1M" },
  { value: "mega", label: "Mega 1M+" },
];

const VIEWS_OPTIONS: { value: AvgViewsFilter; label: string }[] = [
  { value: "all", label: "Any views" },
  { value: "1k", label: "1K+ avg" },
  { value: "10k", label: "10K+ avg" },
  { value: "100k", label: "100K+ avg" },
];

const MARKET_OPTIONS: { value: MarketFilter; label: string }[] = [
  { value: "us-eu", label: TARGET_MARKET_LABEL },
  { value: "worldwide", label: "Worldwide" },
];

const COUNTRY_OPTIONS = ["", "US", "GB", "DE", "FR", "NL", "ES", "IT", "SE", "IE", "AT", "CH", "PL", "NO", "DK", "FI", "PT"];

const CONTACT_OPTIONS: { value: ContactFilter; label: string }[] = [
  { value: "all", label: "Any contact" },
  { value: "email", label: "Has email" },
  { value: "form", label: "Has contact form" },
  { value: "social", label: "Has social" },
  { value: "any", label: "Any method" },
];

const ACTIVITY_OPTIONS: { value: UploadedWithinFilter; label: string }[] = [
  { value: "all", label: "Any activity" },
  { value: "7", label: "Uploaded 7 days" },
  { value: "30", label: "Uploaded 30 days" },
  { value: "45", label: "Uploaded 45 days" },
  { value: "90", label: "Uploaded 90 days" },
];

const QUALITY_OPTIONS: { value: QualityFilter; label: string }[] = [
  { value: "all", label: "All quality" },
  { value: "ready", label: "Outreach ready" },
  { value: "emerging", label: "Emerging" },
  { value: "inactive", label: "Inactive only" },
];

interface FilterBarProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onClear: () => void;
}

export function FilterBar({ filters, onChange, onClear }: FilterBarProps) {
  const activeCount = [
    filters.subscriberRange !== "all",
    filters.avgViews !== "all",
    filters.market !== "us-eu",
    filters.country !== "",
    filters.niche !== "",
    filters.contact !== "all",
    filters.uploadedWithin !== "all",
    filters.quality !== "all",
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Refine results
          {activeCount > 0 && (
            <span className="ml-2 rounded-full bg-mkt-tally/20 px-2 py-0.5 text-mkt-tally">
              {activeCount} active
            </span>
          )}
        </p>
        {activeCount > 0 && (
          <button type="button" onClick={onClear} className="text-xs text-slate-500 hover:text-mkt-tally">
            Reset all
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterSelect
          label="Subscribers"
          value={filters.subscriberRange}
          options={SUBSCRIBER_OPTIONS}
          onChange={(v) => onChange({ ...filters, subscriberRange: v as SubscriberRange })}
        />
        <FilterSelect
          label="Avg views"
          value={filters.avgViews}
          options={VIEWS_OPTIONS}
          onChange={(v) => onChange({ ...filters, avgViews: v as AvgViewsFilter })}
        />
        <FilterSelect
          label="Activity"
          value={filters.uploadedWithin}
          options={ACTIVITY_OPTIONS}
          onChange={(v) => onChange({ ...filters, uploadedWithin: v as UploadedWithinFilter })}
        />
        <FilterSelect
          label="Market"
          value={filters.market}
          options={MARKET_OPTIONS}
          onChange={(v) => onChange({ ...filters, market: v as MarketFilter })}
        />
        <FilterSelect
          label="Niche"
          value={filters.niche}
          options={NICHE_FILTER_OPTIONS}
          onChange={(v) => onChange({ ...filters, niche: v })}
        />
        <FilterSelect
          label="Country"
          value={filters.country}
          options={COUNTRY_OPTIONS.map((c) => ({
            value: c,
            label: c || (filters.market === "us-eu" ? `All ${TARGET_MARKET_LABEL}` : "All countries"),
          }))}
          onChange={(v) => onChange({ ...filters, country: v })}
        />
        <FilterSelect
          label="Quality"
          value={filters.quality}
          options={QUALITY_OPTIONS}
          onChange={(v) => onChange({ ...filters, quality: v as QualityFilter })}
        />
        <FilterSelect
          label="Contact"
          value={filters.contact}
          options={CONTACT_OPTIONS}
          onChange={(v) => onChange({ ...filters, contact: v as ContactFilter })}
        />
      </div>
      {filters.uploadedWithin !== "all" && (
        <p className="text-[11px] text-slate-500">
          Activity uses last upload date when scored; otherwise last profile refresh.
        </p>
      )}
      {filters.quality === "ready" && (
        <p className="text-[11px] text-slate-500">
          Outreach ready = last-5 avg views ≥5k, upload ≤45d, engagement ≥2%, Tier 1/2 location.
        </p>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const marketDefault = label === "Market" && value === "us-eu";
  const isActive =
    label === "Market"
      ? !marketDefault
      : value !== "all" && value !== "";

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium uppercase tracking-wider text-slate-600">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`min-h-[38px] cursor-pointer appearance-none rounded-xl border bg-[#0f172a] px-3 pr-8 text-sm transition focus:outline-none focus:ring-2 focus:ring-mkt-tally/30 ${
          isActive
            ? "border-mkt-tally/40 text-mkt-tally"
            : "border-white/10 text-slate-300"
        }`}
      >
        {options.map((o) => (
          <option key={o.value || o.label} value={o.value} className="bg-[#0f172a]">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ViewToggle({
  view,
  onChange,
}: {
  view: "grid" | "list";
  onChange: (v: "grid" | "list") => void;
}) {
  return (
    <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
      {(["grid", "list"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
            view === v ? "bg-mkt-tally/20 text-mkt-tally" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
