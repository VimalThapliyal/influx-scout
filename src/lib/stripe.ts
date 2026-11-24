import { createHmac, timingSafeEqual } from "crypto";
import { getSupabaseAdmin } from "./supabase";

/** Reject webhook events signed more than 5 minutes ago (replay protection). */
const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Verify a Stripe-Signature header against the raw request body.
 * Header format: "t=<unix>,v1=<hex hmac>[,v1=...]".
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  if (!header || !secret) return false;

  let timestamp: string | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k === "t") timestamp = v;
    else if (k === "v1" && v) signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest();

  return signatures.some((sig) => {
    const given = Buffer.from(sig, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export interface StripeCheckoutSession {
  id: string;
  status?: string | null;
  payment_status?: string | null;
  client_reference_id?: string | null;
  customer?: string | null;
  subscription?: string | null;
}

/** Fetch a Checkout Session from Stripe using the secret key (server-side truth). */
export async function retrieveCheckoutSession(
  sessionId: string
): Promise<StripeCheckoutSession | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return null;

  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" }
  );
  if (!res.ok) return null;
  return (await res.json()) as StripeCheckoutSession;
}

/** A completed, paid (or free-trial) session that belongs to this user. */
export function sessionGrantsAccess(
  session: StripeCheckoutSession,
  userId: string
): boolean {
  return (
    session.client_reference_id === userId &&
    session.status === "complete" &&
    (session.payment_status === "paid" || session.payment_status === "no_payment_required")
  );
}

export async function grantSubscription(
  userId: string,
  session: StripeCheckoutSession,
  plan = "pro"
): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("profiles")
    .update({
      is_subscribed: true,
      subscribed_at: now,
      plan,
      stripe_customer_id: session.customer ?? null,
      stripe_subscription_id: session.subscription ?? null,
      updated_at: now,
    })
    .eq("id", userId);
  return !error;
}

/** Turn access off when Stripe says the subscription ended or stopped paying. */
export async function setSubscriptionActiveByCustomer(
  customerId: string,
  active: boolean
): Promise<boolean> {
  const { error } = await getSupabaseAdmin()
    .from("profiles")
    .update({
      is_subscribed: active,
      plan: active ? "pro" : "free",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customerId);
  return !error;
}
