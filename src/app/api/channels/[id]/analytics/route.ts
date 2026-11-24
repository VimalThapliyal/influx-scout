import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("channel_analytics")
      .select("*")
      .eq("channel_id", params.id)
      .order("recorded_at", { ascending: true })
      .limit(90);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ analytics: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
