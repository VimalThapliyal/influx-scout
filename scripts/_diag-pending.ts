import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { count: avail } = await s
    .from("seed_urls")
    .select("*", { count: "exact", head: true })
    .eq("status", "available");
  const { count: done } = await s
    .from("seed_urls")
    .select("*", { count: "exact", head: true })
    .eq("status", "done");
  const { count: claimed } = await s
    .from("seed_urls")
    .select("*", { count: "exact", head: true })
    .eq("status", "claimed");
  const { count: pending } = await s
    .from("channel_pending")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  const { count: failed } = await s
    .from("channel_pending")
    .select("*", { count: "exact", head: true })
    .eq("status", "failed");
  const { count: rejected } = await s
    .from("channel_pending")
    .select("*", { count: "exact", head: true })
    .eq("status", "rejected");

  console.log({ seeds: { avail, done, claimed }, pending, failed, rejected });

  const { data: sample } = await s
    .from("channel_pending")
    .select("url, channel_id, handle, title, status")
    .eq("status", "pending")
    .limit(20);
  console.log("pending sample:", JSON.stringify(sample, null, 2));

  const { data: recentFail } = await s
    .from("channel_pending")
    .select("url, channel_id, handle, reject_reason, status")
    .in("status", ["failed", "rejected"])
    .order("updated_at", { ascending: false })
    .limit(40);

  const reasons: Record<string, number> = {};
  for (const r of recentFail || []) {
    const k = r.reject_reason || "(none)";
    reasons[k] = (reasons[k] || 0) + 1;
  }
  console.log("recent fail/reject reasons:", reasons);
  const { data: recentFailOnly } = await s
    .from("channel_pending")
    .select("url, channel_id, handle, reject_reason")
    .eq("status", "failed")
    .order("updated_at", { ascending: false })
    .limit(100);
  const failReasons: Record<string, number> = {};
  for (const r of recentFailOnly || []) {
    const k = r.reject_reason || "(none)";
    failReasons[k] = (failReasons[k] || 0) + 1;
  }
  console.log("recent FAILED only:", failReasons);

  const { count: junk } = await s
    .from("channel_pending")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")
    .like("handle", "%.%");
  const { count: withId } = await s
    .from("channel_pending")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")
    .not("channel_id", "is", null);
  console.log({ junkDotHandlesPending: junk, pendingWithUcId: withId });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
