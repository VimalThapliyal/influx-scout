import { NextRequest, NextResponse } from "next/server";
import { PAYMENTS_ENABLED } from "@/lib/billing";
import { authRequiredResponse, getCampaignForUser, requireUser } from "@/lib/campaigns";
import { getSupabaseAdmin } from "@/lib/supabase";
import { canViewEmails } from "@/lib/auth";

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

    const canView = await canViewEmails();
    if (!canView) {
      return NextResponse.json(
        { error: PAYMENTS_ENABLED ? "Subscribe to export emails. Visit /subscribe to unlock." : "Email export is part of Pro, which is coming soon." },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: influencers, error } = await supabase
      .from("campaign_influencers")
      .select("*, channel:channels(*)")
      .eq("campaign_id", params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const headers = [
      "channel_id",
      "title",
      "handle",
      "subscriber_count",
      "tier",
      "influencer_score",
      "email",
      "instagram",
      "twitter",
      "status",
    ];

    const rows = (influencers ?? []).map((inf) => {
      const ch = inf.channel as Record<string, unknown> | null;
      return [
        ch?.id ?? inf.channel_id,
        ch?.title ?? "",
        ch?.handle ?? "",
        ch?.subscriber_count ?? "",
        ch?.tier ?? "",
        ch?.influencer_score ?? "",
        ch?.email ?? "",
        ch?.instagram ?? "",
        ch?.twitter ?? "",
        inf.status,
      ];
    });

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="campaign-${params.id}.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
