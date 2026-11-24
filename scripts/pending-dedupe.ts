#!/usr/bin/env tsx
/**
 * Mark pending rows already present in `channels` so enrich won't burn quota.
 *   npm run pending:dedupe
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let markedById = 0;
  let markedByHandle = 0;
  let page = 0;
  const pageSize = 500;

  // 1) Pending with channel_id already in channels
  for (;;) {
    const { data: pending, error } = await s
      .from("channel_pending")
      .select("id, channel_id")
      .eq("status", "pending")
      .not("channel_id", "is", null)
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) throw error;
    if (!pending?.length) break;

    const ids = pending
      .map((p) => p.channel_id)
      .filter((id): id is string => !!id && /^UC[\w-]{22}$/i.test(id));

    if (ids.length) {
      const { data: existing } = await s
        .from("channels")
        .select("id")
        .in("id", ids);
      const have = new Set((existing || []).map((r) => r.id));
      const toMark = pending
        .filter((p) => p.channel_id && have.has(p.channel_id))
        .map((p) => p.id);

      for (let i = 0; i < toMark.length; i += 100) {
        const batch = toMark.slice(i, i + 100);
        const { error: upErr } = await s
          .from("channel_pending")
          .update({
            status: "enriched",
            reject_reason: "already in channels (deduped)",
            enrich_claimed_by: null,
            enrich_claimed_at: null,
            enrich_claim_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .in("id", batch)
          .eq("status", "pending");
        if (!upErr) markedById += batch.length;
      }
    }

    if (pending.length < pageSize) break;
    page++;
  }

  // 2) Pending with handle already in channels (no channel_id)
  page = 0;
  for (;;) {
    const { data: pending, error } = await s
      .from("channel_pending")
      .select("id, handle")
      .eq("status", "pending")
      .is("channel_id", null)
      .not("handle", "is", null)
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) throw error;
    if (!pending?.length) break;

    const handles = Array.from(
      new Set(
        pending
          .map((p) => p.handle)
          .filter((h): h is string => !!h && h.length > 2)
      )
    );

    if (handles.length) {
      const { data: existing } = await s
        .from("channels")
        .select("id, handle")
        .in("handle", handles);
      const have = new Set(
        (existing || []).map((r) => r.handle).filter(Boolean) as string[]
      );
      const toMark = pending
        .filter((p) => p.handle && have.has(p.handle))
        .map((p) => p.id);

      for (let i = 0; i < toMark.length; i += 100) {
        const batch = toMark.slice(i, i + 100);
        const { error: upErr } = await s
          .from("channel_pending")
          .update({
            status: "enriched",
            reject_reason: "already in channels by handle (deduped)",
            enrich_claimed_by: null,
            enrich_claimed_at: null,
            enrich_claim_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .in("id", batch)
          .eq("status", "pending");
        if (!upErr) markedByHandle += batch.length;
      }
    }

    if (pending.length < pageSize) break;
    page++;
  }

  const { count: pendingLeft } = await s
    .from("channel_pending")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  console.log({
    markedByChannelId: markedById,
    markedByHandle: markedByHandle,
    pendingLeft,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
