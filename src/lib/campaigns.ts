import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getSessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export function authRequiredResponse() {
  return NextResponse.json(
    { error: "Sign in to save your campaign lists.", code: "AUTH_REQUIRED" },
    { status: 401 }
  );
}

export async function requireUser(): Promise<User | null> {
  return getSessionUser();
}

export async function getCampaignForUser(campaignId: string, userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  return data;
}

export async function getInfluencerForUser(influencerId: string, userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("campaign_influencers")
    .select("id, status, email_sent_at, campaign_id, campaigns!inner(user_id)")
    .eq("id", influencerId)
    .eq("campaigns.user_id", userId)
    .single();

  if (error || !data) return null;
  return data;
}
