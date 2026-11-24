import { NextRequest } from "next/server";
import {
  authenticateWorker,
  extractBearerToken,
} from "@/lib/worker-auth";
import { completeSeedUrls } from "@/lib/worker-claims";
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
    const items = Array.isArray(body.items)
      ? body.items
          .filter((i: unknown) => i && typeof i === "object")
          .map((i: Record<string, unknown>) => ({
            id: String(i.id || ""),
            status:
              i.status === "failed" ? ("failed" as const) : ("done" as const),
            error: typeof i.error === "string" ? i.error : undefined,
          }))
          .filter((i: { id: string }) => i.id)
      : [];

    if (items.length === 0) {
      return workerJsonResponse({ error: "items required" }, { status: 400 });
    }

    const updated = await completeSeedUrls(worker, items);
    return workerJsonResponse({ ok: true, updated });
  } catch (err) {
    return workerJsonResponse(
      { error: err instanceof Error ? err.message : "Complete failed" },
      { status: 500 }
    );
  }
}
