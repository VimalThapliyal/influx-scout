import { NextRequest, NextResponse } from "next/server";
import { getChannelVideos } from "@/lib/youtube";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "6", 10), 12);
    const sortParam = searchParams.get("sort");
    const sort = sortParam === "popular" ? "popular" : "recent";
    const videos = await getChannelVideos(params.id, limit, sort);
    return NextResponse.json({ videos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch videos";
    const status = message.includes("quota") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
