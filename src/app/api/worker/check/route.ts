import { NextRequest } from "next/server";
import {
  authenticateWorker,
  extractBearerToken,
} from "@/lib/worker-auth";
import { checkChannelsInLibrary } from "@/lib/worker-check";
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
    return workerJsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const urls: string[] = Array.isArray(body.urls)
      ? body.urls.filter((u: unknown) => typeof u === "string").slice(0, 50)
      : [];

    if (urls.length === 0) {
      return workerJsonResponse(
        { error: "Provide urls[] to check" },
        { status: 400 }
      );
    }

    const statuses = await checkChannelsInLibrary(urls);

    return workerJsonResponse({
      ok: true,
      statuses,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Check failed";
    return workerJsonResponse({ error: message }, { status: 500 });
  }
}
