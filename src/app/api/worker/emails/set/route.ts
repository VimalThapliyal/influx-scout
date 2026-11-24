import { NextRequest } from "next/server";
import {
  authenticateWorker,
  extractBearerToken,
} from "@/lib/worker-auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  workerJsonResponse,
  workerOptionsResponse,
} from "@/lib/worker-cors";

export async function OPTIONS() {
  return workerOptionsResponse();
}

function isJunkEmail(email: string): boolean {
  let e = email.toLowerCase().trim().replace(/^mailto:/i, "");
  e = e.replace(/^u003[ce]/, "");
  if (!e.includes("@") || e.length < 6 || e.length > 120) return true;
  return /noreply|no-reply|example\.com|sentry\.io|instagram\.com|facebook\.com|zendesk\.com|patreon\.com|support@|guidelines@|help@|privacy@|legal@|youtube\.com/i.test(
    e
  );
}

/**
 * Save email onto a YouTube channel row (same UC… id).
 * Accepts channel_id and/or handle. Can create a minimal row if missing
 * (human captcha / IG assist flows).
 */
export async function POST(request: NextRequest) {
  const token = extractBearerToken(request.headers.get("authorization"));
  const worker = await authenticateWorker(token);
  if (!worker) {
    return workerJsonResponse(
      { error: "Invalid or missing worker key" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    let channelId =
      typeof body.channel_id === "string" ? body.channel_id.trim() : "";
    let handle =
      typeof body.handle === "string" ? body.handle.trim() : "";
    if (handle && !handle.startsWith("@")) handle = `@${handle}`;
    const title =
      typeof body.title === "string" ? body.title.trim().slice(0, 255) : "";
    const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
    const source =
      typeof body.source === "string"
        ? body.source.slice(0, 200)
        : "manual";
    const force = body.force === true;

    const email = emailRaw.toLowerCase().replace(/^mailto:/i, "");
    if (!email || isJunkEmail(email)) {
      return workerJsonResponse(
        { error: "Valid non-junk email required" },
        { status: 400 }
      );
    }

    if (channelId && !/^UC[\w-]{22}$/i.test(channelId)) {
      return workerJsonResponse(
        { error: "channel_id must be a UC… id" },
        { status: 400 }
      );
    }
    if (!channelId && !handle) {
      return workerJsonResponse(
        { error: "channel_id or handle required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    let existing: { id: string; email: string | null; handle?: string | null } | null =
      null;

    if (channelId) {
      const { data } = await supabase
        .from("channels")
        .select("id, email")
        .eq("id", channelId)
        .maybeSingle();
      existing = data;
    }
    if (!existing && handle) {
      // Exact match first
      const { data: exact } = await supabase
        .from("channels")
        .select("id, email, handle")
        .eq("handle", handle)
        .maybeSingle();
      if (exact) {
        existing = exact;
        channelId = exact.id;
      } else {
        // YouTube URLs often change handle casing (@CoComelon vs @cocomelon)
        const { data: fuzzy } = await supabase
          .from("channels")
          .select("id, email, handle")
          .ilike("handle", handle)
          .limit(1)
          .maybeSingle();
        if (fuzzy) {
          existing = fuzzy;
          channelId = fuzzy.id;
        }
      }
    }

    // Last resort: match by title (captcha assist)
    if (!existing && title) {
      const { data: byTitle } = await supabase
        .from("channels")
        .select("id, email, handle")
        .ilike("title", title)
        .is("email", null)
        .limit(1)
        .maybeSingle();
      if (byTitle) {
        existing = byTitle;
        channelId = byTitle.id;
      }
    }

    if (existing?.email && !force) {
      return workerJsonResponse({
        ok: true,
        updated: false,
        reason: "already_has_email",
        email: existing.email,
        channel_id: existing.id,
      });
    }

    if (existing) {
      const patch = {
        email,
        ...(handle ? { handle } : {}),
        email_skip_reason: null as string | null,
        email_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      };
      let { error: upErr } = await supabase
        .from("channels")
        .update(patch)
        .eq("id", existing.id);

      if (upErr && /email_skip_reason|email_checked_at|column/i.test(upErr.message)) {
        const { error: retryErr } = await supabase
          .from("channels")
          .update({
            email,
            ...(handle ? { handle } : {}),
            updated_at: new Date().toISOString(),
            last_updated: new Date().toISOString(),
          })
          .eq("id", existing.id);
        upErr = retryErr;
      }

      if (upErr) throw new Error(upErr.message);

      return workerJsonResponse({
        ok: true,
        updated: true,
        created: false,
        channel_id: existing.id,
        email,
        source,
      });
    }

    // Not in library yet — need a real UC id to create the row
    if (!channelId) {
      return workerJsonResponse(
        {
          error:
            "Channel not in library yet and no UC id — open /channel/UC… or Save to Influx first",
        },
        { status: 404 }
      );
    }

    const { error: insErr } = await supabase.from("channels").insert({
      id: channelId,
      handle: handle || null,
      title: title || handle || "Unknown",
      email,
      email_skip_reason: null,
      email_checked_at: new Date().toISOString(),
      data_source: "contributor",
      view_count: 0,
      video_count: 0,
      last_updated: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insErr) throw new Error(insErr.message);

    return workerJsonResponse({
      ok: true,
      updated: true,
      created: true,
      channel_id: channelId,
      email,
      source,
    });
  } catch (err) {
    return workerJsonResponse(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}
