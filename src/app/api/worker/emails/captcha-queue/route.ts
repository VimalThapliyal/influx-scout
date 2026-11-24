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
 * Channels with no email — manual YouTube captcha queue
 * (About → View email → solve captcha → Save).
 */
export async function GET(request: NextRequest) {
  const token = extractBearerToken(request.headers.get("authorization"));
  const worker = await authenticateWorker(token);
  if (!worker) {
    return workerJsonResponse(
      { error: "Invalid or missing worker key" },
      { status: 401 }
    );
  }

  try {
    const sp = request.nextUrl.searchParams;
    const limit = Math.max(
      1,
      Math.min(200, Number(sp.get("limit") || "50") || 50)
    );
    const offset = Math.max(0, Number(sp.get("offset") || "0") || 0);
    const noLinks = sp.get("no_links") === "1" || sp.get("no_links") === "true";
    const minSubs = Math.max(0, Number(sp.get("min_subs") || "0") || 0);

    const supabase = getSupabaseAdmin();
    let q = supabase
      .from("channels")
      .select(
        "id, title, handle, subscriber_count, country, website, instagram",
        { count: "exact" }
      )
      .is("email", null)
      .is("email_skip_reason", null)
      .order("subscriber_count", { ascending: false, nullsFirst: false });

    if (minSubs > 0) q = q.gte("subscriber_count", minSubs);
    if (noLinks) {
      q = q.is("website", null).is("instagram", null);
    }

    let { data, error, count } = await q.range(offset, offset + limit - 1);

    // Fallback if migration 009 not applied yet
    if (error && /email_skip_reason|column/i.test(error.message)) {
      let q2 = supabase
        .from("channels")
        .select(
          "id, title, handle, subscriber_count, country, website, instagram",
          { count: "exact" }
        )
        .is("email", null)
        .order("subscriber_count", { ascending: false, nullsFirst: false });
      if (minSubs > 0) q2 = q2.gte("subscriber_count", minSubs);
      if (noLinks) q2 = q2.is("website", null).is("instagram", null);
      const retry = await q2.range(offset, offset + limit - 1);
      data = retry.data;
      error = retry.error;
      count = retry.count;
    }

    if (error) throw new Error(error.message);

    const channels = (data || []).map((r) => {
      const about = r.handle
        ? `https://www.youtube.com/${r.handle}/about`
        : `https://www.youtube.com/channel/${r.id}/about`;
      return {
        id: r.id,
        title: r.title,
        handle: r.handle,
        subscriber_count: r.subscriber_count,
        country: r.country,
        has_website: !!r.website,
        has_instagram: !!r.instagram,
        about_url: about,
      };
    });

    return workerJsonResponse({
      ok: true,
      note: "No captcha flag from YouTube — these are channels with no email yet (manual About queue).",
      total: count ?? 0,
      channels,
    });
  } catch (err) {
    return workerJsonResponse(
      { error: err instanceof Error ? err.message : "List failed" },
      { status: 500 }
    );
  }
}
