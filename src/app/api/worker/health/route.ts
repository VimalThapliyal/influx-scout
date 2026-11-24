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

export async function OPTIONS() {
  return workerOptionsResponse();
}

export async function GET(request: NextRequest) {
  const token = extractBearerToken(request.headers.get("authorization"));
  const worker = await authenticateWorker(token);

  if (!worker) {
    return workerJsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { count } = await supabase
      .from("channels")
      .select("*", { count: "exact", head: true })
      .eq("country", "US");

    return workerJsonResponse({
      ok: true,
      worker: worker.name,
      usa_channels: count ?? 0,
      api_url: process.env.NEXT_PUBLIC_APP_URL ?? "https://influencer-platform-mu.vercel.app",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Health check failed";
    return workerJsonResponse({ error: message }, { status: 500 });
  }
}
