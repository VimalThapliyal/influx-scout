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
import {
  upsertChannelWithMetricsExpiry,
  withYoutubeMetricsExpiry,
} from "@/lib/youtube-metrics";
import { withChannelClassification } from "@/lib/classify";

export async function OPTIONS() {
  return workerOptionsResponse();
}

/**
 * Contributor posts YouTube-enriched channel payloads for pending rows they claimed.
 * Server upserts into channels and marks pending enriched/rejected/failed.
 */
export async function POST(request: NextRequest) {
  const token = extractBearerToken(request.headers.get("authorization"));
  const worker = await authenticateWorker(token);
  if (!worker?.id) {
    return workerJsonResponse(
      { error: "Invalid or missing database worker key (iw_…)" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const results = Array.isArray(body.results) ? body.results : [];
    if (results.length === 0) {
      return workerJsonResponse({ error: "results required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let imported = 0;
    let rejected = 0;
    let failed = 0;

    for (const row of results) {
      const pendingId = typeof row.pending_id === "string" ? row.pending_id : "";
      if (!pendingId) continue;

      const { data: pending } = await supabase
        .from("channel_pending")
        .select("id, enrich_claimed_by")
        .eq("id", pendingId)
        .maybeSingle();

      if (!pending || pending.enrich_claimed_by !== worker.id) {
        failed++;
        continue;
      }

      const status = row.status as string;
      if (status === "rejected" || status === "failed") {
        await supabase
          .from("channel_pending")
          .update({
            status,
            reject_reason:
              typeof row.reason === "string"
                ? row.reason.slice(0, 200)
                : status,
            enrich_claimed_by: null,
            enrich_claimed_at: null,
            enrich_claim_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pendingId);
        if (status === "rejected") rejected++;
        else failed++;
        continue;
      }

      const channel = row.channel;
      if (!channel || typeof channel !== "object" || !channel.id) {
        await supabase
          .from("channel_pending")
          .update({
            status: "failed",
            reject_reason: "missing channel payload",
            enrich_claimed_by: null,
            enrich_claimed_at: null,
            enrich_claim_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pendingId);
        failed++;
        continue;
      }

      const now = new Date().toISOString();
      const payload: Record<string, unknown> = withYoutubeMetricsExpiry(
        withChannelClassification({
          id: String(channel.id),
          handle: channel.handle ?? null,
          title: String(channel.title || "Unknown"),
          description: channel.description ?? null,
          thumbnail_url: channel.thumbnail_url ?? null,
          subscriber_count: channel.subscriber_count ?? null,
          view_count: channel.view_count ?? 0,
          video_count: channel.video_count ?? 0,
          country: channel.country ?? null,
          published_at: channel.published_at ?? null,
          email: channel.email ?? null,
          website: channel.website ?? null,
          instagram: channel.instagram ?? null,
          twitter: channel.twitter ?? null,
          tiktok: channel.tiktok ?? null,
          tier: channel.tier ?? null,
          data_source: "contributor",
          last_updated: now,
          updated_at: now,
        }, now),
        now
      );

      const { data: existing } = await supabase
        .from("channels")
        .select("id, email, website, instagram, twitter, tiktok, data_source")
        .eq("id", payload.id)
        .maybeSingle();

      if (existing?.data_source === "scraped" || existing?.data_source === "hybrid") {
        payload.data_source = existing.data_source;
      }
      if (existing?.email && !payload.email) {
        delete payload.email;
      }
      if (existing?.website && !payload.website) payload.website = existing.website;
      if (existing?.instagram && !payload.instagram)
        payload.instagram = existing.instagram;
      if (existing?.twitter && !payload.twitter) payload.twitter = existing.twitter;
      if (existing?.tiktok && !payload.tiktok) payload.tiktok = existing.tiktok;

      const { error: upsertErr } = await upsertChannelWithMetricsExpiry(
        supabase,
        payload,
        { onConflict: "id" }
      );

      if (upsertErr) {
        await supabase
          .from("channel_pending")
          .update({
            status: "failed",
            reject_reason: upsertErr.message.slice(0, 200),
            enrich_claimed_by: null,
            enrich_claimed_at: null,
            enrich_claim_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pendingId);
        failed++;
        continue;
      }

      await supabase
        .from("channel_pending")
        .update({
          status: "enriched",
          channel_id: payload.id as string,
          enrich_claimed_by: null,
          enrich_claimed_at: null,
          enrich_claim_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pendingId);

      imported++;
    }

    return workerJsonResponse({
      ok: true,
      imported,
      rejected,
      failed,
    });
  } catch (err) {
    return workerJsonResponse(
      { error: err instanceof Error ? err.message : "Enrich apply failed" },
      { status: 500 }
    );
  }
}
