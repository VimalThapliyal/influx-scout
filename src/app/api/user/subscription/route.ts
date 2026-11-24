import { NextResponse } from "next/server";
import { getUserSubscription } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";

export async function GET() {
  try {
    const sub = await getUserSubscription();
    return NextResponse.json({
      user: sub.user,
      isSubscribed: sub.isSubscribed,
      subscribedAt: sub.subscribedAt,
      plan: sub.plan,
      isAdmin: isAdminEmail(sub.user?.email),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
