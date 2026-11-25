/**
 * Live numbers and sample creators for the public landing page (server-only).
 * Only public channel stats leave the server; contact details never do, only
 * whether a public email exists.
 */
import { getSupabaseAdmin } from "./supabase";
import { INDEPENDENT_FILTER, getLibraryCounts } from "./library-counts";
import { NICHE_LABELS } from "./classify";
import type { Channel } from "./types";

export interface LandingData {
  passCount: number | null;
  withEmailCount: number | null;
  /** Creators with a public email or a contact form on their own site. */
  reachableCount: number | null;
  /** Rows shaped for <CreatorTable>; email is always null. */
  creators: Channel[];
}

const PREVIEW_COUNTRIES = ["US", "GB", "CA", "AU", "DE", "FR", "NL", "IE"];

export async function getLandingData(): Promise<LandingData> {
  const db = getSupabaseAdmin();
  const since = new Date(Date.now() - 21 * 86_400_000).toISOString();
  const [counts, sample] = await Promise.all([
    getLibraryCounts(),
    db
      .from("channels")
      .select(
        "id, title, handle, thumbnail_url, country, primary_niche, subscriber_count, avg_views_last5, engagement_last5, latest_upload_at, email, email_validation_status, has_contact_form, website, instagram"
      )
      .eq("quality_pass", true)
      .is("opted_out_at", null)
      .gte("latest_upload_at", since)
      .in("country", PREVIEW_COUNTRIES)
      .gte("subscriber_count", 50_000)
      .lte("subscriber_count", 2_500_000)
      .not("primary_niche", "is", null)
      .or(INDEPENDENT_FILTER)
      .order("avg_views_last5", { ascending: false })
      .limit(300),
  ]);

  // One creator per niche and at most three per country, to show the spread.
  const seenNiche = new Set<string>();
  const perCountry = new Map<string, number>();
  const creators: Channel[] = [];
  for (const r of sample.data ?? []) {
    const niche = r.primary_niche as string;
    if (seenNiche.has(niche) || !(niche in NICHE_LABELS)) continue;
    if ((perCountry.get(r.country) ?? 0) >= 3) continue;
    seenNiche.add(niche);
    perCountry.set(r.country, (perCountry.get(r.country) ?? 0) + 1);
    creators.push({
      id: r.id,
      title: r.title,
      handle: r.handle,
      thumbnail_url: r.thumbnail_url,
      country: r.country,
      primary_niche: niche,
      subscriber_count: r.subscriber_count,
      avg_views_last5: r.avg_views_last5,
      engagement_last5: r.engagement_last5,
      latest_upload_at: r.latest_upload_at,
      has_email: Boolean(r.email) && r.email_validation_status !== "risky",
      has_contact_form: r.has_contact_form,
      email: null,
      website: r.website ? "public" : null,
      instagram: r.instagram ? "public" : null,
    } as unknown as Channel);
    if (creators.length === 8) break;
  }

  return {
    passCount: counts?.listed ?? null,
    withEmailCount: counts?.withEmail ?? null,
    reachableCount: counts?.reachable ?? null,
    creators,
  };
}
