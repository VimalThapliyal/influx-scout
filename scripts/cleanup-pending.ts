#!/usr/bin/env tsx
/**
 * Mark channel_pending rows as enriched when they already exist in channels.
 * Also fail rows with truncated/invalid YouTube channel IDs.
 *
 *   npm run cleanup:pending
 *   npm run cleanup:pending -- --dry-run
 *   npm run cleanup:pending -- --delete
 */

import { loadEnv } from "./lib/env";

loadEnv();

import { createClient } from "@supabase/supabase-js";
import { isValidYouTubeChannelId } from "../src/lib/youtube-url";

interface CliArgs {
  dryRun: boolean;
  hardDelete: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dryRun: false, hardDelete: false };
  for (const a of argv) {
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--delete") args.hardDelete = true;
    else if (a === "--help" || a === "-h") {
      console.log(`
Cleanup channel_pending vs channels library

  --dry-run   Report only, no writes
  --delete    Hard-delete matches (default: mark status=enriched / failed)
`);
      process.exit(0);
    }
  }
  return args;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

function normHandle(h: string | null | undefined): string | null {
  if (!h) return null;
  const t = h.trim().replace(/^@/, "").toLowerCase();
  return t || null;
}

async function fetchAllChannelKeys(supabase: ReturnType<typeof getSupabase>) {
  const ids = new Set<string>();
  const handles = new Set<string>();
  const pageSize = 1000;
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("channels")
      .select("id, handle")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      if (row.id) ids.add(row.id);
      const h = normHandle(row.handle);
      if (h) handles.add(h);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return { ids, handles };
}

async function updateBatch(
  supabase: ReturnType<typeof getSupabase>,
  ids: string[],
  hardDelete: boolean,
  patch: { status: string; reject_reason: string; updated_at: string }
) {
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    if (hardDelete) {
      const { error } = await supabase
        .from("channel_pending")
        .delete()
        .in("id", batch);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("channel_pending")
        .update(patch)
        .in("id", batch);
      if (error) throw error;
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = getSupabase();

  const { count: pendingBefore } = await supabase
    .from("channel_pending")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const { count: libraryCount } = await supabase
    .from("channels")
    .select("id", { count: "exact", head: true });

  console.log(`
╔══════════════════════════════════════════╗
║  Cleanup pending vs library              ║
╚══════════════════════════════════════════╝
  pending (status=pending): ${pendingBefore ?? 0}
  channels library:         ${libraryCount ?? 0}
  mode: ${args.dryRun ? "DRY-RUN" : args.hardDelete ? "DELETE matches" : "MARK enriched/failed"}
`);

  console.log("Loading library keys…");
  const { ids, handles } = await fetchAllChannelKeys(supabase);
  console.log(`  library ids=${ids.size} handles=${handles.size}`);

  const alreadyInLibrary: string[] = [];
  const invalidIds: string[] = [];
  const pageSize = 500;
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("channel_pending")
      .select("id, channel_id, handle, url")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;

    for (const row of data) {
      if (row.channel_id && ids.has(row.channel_id)) {
        alreadyInLibrary.push(row.id);
        continue;
      }
      const h = normHandle(row.handle);
      if (h && handles.has(h)) {
        alreadyInLibrary.push(row.id);
        continue;
      }
      // Truncated scrape junk e.g. UCkjjH0hsv (must be UC + 22 chars)
      if (row.channel_id && !isValidYouTubeChannelId(row.channel_id)) {
        invalidIds.push(row.id);
        continue;
      }
      if (
        !row.channel_id &&
        !h &&
        row.url &&
        /\/channel\/UC[\w-]{1,21}(?:[/?#]|$)/i.test(row.url) &&
        !/\/channel\/UC[\w-]{22}(?:[/?#]|$)/i.test(row.url)
      ) {
        invalidIds.push(row.id);
      }
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  const remaining =
    (pendingBefore ?? 0) - alreadyInLibrary.length - invalidIds.length;

  console.log(`\n  already in library: ${alreadyInLibrary.length}`);
  console.log(`  invalid channel ids: ${invalidIds.length}`);
  console.log(`  remaining after cleanup: ${Math.max(0, remaining)}`);

  if (args.dryRun) {
    console.log(
      "\nDry-run — nothing changed. Re-run without --dry-run to apply."
    );
    return;
  }

  if (alreadyInLibrary.length === 0 && invalidIds.length === 0) {
    console.log("\nNothing to clean.");
    return;
  }

  const now = new Date().toISOString();
  if (alreadyInLibrary.length > 0) {
    await updateBatch(supabase, alreadyInLibrary, args.hardDelete, {
      status: "enriched",
      reject_reason: "already in channels library",
      updated_at: now,
    });
  }
  if (invalidIds.length > 0) {
    await updateBatch(supabase, invalidIds, args.hardDelete, {
      status: "failed",
      reject_reason: "invalid/truncated YouTube channel id",
      updated_at: now,
    });
  }

  const { count: pendingAfter } = await supabase
    .from("channel_pending")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  console.log(`
──────────────────────────────────────────
Cleared (in library): ${alreadyInLibrary.length}
Failed (bad ids):     ${invalidIds.length}
Left pending:         ${pendingAfter ?? 0}
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
