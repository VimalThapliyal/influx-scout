"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OUTREACH_LIBRARY_HREF } from "@/lib/routes";
import { PAYMENTS_ENABLED } from "@/lib/billing";

interface SubState {
  user: { id: string; email: string | undefined } | null;
  isSubscribed: boolean;
}

/** Ties the Stripe checkout to this account so the webhook can activate it. */
function buildPaymentUrl(link: string, user: { id: string; email?: string }) {
  const url = new URL(link);
  url.searchParams.set("client_reference_id", user.id);
  if (user.email) url.searchParams.set("prefilled_email", user.email);
  return url.toString();
}

export default function SubscribeClient() {
  const router = useRouter();
  const [state, setState] = useState<SubState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stripeLink = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK;
  const demoMode = process.env.NEXT_PUBLIC_SUBSCRIPTION_DEMO_MODE === "true";

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/user/subscription")
        .then((r) => r.json())
        .then((s: SubState) => {
          if (!cancelled) setState(s);
        });

    // Returning from Stripe: Payment Link success URL should be
    //   https://<site>/subscribe?session_id={CHECKOUT_SESSION_ID}
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    if (sessionId) {
      fetch("/api/subscription/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stripe_session_id: sessionId }),
      })
        .catch(() => undefined)
        .finally(() => {
          window.history.replaceState(null, "", window.location.pathname);
          load();
        });
    } else {
      load();
    }
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubscribe() {
    if (!state?.user) {
      router.push("/login?redirect=/subscribe");
      return;
    }

    if (stripeLink) {
      window.location.href = buildPaymentUrl(stripeLink, state.user);
      return;
    }

    if (demoMode) {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/subscription/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: "pro" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");
        router.push(OUTREACH_LIBRARY_HREF);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Activation failed");
      } finally {
        setLoading(false);
      }
      return;
    }

    setError("Payment not configured. Contact the site owner.");
  }

  if (!state) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-mkt-manila/20 border-t-mkt-tally" />
      </div>
    );
  }

  if (state.isSubscribed) {
    return (
      <div className="mkt-card mx-auto max-w-lg p-8 text-center">
        <div className="text-4xl text-mkt-signal">✓</div>
        <h1 className="mkt-h3 mt-4 !text-2xl">You&apos;re subscribed!</h1>
        <p className="mkt-body mt-2 !text-sm">
          Full influencer email addresses are now unlocked.
        </p>
        <Link href={OUTREACH_LIBRARY_HREF} className="mkt-btn-primary mt-6 inline-flex">
          Browse outreach-ready creators
        </Link>
      </div>
    );
  }

  if (!PAYMENTS_ENABLED) {
    return (
      <div className="mkt-card mx-auto max-w-lg p-8 text-center">
        <p className="mkt-tag mx-auto w-fit border-mkt-tally/40 text-mkt-tally">Pro plan</p>
        <h1 className="mkt-h3 mt-4 !text-2xl">Pro is coming soon</h1>
        <p className="mkt-body mt-2 !text-sm">
          We&apos;re still building out verified contact data. Until Pro opens, you can browse
          the creator library, see scores, and build campaign lists for free.
        </p>
        <Link href={OUTREACH_LIBRARY_HREF} className="mkt-btn-primary mt-6 inline-flex">
          Browse creators free
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <p className="mkt-eyebrow justify-center">Subscribe</p>
        <h1 className="mkt-h2 mt-3 !text-4xl">Unlock influencer emails</h1>
        <p className="mkt-body mx-auto mt-2 max-w-md">
          Subscribe to view full email addresses, export contact CSVs, and reach YouTube creators
          in your library.
        </p>
      </div>

      <div className="mkt-card overflow-hidden">
        <div className="border-b mkt-hairline bg-white/[0.02] px-6 py-8">
          <p className="mkt-tag border-mkt-tally/40 text-mkt-tally">Pro plan</p>
          <p className="mt-3 font-poster text-5xl text-mkt-paper">
            $9<span className="font-plex text-lg font-normal text-mkt-ash">/month</span>
          </p>
        </div>
        <div className="p-6">
          <ul className="space-y-3 text-sm text-mkt-ash">
            <li className="flex gap-2">
              <span className="text-mkt-signal">✓</span> View full influencer email addresses
            </li>
            <li className="flex gap-2">
              <span className="text-mkt-signal">✓</span> Export campaigns with contact CSV
            </li>
            <li className="flex gap-2">
              <span className="text-mkt-signal">✓</span> Unlimited saved creator lists
            </li>
            <li className="flex gap-2">
              <span className="text-mkt-signal">✓</span> Outreach tracking by list
            </li>
          </ul>

          {state.user ? (
            <p className="mt-4 font-mono text-xs text-mkt-ash">
              Signed in as <strong className="text-mkt-paper">{state.user.email}</strong>
            </p>
          ) : (
            <p className="mt-4 text-sm text-mkt-ash">
              <Link href="/login?redirect=/subscribe" className="mkt-link">
                Sign in
              </Link>{" "}
              before subscribing.
            </p>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-400" role="alert">{error}</p>
          )}

          <button
            type="button"
            onClick={handleSubscribe}
            disabled={loading}
            className="mkt-btn-primary mt-6 w-full"
          >
            {loading
              ? "Activating…"
              : state.user
                ? stripeLink
                  ? "Subscribe with Stripe"
                  : demoMode
                    ? "Subscribe now (demo)"
                    : "Subscribe now"
                : "Sign in to subscribe"}
          </button>

          {demoMode && (
            <p className="mt-3 text-center font-mono text-[11px] uppercase tracking-wider text-mkt-ash">
              Demo mode: subscription activates instantly without payment.
            </p>
          )}
        </div>
      </div>

      <p className="text-center font-mono text-[11px] uppercase tracking-wider text-mkt-ash">
        Emails are shown as{" "}
        <code className="rounded-sm bg-white/5 px-1 normal-case text-mkt-ash">
          c••••@domain.com
        </code>{" "}
        until you subscribe. Cancel anytime.
      </p>
    </div>
  );
}
