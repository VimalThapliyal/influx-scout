/**
 * Inspect low-activity Scout channels without deleting saved leads.
 *
 *   npx tsx scripts/cleanup-scout-junk.ts --dry-run
 *   npx tsx scripts/cleanup-scout-junk.ts --apply
 *   npx tsx scripts/cleanup-scout-junk.ts --apply --max-subs 10 --max-videos 2
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
if (args.includes("--apply")) {
  throw new Error("Channel deletion is disabled. Keep saved leads and use quality filters to exclude unsuitable channels.");
}
const apply = false;
const dryRun = !apply;
const maxSubs = (() => {
  const i = args.indexOf("--max-subs");
  return i >= 0 ? parseInt(args[i + 1], 10) : 10;
})();
const maxVideos = (() => {
  const i = args.indexOf("--max-videos");
  return i >= 0 ? parseInt(args[i + 1], 10) : 2;
})();
const onlyScout = !args.includes("--all-sources");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing Supabase env");

  const supabase = createClient(url, key);
  console.log(
    `${dryRun ? "DRY RUN" : "APPLY"} — delete channels with subs≤${maxSubs} and videos≤${maxVideos}` +
      (onlyScout ? " and discovery_source like scout:%" : "")
  );

  let query = supabase
    .from("channels")
    .select("id, title, subscriber_count, video_count, discovery_source, last_updated")
    .lte("subscriber_count", maxSubs)
    .lte("video_count", maxVideos)
    .order("last_updated", { ascending: false })
    .limit(5000);

  if (onlyScout) {
    query = query.like("discovery_source", "scout:%");
  }

  const { data, error } = await query;
  if (error) {
    // discovery_source may be missing if migration 019 not applied
    if (/discovery_source/i.test(error.message)) {
      console.warn("discovery_source missing — scanning by subs/videos only");
      const retry = await supabase
        .from("channels")
        .select("id, title, subscriber_count, video_count, last_updated")
        .lte("subscriber_count", maxSubs)
        .lte("video_count", maxVideos)
        .order("last_updated", { ascending: false })
        .limit(5000);
      if (retry.error) throw retry.error;
      await deleteRows(supabase, retry.data || [], dryRun);
      return;
    }
    throw error;
  }

  await deleteRows(supabase, data || [], dryRun);
}

async function deleteRows(
  supabase: ReturnType<typeof createClient>,
  rows: { id: string; title?: string; subscriber_count?: number; video_count?: number }[],
  dry: boolean
) {
  console.log(`Matched ${rows.length} junk channels`);
  for (const r of rows.slice(0, 15)) {
    console.log(
      `  ${r.title}  ${r.subscriber_count ?? 0} subs / ${r.video_count ?? 0} videos`
    );
  }
  if (rows.length > 15) console.log(`  … +${rows.length - 15} more`);

  if (dry) {
    console.log("\nReport only. Saved channels are retained.");
    return;
  }

  throw new Error("Permanent channel deletion is disabled.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
