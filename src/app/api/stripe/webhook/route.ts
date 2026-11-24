import { NextRequest, NextResponse } from "next/server";
import { PAYMENTS_ENABLED } from "@/lib/billing";
import {
  grantSubscription,
  sessionGrantsAccess,
  setSubscriptionActiveByCustomer,
  verifyStripeSignature,
  type StripeCheckoutSession,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook — the only place a subscription is turned on/off in production.
 * Configure in Stripe Dashboard → Developers → Webhooks with events:
 *   checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
 */
export async function POST(request: NextRequest) {
  if (!PAYMENTS_ENABLED) {
    return NextResponse.json({ error: "Payments are disabled" }, { status: 503 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  if (!verifyStripeSignature(rawBody, request.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const obj = event.data?.object ?? {};

  switch (event.type) {
    case "checkout.session.completed": {
      const session = obj as unknown as StripeCheckoutSession;
      const userId = session.client_reference_id;
      if (userId && sessionGrantsAccess(session, userId)) {
        const ok = await grantSubscription(userId, session);
        if (!ok) return NextResponse.json({ error: "DB update failed" }, { status: 500 });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const customer = typeof obj.customer === "string" ? obj.customer : null;
      const status = typeof obj.status === "string" ? obj.status : "";
      if (customer) {
        const active =
          event.type === "customer.subscription.updated" &&
          (status === "active" || status === "trialing");
        const ok = await setSubscriptionActiveByCustomer(customer, active);
        if (!ok) return NextResponse.json({ error: "DB update failed" }, { status: 500 });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
