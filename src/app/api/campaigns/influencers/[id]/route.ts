import { NextRequest, NextResponse } from "next/server";
import { authRequiredResponse, getInfluencerForUser, requireUser } from "@/lib/campaigns";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { InfluencerStatus } from "@/lib/types";

const VALID_STATUSES: InfluencerStatus[] = [
  "identified",
  "contacted",
  "negotiating",
  "contracted",
  "completed",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    if (!user) return authRequiredResponse();

    const existing = await getInfluencerForUser(params.id, user.id);
    if (!existing) {
      return NextResponse.json({ error: "Creator not found in campaign" }, { status: 404 });
    }

    const body = await request.json();
    const patch: Record<string, unknown> = {};

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      patch.status = body.status;

      if (
        body.status === "contacted" &&
        !existing.email_sent_at &&
        body.email_sent_at !== false
      ) {
        patch.email_sent_at = new Date().toISOString();
      }
    }

    if (typeof body.replied === "boolean") {
      patch.replied = body.replied;
    }

    if (body.notes !== undefined) {
      patch.notes = body.notes?.trim() || null;
    }

    if (body.mark_contacted === true) {
      patch.status = "contacted";
      patch.email_sent_at = new Date().toISOString();
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("campaign_influencers")
      .update(patch)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
