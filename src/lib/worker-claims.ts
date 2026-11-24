import { getSupabaseAdmin } from "./supabase";
import type { WorkerIdentity } from "./worker-auth";

export type SeedUrlRow = {
  id: string;
  url: string;
  url_norm: string;
  niche: string | null;
  title: string | null;
  status: string;
};

export type PendingClaimRow = {
  id: string;
  url: string;
  channel_id: string | null;
  handle: string | null;
  title: string | null;
  subscriber_count: number | null;
};

export async function claimSeedUrls(
  worker: WorkerIdentity,
  limit = 10
): Promise<SeedUrlRow[]> {
  if (!worker.id) {
    throw new Error(
      "Env worker token cannot claim seeds — create a database worker key (iw_…)"
    );
  }
  const supabase = getSupabaseAdmin();

  async function claimOnce(): Promise<SeedUrlRow[]> {
    const { data, error } = await supabase.rpc("claim_seed_urls", {
      p_worker_id: worker.id,
      p_limit: limit,
      p_lease_minutes: 30,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as SeedUrlRow[];
  }

  let seeds = await claimOnce();
  if (seeds.length > 0) return seeds;

  // Pool empty: recycle oldest done list URLs (pages update over time)
  const recycleN = Math.max(limit * 3, 24);
  const { data: doneRows } = await supabase
    .from("seed_urls")
    .select("id")
    .eq("status", "done")
    .order("done_at", { ascending: true })
    .limit(recycleN);

  const ids = (doneRows || []).map((r) => r.id);
  if (ids.length === 0) return [];

  await supabase
    .from("seed_urls")
    .update({
      status: "available",
      claimed_by: null,
      claimed_at: null,
      claim_expires_at: null,
      done_at: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);

  seeds = await claimOnce();
  return seeds;
}

export async function completeSeedUrls(
  worker: WorkerIdentity,
  items: Array<{ id: string; status: "done" | "failed"; error?: string }>
): Promise<number> {
  if (!worker.id || items.length === 0) return 0;
  const supabase = getSupabaseAdmin();
  let updated = 0;
  for (const item of items) {
    const { error, count } = await supabase
      .from("seed_urls")
      .update({
        status: item.status,
        done_at: item.status === "done" ? new Date().toISOString() : null,
        last_error: item.error?.slice(0, 400) ?? null,
        claimed_by: worker.id,
        claim_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id)
      .eq("claimed_by", worker.id);
    if (!error) updated += count ?? 1;
  }
  return updated;
}

export async function claimPendingEnrich(
  worker: WorkerIdentity,
  limit = 50
): Promise<PendingClaimRow[]> {
  if (!worker.id) {
    throw new Error(
      "Env worker token cannot claim pending — create a database worker key (iw_…)"
    );
  }
  const supabase = getSupabaseAdmin();

  async function claimOnce(n: number): Promise<PendingClaimRow[]> {
    const { data, error } = await supabase.rpc("claim_pending_enrich", {
      p_worker_id: worker.id,
      p_limit: n,
      p_lease_minutes: 45,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as PendingClaimRow[];
  }

  /** Drop rows already in channels — no YouTube quota wasted. */
  async function stripAlreadySaved(
    rows: PendingClaimRow[]
  ): Promise<PendingClaimRow[]> {
    if (rows.length === 0) return [];

    const channelIds = Array.from(
      new Set(
        rows
          .map((r) => r.channel_id)
          .filter((id): id is string => !!id && /^UC[\w-]{22}$/i.test(id))
      )
    );
    const handles = Array.from(
      new Set(
        rows
          .map((r) => r.handle)
          .filter((h): h is string => !!h && h.length > 2)
      )
    );

    const haveIds = new Set<string>();
    const haveHandles = new Set<string>();

    if (channelIds.length) {
      const { data } = await supabase
        .from("channels")
        .select("id")
        .in("id", channelIds);
      for (const r of data || []) haveIds.add(r.id);
    }
    if (handles.length) {
      const { data } = await supabase
        .from("channels")
        .select("handle")
        .in("handle", handles);
      for (const r of data || []) {
        if (r.handle) haveHandles.add(r.handle);
      }
    }

    const keep: PendingClaimRow[] = [];
    const dupIds: string[] = [];

    for (const row of rows) {
      const dup =
        (row.channel_id && haveIds.has(row.channel_id)) ||
        (row.handle && haveHandles.has(row.handle));
      if (dup) dupIds.push(row.id);
      else keep.push(row);
    }

    if (dupIds.length) {
      await supabase
        .from("channel_pending")
        .update({
          status: "enriched",
          reject_reason: "already in channels (deduped on claim)",
          enrich_claimed_by: null,
          enrich_claimed_at: null,
          enrich_claim_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .in("id", dupIds)
        .eq("enrich_claimed_by", worker.id);
    }

    return keep;
  }

  let kept = await stripAlreadySaved(await claimOnce(limit));

  // Top up if many were duplicates
  let attempts = 0;
  while (kept.length < limit && attempts < 3) {
    attempts++;
    const need = limit - kept.length;
    const more = await stripAlreadySaved(await claimOnce(need));
    if (more.length === 0) break;
    const seen = new Set(kept.map((r) => r.id));
    for (const r of more) {
      if (!seen.has(r.id)) kept.push(r);
    }
  }

  return kept.slice(0, limit);
}

export async function releasePendingEnrich(
  worker: WorkerIdentity,
  pendingIds: string[]
): Promise<void> {
  if (!worker.id || pendingIds.length === 0) return;
  const supabase = getSupabaseAdmin();
  await supabase
    .from("channel_pending")
    .update({
      enrich_claimed_by: null,
      enrich_claimed_at: null,
      enrich_claim_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("enrich_claimed_by", worker.id)
    .in("id", pendingIds);
}

export async function getContributorStatus(worker: WorkerIdentity) {
  const supabase = getSupabaseAdmin();

  const [
    availableSeeds,
    claimedSeeds,
    doneSeeds,
    pendingUnclaimed,
    pendingClaimed,
  ] = await Promise.all([
    supabase
      .from("seed_urls")
      .select("*", { count: "exact", head: true })
      .eq("status", "available"),
    supabase
      .from("seed_urls")
      .select("*", { count: "exact", head: true })
      .eq("status", "claimed"),
    supabase
      .from("seed_urls")
      .select("*", { count: "exact", head: true })
      .eq("status", "done"),
    supabase
      .from("channel_pending")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .is("enrich_claimed_by", null),
    supabase
      .from("channel_pending")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .not("enrich_claimed_by", "is", null),
  ]);

  let workerStats: {
    name: string;
    channels_submitted: number;
    channels_accepted: number;
    last_submit_at: string | null;
  } | null = null;

  if (worker.id) {
    const { data } = await supabase
      .from("scrape_workers")
      .select("name, channels_submitted, channels_accepted, last_submit_at")
      .eq("id", worker.id)
      .maybeSingle();
    workerStats = data;
  }

  return {
    seeds: {
      available: availableSeeds.count ?? 0,
      claimed: claimedSeeds.count ?? 0,
      done: doneSeeds.count ?? 0,
    },
    pending: {
      unclaimed: pendingUnclaimed.count ?? 0,
      claimed: pendingClaimed.count ?? 0,
    },
    worker: workerStats
      ? {
          name: workerStats.name,
          submitted: workerStats.channels_submitted,
          accepted: workerStats.channels_accepted,
          last_submit_at: workerStats.last_submit_at,
        }
      : { name: worker.name, submitted: 0, accepted: 0, last_submit_at: null },
  };
}
