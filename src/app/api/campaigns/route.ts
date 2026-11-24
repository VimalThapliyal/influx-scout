import { NextRequest, NextResponse } from "next/server";
import { authRequiredResponse, requireUser } from "@/lib/campaigns";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ campaigns: [], requiresAuth: true });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("campaigns")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ campaigns: data ?? [], requiresAuth: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list campaigns";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    if (!user) return authRequiredResponse();

    const body = await request.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        description: body.description ?? null,
        target_categories: body.target_categories ?? [],
        target_tiers: body.target_tiers ?? [],
        min_subscribers: body.min_subscribers ?? 0,
        max_subscribers: body.max_subscribers ?? 10_000_000,
        budget: body.budget ?? null,
        status: body.status ?? "draft",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create campaign";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
