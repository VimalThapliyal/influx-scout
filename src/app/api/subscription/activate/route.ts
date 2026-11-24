import { NextRequest, NextResponse } from "next/server";
import { activateSubscription, getSessionUser } from "@/lib/auth";
import { grantSubscription, retrieveCheckoutSession, sessionGrantsAccess } from "@/lib/stripe";
import { PAYMENTS_ENABLED } from "@/lib/billing";

/**
 * Activate after checkout. Never trusts the client: a stripe_session_id is
 * looked up with Stripe's API and must be complete, paid, and created for
 * this signed-in user (client_reference_id). The webhook is the primary
 * path; this only makes the success redirect feel instant.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    // Local development only — never honoured in production builds.
    const demoMode =
      process.env.SUBSCRIPTION_DEMO_MODE === "true" && process.env.NODE_ENV !== "production";

    if (!PAYMENTS_ENABLED && !demoMode) {
      return NextResponse.json({ error: "Pro plans are not available yet" }, { status: 503 });
    }

    if (demoMode) {
      const ok = await activateSubscription(user.id, "pro");
      return ok
        ? NextResponse.json({ success: true, isSubscribed: true })
        : NextResponse.json({ error: "Failed to activate subscription" }, { status: 500 });
    }

    const sessionId = typeof body.stripe_session_id === "string" ? body.stripe_session_id : "";
    if (!sessionId) {
      return NextResponse.json({ error: "Payment required" }, { status: 402 });
    }

    const session = await retrieveCheckoutSession(sessionId);
    if (!session || !sessionGrantsAccess(session, user.id)) {
      return NextResponse.json({ error: "Payment not verified" }, { status: 402 });
    }

    const ok = await grantSubscription(user.id, session);
    if (!ok) {
      return NextResponse.json({ error: "Failed to activate subscription" }, { status: 500 });
    }

    return NextResponse.json({ success: true, isSubscribed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Activation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
