"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { PAYMENTS_ENABLED } from "@/lib/billing";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (isSignUp && !agreed) {
      setError("Please agree to the Terms of Service and Privacy Policy.");
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
          },
        });
        if (signUpError) throw signUpError;
        setMessage("Check your email to confirm your account, then sign in.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        router.push(redirect);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mkt-card p-8">
        <p className="mkt-eyebrow">Account</p>
        <h1 className="mkt-h3 mt-2 !text-3xl">{isSignUp ? "Create account" : "Sign in"}</h1>
        <p className="mkt-body mt-2 !text-sm">
          Sign in to save campaign lists, subscribe, and unlock influencer emails.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block font-mono text-xs uppercase tracking-wider text-mkt-ash"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              className="mkt-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1 block font-mono text-xs uppercase tracking-wider text-mkt-ash"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              className="mkt-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isSignUp ? "new-password" : "current-password"}
            />
          </div>

          {isSignUp && (
            <label className="flex cursor-pointer items-start gap-3 text-sm text-mkt-ash">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded-sm border-mkt-manila/40 bg-mkt-ink text-mkt-tally focus:ring-mkt-tally"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                required
              />
              <span>
                I agree to the{" "}
                <Link href="/terms" className="mkt-link" target="_blank">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="mkt-link" target="_blank">
                  Privacy Policy
                </Link>
                , and I will only contact creators lawfully.
              </span>
            </label>
          )}

          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="text-sm text-mkt-signal" role="status">
              {message}
            </p>
          )}

          <button type="submit" className="mkt-btn-primary w-full" disabled={loading}>
            {loading ? "Please wait…" : isSignUp ? "Sign up" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-mkt-ash">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            className="mkt-link font-medium"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setMessage(null);
              setAgreed(false);
            }}
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>

        {PAYMENTS_ENABLED && (
          <p className="mt-4 text-center text-sm">
            <Link href="/subscribe" className="mkt-link">
              View subscription plans →
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
