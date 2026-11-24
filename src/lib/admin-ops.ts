import { getSupabaseAdmin } from "./supabase";

export type AdminOpsSnapshot = {
  generated_at: string;
  library: {
    channels: number;
    with_email: number;
    email_found: number;
    email_locked: number;
    email_not_available: number;
    with_contact_form: number;
    robots_disallowed: number;
    robots_checked: number;
    metrics_expired: number;
    metrics_unknown: number;
  };
  seeds: {
    available: number;
    claimed: number;
    done: number;
    failed: number;
  };
  pending: {
    unclaimed: number;
    claimed: number;
    enriched: number;
    rejected: number;
    failed: number;
  };
  workers: Array<{
    id: string;
    name: string;
    active: boolean;
    channels_submitted: number;
    channels_accepted: number;
    last_submit_at: string | null;
  }>;
  recent_failures: Array<{
    id: string;
    title: string | null;
    handle: string | null;
    reject_reason: string | null;
    updated_at: string | null;
  }>;
  robots_blocked_sample: Array<{
    id: string;
    title: string;
    website: string | null;
    website_robots_checked_at: string | null;
  }>;
  quota: {
    used: number;
    limit: number;
    remaining: number;
    percent_used: number;
  } | null;
};

async function countExact(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: PromiseLike<{ count: number | null; error: any }>
): Promise<number> {
  const { count, error } = await query;
  if (error) {
    // Missing column (migration not applied) → treat as 0
    if (/column|schema cache|does not exist/i.test(error.message ?? "")) {
      return 0;
    }
    throw new Error(error.message);
  }
  return count ?? 0;
}

export async function getAdminOpsSnapshot(): Promise<AdminOpsSnapshot> {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const [
    channels,
    withEmail,
    emailFound,
    emailLocked,
    emailNotAvailable,
    withContactForm,
    robotsDisallowed,
    robotsChecked,
    metricsExpired,
    metricsUnknown,
    seedsAvailable,
    seedsClaimed,
    seedsDone,
    seedsFailed,
    pendingUnclaimed,
    pendingClaimed,
    pendingEnriched,
    pendingRejected,
    pendingFailed,
  ] = await Promise.all([
    countExact(
      supabase.from("channels").select("*", { count: "exact", head: true })
    ),
    countExact(
      supabase
        .from("channels")
        .select("*", { count: "exact", head: true })
        .not("email", "is", null)
    ),
    countExact(
      supabase
        .from("channels")
        .select("*", { count: "exact", head: true })
        .eq("email_status", "found")
    ),
    countExact(
      supabase
        .from("channels")
        .select("*", { count: "exact", head: true })
        .eq("email_status", "locked")
    ),
    countExact(
      supabase
        .from("channels")
        .select("*", { count: "exact", head: true })
        .eq("email_status", "not_available")
    ),
    countExact(
      supabase
        .from("channels")
        .select("*", { count: "exact", head: true })
        .eq("has_contact_form", true)
    ),
    countExact(
      supabase
        .from("channels")
        .select("*", { count: "exact", head: true })
        .eq("website_robots_allowed", false)
    ),
    countExact(
      supabase
        .from("channels")
        .select("*", { count: "exact", head: true })
        .not("website_robots_checked_at", "is", null)
    ),
    countExact(
      supabase
        .from("channels")
        .select("*", { count: "exact", head: true })
        .lt("metrics_expires_at", nowIso)
    ),
    countExact(
      supabase
        .from("channels")
        .select("*", { count: "exact", head: true })
        .is("metrics_expires_at", null)
    ),
    countExact(
      supabase
        .from("seed_urls")
        .select("*", { count: "exact", head: true })
        .eq("status", "available")
    ),
    countExact(
      supabase
        .from("seed_urls")
        .select("*", { count: "exact", head: true })
        .eq("status", "claimed")
    ),
    countExact(
      supabase
        .from("seed_urls")
        .select("*", { count: "exact", head: true })
        .eq("status", "done")
    ),
    countExact(
      supabase
        .from("seed_urls")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed")
    ),
    countExact(
      supabase
        .from("channel_pending")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .is("enrich_claimed_by", null)
    ),
    countExact(
      supabase
        .from("channel_pending")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .not("enrich_claimed_by", "is", null)
    ),
    countExact(
      supabase
        .from("channel_pending")
        .select("*", { count: "exact", head: true })
        .eq("status", "enriched")
    ),
    countExact(
      supabase
        .from("channel_pending")
        .select("*", { count: "exact", head: true })
        .eq("status", "rejected")
    ),
    countExact(
      supabase
        .from("channel_pending")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed")
    ),
  ]);

  const { data: workers } = await supabase
    .from("scrape_workers")
    .select(
      "id, name, active, channels_submitted, channels_accepted, last_submit_at"
    )
    .order("last_submit_at", { ascending: false, nullsFirst: false })
    .limit(20);

  const { data: recentFailures } = await supabase
    .from("channel_pending")
    .select("id, title, handle, reject_reason, updated_at")
    .eq("status", "failed")
    .order("updated_at", { ascending: false })
    .limit(12);

  const { data: robotsSample } = await supabase
    .from("channels")
    .select("id, title, website, website_robots_checked_at")
    .eq("website_robots_allowed", false)
    .order("website_robots_checked_at", { ascending: false, nullsFirst: false })
    .limit(12);

  let quota: AdminOpsSnapshot["quota"] = null;
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${base}/api/health`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data.quota) quota = data.quota;
    }
  } catch {
    // optional
  }

  return {
    generated_at: nowIso,
    library: {
      channels,
      with_email: withEmail,
      email_found: emailFound,
      email_locked: emailLocked,
      email_not_available: emailNotAvailable,
      with_contact_form: withContactForm,
      robots_disallowed: robotsDisallowed,
      robots_checked: robotsChecked,
      metrics_expired: metricsExpired,
      metrics_unknown: metricsUnknown,
    },
    seeds: {
      available: seedsAvailable,
      claimed: seedsClaimed,
      done: seedsDone,
      failed: seedsFailed,
    },
    pending: {
      unclaimed: pendingUnclaimed,
      claimed: pendingClaimed,
      enriched: pendingEnriched,
      rejected: pendingRejected,
      failed: pendingFailed,
    },
    workers: (workers ?? []).map((w) => ({
      id: w.id,
      name: w.name,
      active: w.active !== false,
      channels_submitted: w.channels_submitted ?? 0,
      channels_accepted: w.channels_accepted ?? 0,
      last_submit_at: w.last_submit_at ?? null,
    })),
    recent_failures: (recentFailures ?? []).map((r) => ({
      id: r.id,
      title: r.title ?? null,
      handle: r.handle ?? null,
      reject_reason: r.reject_reason ?? null,
      updated_at: r.updated_at ?? null,
    })),
    robots_blocked_sample: (robotsSample ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      website: r.website ?? null,
      website_robots_checked_at: r.website_robots_checked_at ?? null,
    })),
    quota,
  };
}
