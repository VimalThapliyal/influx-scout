import { NextResponse } from "next/server";
import { getQuotaStatus } from "@/lib/quota";

export async function GET() {
  try {
    const quota = await getQuotaStatus();
    return NextResponse.json(
      { status: "ok", quota },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Health check failed";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
