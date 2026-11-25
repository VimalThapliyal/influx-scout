import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";

/** Pro waitlist: stores an email so we can tell people when Pro opens. */

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
      return NextResponse.json({ error: "Too many attempts. Try again in an hour." }, { status: 429 });
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    // Honeypot: real users never see or fill this field.
    if (typeof body.company === "string" && body.company.trim()) return NextResponse.json({ ok: true });

    const email = String(body.email ?? "").trim().toLowerCase().slice(0, 254);
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    const source = String(body.source ?? "").trim().slice(0, 40) || null;
    const user = await getSessionUser().catch(() => null);

    const { error } = await getSupabaseAdmin()
      .from("pro_waitlist")
      .upsert({ email, source, user_id: user?.id ?? null }, { onConflict: "email", ignoreDuplicates: true });
    if (error) {
      return NextResponse.json({ error: "We couldn't save your email. Try again in a moment." }, { status: 500 });
    }
    // Same answer whether or not the email was already on the list.
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "We couldn't save your email. Try again in a moment." }, { status: 500 });
  }
}
