import { createHash, randomBytes } from "crypto";
import { getSupabaseAdmin } from "./supabase";

export const WORKER_KEY_PREFIX = "iw_";

export interface WorkerIdentity {
  id: string | null;
  name: string;
  source: "database" | "env";
}

export function hashWorkerKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateWorkerKey(): string {
  return `${WORKER_KEY_PREFIX}${randomBytes(24).toString("hex")}`;
}

export function extractBearerToken(
  authHeader: string | null
): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

export async function authenticateWorker(
  token: string | null
): Promise<WorkerIdentity | null> {
  if (!token) return null;

  const envToken = process.env.WORKER_SUBMIT_TOKEN?.trim();
  if (envToken && token === envToken) {
    return { id: null, name: "env-token", source: "env" };
  }

  if (!token.startsWith(WORKER_KEY_PREFIX)) return null;

  const supabase = getSupabaseAdmin();
  const hash = hashWorkerKey(token);

  const { data, error } = await supabase
    .from("scrape_workers")
    .select("id, name")
    .eq("api_key_hash", hash)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) return null;
  return { id: data.id, name: data.name, source: "database" };
}

export async function recordWorkerSubmit(
  worker: WorkerIdentity,
  submitted: number,
  accepted: number
): Promise<void> {
  if (!worker.id) return;

  const supabase = getSupabaseAdmin();
  const { data: row } = await supabase
    .from("scrape_workers")
    .select("channels_submitted, channels_accepted")
    .eq("id", worker.id)
    .maybeSingle();

  await supabase
    .from("scrape_workers")
    .update({
      channels_submitted: (row?.channels_submitted ?? 0) + submitted,
      channels_accepted: (row?.channels_accepted ?? 0) + accepted,
      last_submit_at: new Date().toISOString(),
    })
    .eq("id", worker.id);
}
