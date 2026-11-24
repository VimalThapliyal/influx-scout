import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseYouTubeRef } from "@/lib/youtube-url";

/**
 * "Remove my listing" requests from creators. Hides the channel immediately
 * (channels.opted_out_at) and logs the request; the row is kept so a mistaken
 * request can be reviewed and undone.
 */

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
const PER_IP_PER_HOUR = 5;
const recent = new Map<string, number[]>();

function rateLimited(ip: string, now = Date.now()): boolean {
  const hits = (recent.get(ip) ?? []).filter((t) => t > now - 3_600_000);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > PER_IP_PER_HOUR;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (rateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    // Honeypot: real users never see or fill this field.
    if (typeof body.company === "string" && body.company.trim()) {
      return NextResponse.json({ ok: true });
    }

    const channelInput = String(body.channel ?? "").trim().slice(0, 300);
    const email = String(body.email ?? "").trim().slice(0, 254);
    const reason = String(body.reason ?? "").trim().slice(0, 1000) || null;

    if (!channelInput) {
      return NextResponse.json({ error: "Please paste your YouTube channel link." }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const ref = parseYouTubeRef(channelInput);
    if (!ref || ref.kind === "video_id") {
      return NextResponse.json(
        { error: "Please paste your channel link (youtube.com/@yourhandle or youtube.com/channel/UC…), not a video link." },
        { status: 400 }
      );
    }

    const db = getSupabaseAdmin();
    let channelId: string | null = null;
    if (ref.kind === "channel_id") {
      const { data } = await db.from("channels").select("id").eq("id", ref.value).maybeSingle();
      channelId = data?.id ?? null;
    } else {
      const { data } = await db.from("channels").select("id").ilike("handle", `@${ref.value}`).limit(1).maybeSingle();
      channelId = data?.id ?? null;
    }

    if (channelId) {
      const { error } = await db
        .from("channels")
        .update({ opted_out_at: new Date().toISOString() })
        .eq("id", channelId);
      if (error) throw new Error(error.message);
    }

    const { error: logError } = await db.from("removal_requests").insert({
      channel_input: channelInput,
      channel_id: channelId,
      requester_email: email,
      reason,
      status: channelId ? "hidden" : "not_found",
    });
    if (logError) throw new Error(logError.message);

    return NextResponse.json({ ok: true, found: Boolean(channelId) });
  } catch (error) {
    console.error("removal-request", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
