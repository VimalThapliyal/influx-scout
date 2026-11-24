import { NextRequest } from "next/server";
import {
  authenticateWorker,
  extractBearerToken,
} from "@/lib/worker-auth";
import { getContributorStatus } from "@/lib/worker-claims";
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
    return workerJsonResponse(
      { error: "Invalid or missing worker key" },
      { status: 401 }
    );
  }

  try {
    const status = await getContributorStatus(worker);
    return workerJsonResponse({ ok: true, ...status });
  } catch (err) {
    return workerJsonResponse(
      { error: err instanceof Error ? err.message : "Status failed" },
      { status: 500 }
    );
  }
}
