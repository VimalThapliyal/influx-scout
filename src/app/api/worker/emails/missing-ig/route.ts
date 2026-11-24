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
 * Channels that have an Instagram URL but no email yet.
 * Used by Electron Instagram tab (logged-in scrape).
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
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") || "40");
    const limit = Math.max(1, Math.min(100, Number.isFinite(limitRaw) ? limitRaw : 40));
    const offsetRaw = Number(request.nextUrl.searchParams.get("offset") || "0");
    const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);

    const supabase = getSupabaseAdmin();
    const { data, error, count } = await supabase
      .from("channels")
      .select("id, title, handle, instagram, subscriber_count", {
        count: "exact",
      })
      .is("email", null)
      .not("instagram", "is", null)
      .neq("instagram", "")
      .order("subscriber_count", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    return workerJsonResponse({
      ok: true,
      total: count ?? 0,
      channels: (data || []).map((r) => ({
        id: r.id,
        title: r.title,
        handle: r.handle,
        instagram: r.instagram,
        subscriber_count: r.subscriber_count,
      })),
    });
  } catch (err) {
    return workerJsonResponse(
      { error: err instanceof Error ? err.message : "List failed" },
      { status: 500 }
    );
  }
}
