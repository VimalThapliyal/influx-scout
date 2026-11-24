import { NextRequest } from "next/server";
import {
  authenticateWorker,
  extractBearerToken,
} from "@/lib/worker-auth";
import { claimSeedUrls } from "@/lib/worker-claims";
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
        ? Math.max(1, Math.min(50, body.limit))
        : 10;
    const seeds = await claimSeedUrls(worker, limit);
    return workerJsonResponse({
      ok: true,
      claimed: seeds.length,
      seeds: seeds.map((s) => ({
        id: s.id,
        url: s.url,
        niche: s.niche,
        title: s.title,
      })),
    });
  } catch (err) {
    return workerJsonResponse(
      { error: err instanceof Error ? err.message : "Claim failed" },
      { status: 500 }
    );
  }
}
