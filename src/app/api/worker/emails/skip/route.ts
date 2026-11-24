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

/**
 * Mark a channel as checked with no usable public/captcha email.
 * Removes it from the captcha queue (email stays null).
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
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim().slice(0, 80)
        : "no_public_email";

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
    let id = channelId;

    if (!id && handle) {
      const { data } = await supabase
        .from("channels")
        .select("id")
        .ilike("handle", handle)
        .limit(1)
        .maybeSingle();
      id = data?.id || "";
    }

    if (!id) {
      return workerJsonResponse({ error: "Channel not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("channels")
      .update({
        email_skip_reason: reason,
        email_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      // Column missing until migration 009 is applied
      if (/email_skip_reason|column/i.test(error.message)) {
        return workerJsonResponse(
          {
            error:
              "Run migration 009_email_skip_reason.sql in Supabase SQL editor first",
          },
          { status: 500 }
        );
      }
      throw new Error(error.message);
    }

    return workerJsonResponse({
      ok: true,
      channel_id: id,
      reason,
    });
  } catch (err) {
    return workerJsonResponse(
      { error: err instanceof Error ? err.message : "Skip failed" },
      { status: 500 }
    );
  }
}
