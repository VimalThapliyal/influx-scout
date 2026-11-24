import { NextRequest } from "next/server";
import {
  authenticateWorker,
  extractBearerToken,
} from "@/lib/worker-auth";
import { releasePendingEnrich } from "@/lib/worker-claims";
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
    const body = await request.json();
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id: unknown) => typeof id === "string")
      : [];
    await releasePendingEnrich(worker, ids);
    return workerJsonResponse({ ok: true, released: ids.length });
  } catch (err) {
    return workerJsonResponse(
      { error: err instanceof Error ? err.message : "Release failed" },
      { status: 500 }
    );
  }
}
