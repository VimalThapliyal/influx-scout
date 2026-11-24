/**
 * Master switch for selling Pro. Off unless NEXT_PUBLIC_PAYMENTS_ENABLED=true.
 * While off: no prices or upgrade buttons, /subscribe says "coming soon",
 * and the activate + Stripe webhook endpoints refuse requests.
 * Emails stay locked for everyone except existing Pro profiles.
 */
export const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true";

/** Short label for locked-email CTAs. */
export const UPGRADE_LABEL = PAYMENTS_ENABLED ? "Upgrade to Pro" : "Pro coming soon";
