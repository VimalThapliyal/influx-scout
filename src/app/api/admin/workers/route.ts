import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generateWorkerKey, hashWorkerKey } from "@/lib/worker-auth";

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim().slice(0, 100);
  const label = String(body?.label ?? "").trim().slice(0, 100) || null;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const rawKey = generateWorkerKey();
  const hash = hashWorkerKey(rawKey);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("scrape_workers")
    .insert({ name, label, api_key_hash: hash })
    .select("id, name, label, active, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Raw key is only ever returned once -- only the hash is stored.
  return NextResponse.json({ worker: data, key: rawKey });
}
