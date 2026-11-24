import type { Channel } from "@/lib/types";
import {
  subscriberRangeToMinMax,
  avgViewsToMin,
  uploadedWithinToDays,
  type SearchFilters,
} from "@/components/FilterBar";
import { isTargetMarketCountryOrUnknown } from "@/lib/markets";

export function applyClientFilters(channels: Channel[], filters: SearchFilters): Channel[] {
  const activityDays = uploadedWithinToDays(filters.uploadedWithin);
  const activityCutoff =
    activityDays !== undefined ? Date.now() - activityDays * 86_400_000 : null;

  return channels.filter((ch) => {
    const { min, max } = subscriberRangeToMinMax(filters.subscriberRange);
    const subs = ch.subscriber_count ?? 0;
    if (min !== undefined && subs < min) return false;
    if (max !== undefined && subs > max) return false;
    const minViews = avgViewsToMin(filters.avgViews);
    const avgViews = ch.avg_views_last5 ?? ch.avg_views_per_video ?? 0;
    if (minViews && avgViews < minViews) return false;
    if (filters.country && ch.country !== filters.country) return false;
    if (filters.niche) {
      const niche = ch.primary_niche || ch.category;
      if (niche !== filters.niche) return false;
    }
    if (
      filters.market === "us-eu" &&
      !filters.country &&
      !isTargetMarketCountryOrUnknown(ch.country)
    ) {
      return false;
    }
    if (filters.contact === "email" && !ch.has_email && !ch.email) return false;
    if (filters.contact === "form" && !ch.has_contact_form && !ch.contact_form_url) {
      return false;
    }
    if (filters.contact === "social" && !ch.instagram && !ch.twitter && !ch.tiktok && !ch.website) {
      return false;
    }
    if (
      filters.contact === "any" &&
      !ch.has_email &&
      !ch.email &&
      !ch.has_contact_form &&
      !ch.contact_form_url &&
      !ch.instagram &&
      !ch.twitter &&
      !ch.tiktok &&
      !ch.website
    ) {
      return false;
    }
    if (filters.quality === "ready" && ch.quality_pass !== true) return false;
    if (filters.quality === "emerging" && ch.is_emerging !== true) return false;
    if (filters.quality === "inactive" && ch.is_inactive !== true) return false;
    if (activityCutoff !== null) {
      const ts = ch.latest_upload_at
        ? new Date(ch.latest_upload_at).getTime()
        : ch.last_updated
          ? new Date(ch.last_updated).getTime()
          : 0;
      if (!ts || ts < activityCutoff) return false;
    }
    return true;
  });
}
