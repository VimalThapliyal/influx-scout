import { NextResponse } from "next/server";
import { requireUser } from "@/lib/campaigns";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { InfluencerStatus } from "@/lib/types";

export interface CampaignListInsight {
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

export interface CampaignInsightsSummary {
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

function emptyCounts(): Record<InfluencerStatus, number> {
  return {
    identified: 0,
    contacted: 0,
    negotiating: 0,
    contracted: 0,
    completed: 0,
  };
}

function rates(contacted: number, replied: number, total: number) {
  return {
    reply_rate: contacted > 0 ? Math.round((replied / contacted) * 100) : 0,
    contact_rate: total > 0 ? Math.round((contacted / total) * 100) : 0,
  };
}

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({
        requiresAuth: true,
        summary: null,
        lists: [] as CampaignListInsight[],
      });
    }

    const supabase = getSupabaseAdmin();
    const { data: campaigns, error: campError } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (campError) {
      return NextResponse.json({ error: campError.message }, { status: 500 });
    }

    const campaignRows = campaigns ?? [];
    const campaignIds = campaignRows.map((c) => c.id);

    if (campaignIds.length === 0) {
      const emptySummary: CampaignInsightsSummary = {
        list_count: 0,
        total_creators: 0,
        identified: 0,
        contacted: 0,
        negotiating: 0,
        contracted: 0,
        replied: 0,
        reply_rate: 0,
        contact_rate: 0,
      };
      return NextResponse.json({
        requiresAuth: false,
        summary: emptySummary,
        lists: [],
      });
    }

    const { data: influencers, error: infError } = await supabase
      .from("campaign_influencers")
      .select("campaign_id, status, replied")
      .in("campaign_id", campaignIds);

    if (infError) {
      return NextResponse.json({ error: infError.message }, { status: 500 });
    }

    const byCampaign = new Map<
      string,
      { counts: Record<InfluencerStatus, number>; replied: number; total: number }
    >();

    for (const id of campaignIds) {
      byCampaign.set(id, { counts: emptyCounts(), replied: 0, total: 0 });
    }

    for (const row of influencers ?? []) {
      const bucket = byCampaign.get(row.campaign_id);
      if (!bucket) continue;
      bucket.total++;
      const status = row.status as InfluencerStatus;
      if (status in bucket.counts) bucket.counts[status]++;
      if (row.replied) bucket.replied++;
    }

    const lists: CampaignListInsight[] = campaignRows.map((c) => {
      const bucket = byCampaign.get(c.id)!;
      const contacted =
        bucket.counts.contacted +
        bucket.counts.negotiating +
        bucket.counts.contracted +
        bucket.counts.completed;
      const contracted = bucket.counts.contracted + bucket.counts.completed;
      const { reply_rate, contact_rate } = rates(contacted, bucket.replied, bucket.total);

      return {
        id: c.id,
        name: c.name,
        total: bucket.total,
        identified: bucket.counts.identified,
        contacted,
        negotiating: bucket.counts.negotiating,
        contracted,
        replied: bucket.replied,
        reply_rate,
        contact_rate,
      };
    });

    const summaryCounts = emptyCounts();
    let totalCreators = 0;
    let totalReplied = 0;

    for (const bucket of Array.from(byCampaign.values())) {
      totalCreators += bucket.total;
      totalReplied += bucket.replied;
      for (const status of Object.keys(summaryCounts) as InfluencerStatus[]) {
        summaryCounts[status] += bucket.counts[status];
      }
    }

    const summaryContacted =
      summaryCounts.contacted +
      summaryCounts.negotiating +
      summaryCounts.contracted +
      summaryCounts.completed;
    const summaryContracted = summaryCounts.contracted + summaryCounts.completed;
    const { reply_rate, contact_rate } = rates(
      summaryContacted,
      totalReplied,
      totalCreators
    );

    const summary: CampaignInsightsSummary = {
      list_count: campaignRows.length,
      total_creators: totalCreators,
      identified: summaryCounts.identified,
      contacted: summaryContacted,
      negotiating: summaryCounts.negotiating,
      contracted: summaryContracted,
      replied: totalReplied,
      reply_rate,
      contact_rate,
    };

    return NextResponse.json({
      requiresAuth: false,
      summary,
      lists,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
