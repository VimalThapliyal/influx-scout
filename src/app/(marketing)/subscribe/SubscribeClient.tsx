"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, CircleCheck } from "lucide-react";
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

    setError("Payments aren't set up yet, so we can't start your upgrade.");
  }

  if (!state) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-6" role="status" aria-label="Loading your plan">
        <div className="skeleton h-6 w-40" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-9 w-44" />
      </div>
    );
  }

  if (state.isSubscribed) {
    return (
      <div className="mx-auto max-w-md py-6">
        <CircleCheck size={20} strokeWidth={1.75} aria-hidden className="text-success" />
        <h1 className="h-page mt-3">You&apos;re on Pro</h1>
        <p className="page-subtitle">Email addresses and CSV export are unlocked on every creator.</p>
        <Link href={OUTREACH_LIBRARY_HREF} className="btn-primary mt-6">
          Browse creators
        </Link>
      </div>
    );
  }

  if (!PAYMENTS_ENABLED) {
    return (
      <div className="mx-auto max-w-md py-6">
        <h1 className="h-page">Pro isn&apos;t available yet</h1>
        <p className="page-subtitle">
          Email addresses and CSV export will be part of Pro. We haven&apos;t set a date or a price. Until
          then, browsing, filters and campaign lists are free.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={OUTREACH_LIBRARY_HREF} className="btn-primary">
            Browse creators
          </Link>
          <Link href="/pricing" className="btn-secondary">
            See what each plan includes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-6">
      <h1 className="h-page">Upgrade to Pro</h1>
      <p className="page-subtitle">See full email addresses and export campaign lists as CSV.</p>

      <div className="card mt-6 p-6">
        <p className="text-2xl font-semibold tracking-[-0.02em] text-fg">
          $9 <span className="text-sm font-normal text-muted">per month, cancel anytime</span>
        </p>
        <ul className="mt-5 space-y-2.5 text-sm text-fg">
          {["Full email addresses", "CSV export of campaign lists", "AI-drafted outreach emails", "Everything in Free"].map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-success" />
              {f}
            </li>
          ))}
        </ul>

        {state.user ? (
          <p className="mt-5 text-xs text-muted">
            Signed in as <span className="font-medium text-fg">{state.user.email}</span>
          </p>
        ) : (
          <p className="mt-5 text-[0.8125rem] text-muted">
            <Link href="/login?redirect=/subscribe" className="text-link">
              Sign in
            </Link>{" "}
            first so the plan is attached to your account.
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger" role="alert">
            {error}
          </p>
        )}

        <button type="button" onClick={handleSubscribe} disabled={loading} className="btn-primary mt-5 w-full">
          {loading
            ? "Activating"
            : state.user
              ? demoMode && !stripeLink
                ? "Activate Pro (demo)"
                : "Continue to payment"
              : "Sign in to upgrade"}
        </button>

        {demoMode && (
          <p className="mt-3 text-xs text-muted">Demo mode: the plan activates without payment.</p>
        )}
      </div>
    </div>
  );
}
