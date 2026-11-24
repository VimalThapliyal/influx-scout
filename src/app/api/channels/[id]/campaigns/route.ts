import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/campaigns";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ memberships: [], requiresAuth: true });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("campaign_influencers")
      .select("id, status, email_sent_at, campaign:campaigns!inner(id, name, user_id)")
      .eq("channel_id", params.id)
      .eq("campaigns.user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const memberships = (data ?? [])
      .map((row) => {
        const raw = row.campaign;
        const campaign = Array.isArray(raw) ? raw[0] : raw;
        if (!campaign || typeof campaign !== "object") return null;
        const c = campaign as { id: string; name: string };
        return {
          influencer_id: row.id as string,
          campaign_id: c.id,
          campaign_name: c.name,
          status: row.status as string,
          email_sent_at: row.email_sent_at as string | null,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    return NextResponse.json({ memberships, requiresAuth: false });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load campaign memberships";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
