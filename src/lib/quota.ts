import { getSupabaseAdmin } from "./supabase";
import { DAILY_QUOTA_LIMIT } from "./scoring";

const PACIFIC_TZ = "America/Los_Angeles";
const IST_TZ = "Asia/Kolkata";
const GOOGLE_QUOTA_OP = "google.quotaExceeded";

/** YouTube API daily quota resets at midnight Pacific time. */
export function getPacificDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PACIFIC_TZ }).format(date);
}

function addCalendarDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Exact UTC instant when Pacific calendar date `ymd` starts (midnight PT). */
export function getPacificMidnightForYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const startSearch = Date.UTC(y, m - 1, d - 1, 0, 0, 0);
  const endSearch = Date.UTC(y, m - 1, d + 1, 12, 0, 0);

  for (let t = startSearch; t < endSearch; t += 15 * 60 * 1000) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: PACIFIC_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(t));
    const map = Object.fromEntries(
      parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value])
    );
    const dayStr = `${map.year}-${map.month}-${map.day}`;
    const hour = map.hour === "24" ? "00" : map.hour;
    if (dayStr === ymd && hour === "00" && map.minute === "00") {
      return new Date(t);
    }
  }

  // Fallback: assume PDT (UTC-7) if DST search fails
  return new Date(Date.UTC(y, m - 1, d, 7, 0, 0));
}

export function getPacificDayStartUtc(date = new Date()): Date {
  return getPacificMidnightForYmd(getPacificDateString(date));
}

/** Next YouTube quota reset = next Pacific midnight. */
export function getNextQuotaResetUtc(now = new Date()): Date {
  const tomorrowPacific = addCalendarDaysYmd(getPacificDateString(now), 1);
  return getPacificMidnightForYmd(tomorrowPacific);
}

function formatInTz(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone, ...options }).format(date);
}

function formatResetCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const totalMin = Math.ceil(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function getQuotaResetInfo(now = new Date()) {
  const resetsAt = getNextQuotaResetUtc(now);
  const msLeft = resetsAt.getTime() - now.getTime();
  const resetsIn = formatResetCountdown(msLeft);
  const resetsAtIst = formatInTz(resetsAt, IST_TZ, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const resetsAtPacific = formatInTz(resetsAt, PACIFIC_TZ, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
  const nowIst = formatInTz(now, IST_TZ, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const nowPacific = formatInTz(now, PACIFIC_TZ, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });

  return {
    now_ist: nowIst,
    now_pacific: nowPacific,
    resets_at_utc: resetsAt.toISOString(),
    resets_at_ist: resetsAtIst,
    resets_at_pacific: resetsAtPacific,
    resets_in: resetsIn,
    resets_in_minutes: Math.max(0, Math.ceil(msLeft / 60_000)),
    reset_note: `Resets in ${resetsIn} — ${resetsAtIst} IST (midnight Pacific).`,
  };
}

export function getQuotaResetNote(now = new Date()): string {
  return getQuotaResetInfo(now).reset_note;
}

export function isGoogleQuotaExceededBody(body: string, status: number): boolean {
  const lower = body.toLowerCase();
  if (
    lower.includes("ratelimitexceeded") ||
    lower.includes("userratelimitexceeded")
  ) {
    return false;
  }

  try {
    const json = JSON.parse(body) as {
      error?: { errors?: Array<{ reason?: string }> };
    };
    const reason = json.error?.errors?.[0]?.reason ?? "";
    if (reason === "rateLimitExceeded" || reason === "userRateLimitExceeded") {
      return false;
    }
    return reason === "quotaExceeded" || reason === "dailyLimitExceeded";
  } catch {
    if (status === 403 && lower.includes("quotaexceeded")) return true;
    return lower.includes("dailylimitexceeded");
  }
}

async function isGoogleQuotaKnownExhausted(): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const dayStart = getPacificDayStartUtc().toISOString();

  const { data } = await supabase
    .from("api_quota_log")
    .select("id")
    .eq("operation", GOOGLE_QUOTA_OP)
    .gte("created_at", dayStart)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

export async function recordGoogleQuotaExhausted(): Promise<void> {
  const supabase = getSupabaseAdmin();
  const today = getPacificDateString();

  await supabase.from("api_quota_log").insert({
    date: today,
    units_used: 0,
    operation: GOOGLE_QUOTA_OP,
  });
}

export async function getQuotaUsedToday(): Promise<number> {
  const supabase = getSupabaseAdmin();
  const dayStart = getPacificDayStartUtc().toISOString();

  const { data } = await supabase
    .from("api_quota_log")
    .select("units_used")
    .gte("created_at", dayStart)
    .neq("operation", GOOGLE_QUOTA_OP);

  return data?.reduce((sum, row) => sum + row.units_used, 0) ?? 0;
}

export async function checkQuota(cost: number): Promise<void> {
  if (await isGoogleQuotaKnownExhausted()) {
    throw new GoogleQuotaExceededError();
  }

  const used = await getQuotaUsedToday();
  if (used + cost > DAILY_QUOTA_LIMIT) {
    throw new QuotaExceededError(used, cost);
  }
}

export async function consumeQuota(
  cost: number,
  operation: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const today = getPacificDateString();

  await supabase.from("api_quota_log").insert({
    date: today,
    units_used: cost,
    operation,
  });
}

export class QuotaExceededError extends Error {
  constructor(public used: number, public requested: number) {
    super(
      `YouTube API quota exceeded: ${used}/${DAILY_QUOTA_LIMIT} used, requested ${requested} more. ${getQuotaResetNote()}`
    );
    this.name = "QuotaExceededError";
  }
}

export class GoogleQuotaExceededError extends Error {
  constructor() {
    super(
      `Google YouTube API daily quota exhausted for today. ${getQuotaResetNote()}`
    );
    this.name = "GoogleQuotaExceededError";
  }
}

export function isQuotaError(error: unknown): boolean {
  return (
    error instanceof QuotaExceededError ||
    error instanceof GoogleQuotaExceededError ||
    (error instanceof Error &&
      (error.message.toLowerCase().includes("quota exceeded") ||
        error.message.toLowerCase().includes("quotaexceeded")))
  );
}

export async function getQuotaStatus() {
  const used = await getQuotaUsedToday();
  const googleExhausted = await isGoogleQuotaKnownExhausted();
  const remaining = googleExhausted ? 0 : DAILY_QUOTA_LIMIT - used;
  const reset = getQuotaResetInfo();

  return {
    used,
    limit: DAILY_QUOTA_LIMIT,
    remaining,
    percent_used: Math.round((used / DAILY_QUOTA_LIMIT) * 100),
    pacific_date: getPacificDateString(),
    google_quota_exhausted: googleExhausted,
    ...reset,
  };
}
