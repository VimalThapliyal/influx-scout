import { NextRequest, NextResponse } from "next/server";
import { authRequiredResponse, getCampaignForUser, requireUser } from "@/lib/campaigns";
import { getSupabaseAdmin } from "@/lib/supabase";
import { canViewEmails } from "@/lib/auth";
import { redactChannelEmail } from "@/lib/email";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    if (!user) return authRequiredResponse();

    const campaign = await getCampaignForUser(params.id, user.id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const supabase = getSupabaseAdmin();
    const { data: influencers, error: infError } = await supabase
      .from("campaign_influencers")
      .select("*, channel:channels(*)")
      .eq("campaign_id", params.id);

    if (infError) {
      return NextResponse.json({ error: infError.message }, { status: 500 });
    }

    const canView = await canViewEmails();
    const safeInfluencers = (influencers ?? []).map((inf) => {
      if (!inf.channel) return inf;
      return {
        ...inf,
        channel: redactChannelEmail(inf.channel as Record<string, unknown> & { email?: string | null }, canView),
      };
    });

    return NextResponse.json({ ...campaign, influencers: safeInfluencers, emails_locked: !canView });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch campaign";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    if (!user) return authRequiredResponse();

    const campaign = await getCampaignForUser(params.id, user.id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const body = await request.json();
    const channelIds: string[] = body.channel_ids ?? [];

    if (channelIds.length === 0) {
      return NextResponse.json({ error: "channel_ids required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const rows = channelIds.map((channel_id) => ({
      campaign_id: params.id,
      channel_id,
      status: "identified" as const,
    }));

    const { data, error } = await supabase
      .from("campaign_influencers")
      .upsert(rows, { onConflict: "campaign_id,channel_id" })
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ added: data?.length ?? 0, influencers: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add influencers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
