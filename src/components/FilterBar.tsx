"use client";

import { ChevronDown } from "lucide-react";
import { TARGET_MARKET_LABEL } from "@/lib/markets";
import { countryLabel } from "@/lib/tags";
import { NICHE_FILTER_OPTIONS } from "@/lib/classify";

export type SubscriberRange = "all" | "nano" | "micro" | "mid" | "macro" | "mega";
export type ContactFilter = "all" | "direct" | "email" | "social" | "any" | "form";
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
  { value: "all", label: "Any average views" },
  { value: "1k", label: "1K+ average views" },
  { value: "10k", label: "10K+ average views" },
  { value: "100k", label: "100K+ average views" },
];

const MARKET_OPTIONS: { value: MarketFilter; label: string }[] = [
  { value: "us-eu", label: TARGET_MARKET_LABEL },
  { value: "worldwide", label: "Worldwide" },
];

const COUNTRY_OPTIONS = ["", "US", "GB", "DE", "FR", "NL", "ES", "IT", "SE", "IE", "AT", "CH", "PL", "NO", "DK", "FI", "PT"];

const CONTACT_OPTIONS: { value: ContactFilter; label: string }[] = [
  { value: "all", label: "Any contact info" },
  { value: "direct", label: "Email or contact form" },
  { value: "email", label: "Has email" },
  { value: "form", label: "Has contact form" },
  { value: "social", label: "Has social" },
  { value: "any", label: "Has any contact" },
];

const ACTIVITY_OPTIONS: { value: UploadedWithinFilter; label: string }[] = [
  { value: "all", label: "Any last upload" },
  { value: "7", label: "Uploaded in 7 days" },
  { value: "30", label: "Uploaded in 30 days" },
  { value: "45", label: "Uploaded in 45 days" },
  { value: "90", label: "Uploaded in 90 days" },
];

const QUALITY_OPTIONS: { value: QualityFilter; label: string }[] = [
  { value: "all", label: "All creators" },
  { value: "ready", label: "Outreach ready" },
  { value: "emerging", label: "Emerging" },
  { value: "inactive", label: "Inactive" },
];

interface FilterBarProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onClear: () => void;
}

export function activeFilterCount(filters: SearchFilters): number {
  return [
    filters.subscriberRange !== "all",
    filters.avgViews !== "all",
    filters.market !== "us-eu",
    filters.country !== "",
    filters.niche !== "",
    filters.contact !== "all",
    filters.uploadedWithin !== "all",
    filters.quality !== "all",
  ].filter(Boolean).length;
}

/** One row of compact selects. Each select names its own default ("All niches"), so no labels above. */
export function FilterBar({ filters, onChange, onClear }: FilterBarProps) {
  const active = activeFilterCount(filters);
  return (
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&>*]:shrink-0">
      <FilterSelect
        label="Quality"
        value={filters.quality}
        isActive={filters.quality !== "all"}
        options={QUALITY_OPTIONS}
        onChange={(v) => onChange({ ...filters, quality: v as QualityFilter })}
      />
      <FilterSelect
        label="Niche"
        value={filters.niche}
        isActive={filters.niche !== ""}
        options={NICHE_FILTER_OPTIONS}
        onChange={(v) => onChange({ ...filters, niche: v })}
      />
      <FilterSelect
        label="Subscribers"
        value={filters.subscriberRange}
        isActive={filters.subscriberRange !== "all"}
        options={SUBSCRIBER_OPTIONS}
        onChange={(v) => onChange({ ...filters, subscriberRange: v as SubscriberRange })}
      />
      <FilterSelect
        label="Average views"
        value={filters.avgViews}
        isActive={filters.avgViews !== "all"}
        options={VIEWS_OPTIONS}
        onChange={(v) => onChange({ ...filters, avgViews: v as AvgViewsFilter })}
      />
      <FilterSelect
        label="Last upload"
        value={filters.uploadedWithin}
        isActive={filters.uploadedWithin !== "all"}
        options={ACTIVITY_OPTIONS}
        onChange={(v) => onChange({ ...filters, uploadedWithin: v as UploadedWithinFilter })}
      />
      <FilterSelect
        label="Market"
        value={filters.market}
        isActive={filters.market !== "us-eu"}
        options={MARKET_OPTIONS}
        onChange={(v) => onChange({ ...filters, market: v as MarketFilter })}
      />
      <FilterSelect
        label="Country"
        value={filters.country}
        isActive={filters.country !== ""}
        options={COUNTRY_OPTIONS.map((c) => ({ value: c, label: c ? countryLabel(c) : "All countries" }))}
        onChange={(v) => onChange({ ...filters, country: v })}
      />
      <FilterSelect
        label="Contact"
        value={filters.contact}
        isActive={filters.contact !== "all"}
        options={CONTACT_OPTIONS}
        onChange={(v) => onChange({ ...filters, contact: v as ContactFilter })}
      />
      {active > 0 && (
        <button type="button" onClick={onClear} className="btn-ghost btn-sm">
          Reset filters
        </button>
      )}
    </div>
  );
}

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  isActive = false,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  isActive?: boolean;
}) {
  return (
    <span className="relative inline-flex">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 cursor-pointer appearance-none rounded-md border pl-2.5 pr-7 text-[0.8125rem] font-medium transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ${
          isActive
            ? "border-accent/40 bg-accent-soft text-accent"
            : "border-line-strong bg-surface text-fg hover:bg-subtle"
        }`}
      >
        {options.map((o) => (
          <option key={o.value || o.label} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        strokeWidth={1.75}
        aria-hidden
        className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${isActive ? "text-accent" : "text-muted"}`}
      />
    </span>
  );
}
