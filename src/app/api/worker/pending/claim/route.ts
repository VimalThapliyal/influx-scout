import { NextRequest } from "next/server";
import {
  authenticateWorker,
  extractBearerToken,
} from "@/lib/worker-auth";
import { claimPendingEnrich } from "@/lib/worker-claims";
import {
  workerJsonResponse,
  workerOptionsResponse,
} from "@/lib/worker-cors";

export async function OPTIONS() {
  return workerOptionsResponse();
}

export async function POST(request: NextRequest) {
  const token = extractBearerToken(request.headers.get("authorization"));
  const worker = await authenticateWorker(token);
  if (!worker) {
    return workerJsonResponse(
      { error: "Invalid or missing worker key" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const limit =
      typeof body.limit === "number"
        ? Math.max(1, Math.min(200, body.limit))
        : 50;
    const rows = await claimPendingEnrich(worker, limit);
    return workerJsonResponse({
      ok: true,
      claimed: rows.length,
      pending: rows.map((r) => ({
        id: r.id,
        url: r.url,
        channel_id: r.channel_id,
        handle: r.handle,
        title: r.title,
        subscriber_count: r.subscriber_count,
      })),
    });
  } catch (err) {
    return workerJsonResponse(
      { error: err instanceof Error ? err.message : "Claim failed" },
      { status: 500 }
    );
  }
}
