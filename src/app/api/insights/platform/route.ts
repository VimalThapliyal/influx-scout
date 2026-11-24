import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    let quota = { used: 0, limit: 10_000, remaining: 10_000, percent_used: 0 };

    try {
      const base = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_VERCEL_URL
          ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
          : "http://localhost:3000";
      const res = await fetch(`${base}/api/health`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.quota) quota = data.quota;
      }
    } catch {
      // optional health fetch
    }

    const supabase = getSupabaseAdmin();
    const [channelsRes, emailRes] = await Promise.all([
      supabase.from("channels").select("*", { count: "exact", head: true }),
      supabase.from("channels").select("*", { count: "exact", head: true }).not("email", "is", null),
    ]);

    const channels = channelsRes.count ?? 0;
    const withEmail = emailRes.count ?? 0;
    const emailRate = channels > 0 ? Math.round((withEmail / channels) * 100) : 0;

    return NextResponse.json({
      quota,
      channels,
      withEmail,
      emailRate,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load platform insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
