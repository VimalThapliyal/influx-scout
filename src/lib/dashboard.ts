import { getSupabaseAdmin } from "@/lib/supabase";
import { canViewEmails } from "@/lib/auth";
import { redactChannels } from "@/lib/email";
import { TARGET_MARKET_LABEL } from "@/lib/markets";
import { INDEPENDENT_FILTER, OUTREACH_EMAIL, activeSince, getLibraryCounts } from "@/lib/library-counts";
import type { Channel, InfluencerStatus } from "@/lib/types";

export interface LibraryStats {
  total: number;
  withEmail: number;
  inTargetMarket: number;
}

export interface PipelineStats {
  listCount: number;
  creatorCount: number;
  contacted: number;
  negotiating: number;
  contracted: number;
  replied: number;
  identified: number;
}

export async function getLibraryStats(): Promise<LibraryStats> {
  const counts = await getLibraryCounts();
  return {
    total: counts?.listed ?? 0,
    withEmail: counts?.withEmail ?? 0,
    inTargetMarket: counts?.independent ?? 0,
  };
}

/** Most-viewed independent creators with a public email. */
export async function getRecommendedCreators(): Promise<Channel[]> {
  try {
    const supabase = getSupabaseAdmin();
    const canView = await canViewEmails();
    const { data } = await supabase
      .from("channels")
      .select("*")
      .eq("quality_pass", true)
      .gte("latest_upload_at", activeSince())
      .is("opted_out_at", null)
      .or(OUTREACH_EMAIL)
      .or(INDEPENDENT_FILTER)
      .order("avg_views_last5", { ascending: false, nullsFirst: false })
      .limit(5);

    return redactChannels(data ?? [], canView);
  } catch {
    return [];
  }
}

/** Newest listed creators. */
export async function getRecentCreators(): Promise<Channel[]> {
  try {
    const supabase = getSupabaseAdmin();
    const canView = await canViewEmails();
    const { data } = await supabase
      .from("channels")
      .select("*")
      .eq("quality_pass", true)
      .gte("latest_upload_at", activeSince())
      .is("opted_out_at", null)
      .or(INDEPENDENT_FILTER)
      .order("created_at", { ascending: false })
      .limit(5);

    return redactChannels(data ?? [], canView);
  } catch {
    return [];
  }
}

export async function getPipelineStats(userId: string | null): Promise<PipelineStats> {
  const empty: PipelineStats = {
    listCount: 0,
    creatorCount: 0,
    contacted: 0,
    negotiating: 0,
    contracted: 0,
    replied: 0,
    identified: 0,
  };

  if (!userId) return empty;

  try {
    const supabase = getSupabaseAdmin();
    const { data: userCampaigns } = await supabase
      .from("campaigns")
      .select("id")
      .eq("user_id", userId);

    const campaignIds = (userCampaigns ?? []).map((c) => c.id);
    if (campaignIds.length === 0) {
      return { ...empty, listCount: 0 };
    }

    const { data: influencers } = await supabase
      .from("campaign_influencers")
      .select("status, replied")
      .in("campaign_id", campaignIds);

    const rows = influencers ?? [];
    const counts: Record<InfluencerStatus, number> = {
      identified: 0,
      contacted: 0,
      negotiating: 0,
      contracted: 0,
      completed: 0,
    };
    let replied = 0;

    for (const row of rows) {
      const status = row.status as InfluencerStatus;
      if (status in counts) counts[status]++;
      if (row.replied) replied++;
    }

    return {
      listCount: campaignIds.length,
      creatorCount: rows.length,
      identified: counts.identified,
      contacted: counts.contacted,
      negotiating: counts.negotiating,
      contracted: counts.contracted + counts.completed,
      replied,
    };
  } catch {
    return empty;
  }
}

export { TARGET_MARKET_LABEL };
