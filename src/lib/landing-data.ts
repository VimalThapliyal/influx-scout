/**
 * Live numbers and sample creators for the public landing page (server-only).
 * Only public channel stats leave the server; never contact details.
 */
import { getSupabaseAdmin } from "./supabase";
import { NICHE_LABELS, type NicheSlug } from "./classify";

export interface LedgerCreator {
  id: string;
  title: string;
  country: string;
  niche: string;
  subscribers: number;
  avgViews: number;
  engagement: number; // 0..1
  views: number[]; // last five uploads, oldest → newest
}

export interface LandingData {
  libraryCount: number | null;
  passCount: number | null;
  creators: LedgerCreator[];
}

const LEDGER_COUNTRIES = ["US", "GB", "CA", "AU", "DE", "FR", "NL", "IE"];

export async function getLandingData(): Promise<LandingData> {
  const db = getSupabaseAdmin();
  const since = new Date(Date.now() - 21 * 86_400_000).toISOString();

  const [library, passing, sample] = await Promise.all([
    db.from("channels").select("id", { count: "estimated", head: true }),
    db
      .from("channels")
      .select("id", { count: "exact", head: true })
      .eq("quality_pass", true)
      .is("opted_out_at", null),
    db
      .from("channels")
      .select("id, title, country, primary_niche, subscriber_count, avg_views_last5, engagement_last5, recent_videos")
      .eq("quality_pass", true)
      .is("opted_out_at", null)
      .gte("latest_upload_at", since)
      .in("country", LEDGER_COUNTRIES)
      .gte("subscriber_count", 80_000)
      .lte("subscriber_count", 2_500_000)
      .not("primary_niche", "is", null)
      .order("avg_views_last5", { ascending: false })
      .limit(300),
  ]);

  // One creator per niche and at most two per country, so the sample shows the
  // spread of the library; only channels whose views hold up across all five
  // videos (no single viral upload carrying the average).
  const seen = new Set<string>();
  const perCountry = new Map<string, number>();
  const creators: LedgerCreator[] = [];
  for (const r of sample.data ?? []) {
    const niche = r.primary_niche as string;
    if (seen.has(niche) || !(niche in NICHE_LABELS)) continue;
    if ((perCountry.get(r.country) ?? 0) >= 2) continue;
    const vids = Array.isArray(r.recent_videos) ? (r.recent_videos as any[]) : [];
    const views = vids
      .filter((v) => v?.published_at && typeof v.view_count === "number")
      .sort((a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime())
      .map((v) => v.view_count as number)
      .slice(-5);
    if (views.length < 5) continue;
    if (Math.min(...views) / Math.max(...views) < 0.35) continue;
    seen.add(niche);
    perCountry.set(r.country, (perCountry.get(r.country) ?? 0) + 1);
    creators.push({
      id: r.id,
      title: r.title,
      country: r.country,
      niche: NICHE_LABELS[niche as NicheSlug],
      subscribers: r.subscriber_count ?? 0,
      avgViews: r.avg_views_last5 ?? 0,
      engagement: Number(r.engagement_last5 ?? 0),
      views,
    });
    if (creators.length === 6) break;
  }

  return {
    libraryCount: library.count ?? null,
    passCount: passing.count ?? null,
    creators,
  };
}
