import { NextRequest, NextResponse } from "next/server";
import { generateAiEmail, generateTemplateEmail, type OutreachRequest } from "@/lib/outreach";
import { canViewEmails, getSessionUser } from "@/lib/auth";

/** AI drafts per user per hour. Best-effort (per serverless instance). */
const AI_LIMIT_PER_HOUR = 30;
const aiUsage = new Map<string, number[]>();

function allowAiCall(userId: string, now = Date.now()): boolean {
  const windowStart = now - 60 * 60 * 1000;
  const recent = (aiUsage.get(userId) ?? []).filter((t) => t > windowStart);
  if (recent.length >= AI_LIMIT_PER_HOUR) {
    aiUsage.set(userId, recent);
    return false;
  }
  recent.push(now);
  aiUsage.set(userId, recent);
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in to draft outreach emails" }, { status: 401 });
    }

    const body = (await request.json()) as OutreachRequest;

    if (!body.channel?.title || !body.brandName?.trim() || !body.senderName?.trim()) {
      return NextResponse.json(
        { error: "Channel, brand name, and your name are required" },
        { status: 400 }
      );
    }

    const req: OutreachRequest = {
      channel: {
        ...body.channel,
        description: body.channel.description?.slice(0, 1000) ?? null,
      },
      brandName: body.brandName.trim().slice(0, 120),
      senderName: body.senderName.trim().slice(0, 120),
      goal: body.goal ?? "brand_partnership",
      tone: body.tone ?? "professional",
      campaignName: body.campaignName?.slice(0, 120),
      customNotes: body.customNotes?.slice(0, 1000),
    };

    // AI drafts cost money: paid plans only, rate-limited. Everyone else gets the template.
    const useAi = (await canViewEmails()) && allowAiCall(user.id);
    const email = useAi ? await generateAiEmail(req) : generateTemplateEmail(req);

    return NextResponse.json(email);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
