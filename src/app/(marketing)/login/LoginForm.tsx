"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, MailCheck } from "lucide-react";
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
        setMessage("We sent a confirmation link to your email. Open it, then sign in here.");
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
      setError(err instanceof Error ? err.message : "We couldn't sign you in. Check your email and password and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-6">
      <h1 className="h-page">{isSignUp ? "Create your account" : "Sign in to Influx"}</h1>
      <p className="page-subtitle">
        {isSignUp
          ? "Free to use. Save creators to campaign lists and track your outreach."
          : "Pick up your campaign lists where you left them."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate={false}>
        <div>
          <label htmlFor="email" className="field-label">
            Work email
          </label>
          <input
            id="email"
            type="email"
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            aria-invalid={error ? true : undefined}
          />
        </div>
        <div>
          <label htmlFor="password" className="field-label">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            aria-describedby={isSignUp ? "password-hint" : undefined}
          />
          {isSignUp && (
            <p id="password-hint" className="mt-1.5 text-xs text-muted">
              At least 6 characters.
            </p>
          )}
        </div>

        {isSignUp && (
          <label className="flex cursor-pointer items-start gap-2.5 text-[0.8125rem] text-muted">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border-line-strong accent-[rgb(var(--accent))]"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              required
            />
            <span>
              I agree to the{" "}
              <Link href="/terms" className="text-link" target="_blank">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-link" target="_blank">
                Privacy Policy
              </Link>
              , and I will only contact creators lawfully.
            </span>
          </label>
        )}

        {error && (
          <p className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger" role="alert">
            <AlertCircle size={15} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
        {message && (
          <p className="flex items-start gap-2 rounded-md bg-success-soft px-3 py-2 text-[0.8125rem] text-success" role="status">
            <MailCheck size={15} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
            {message}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? (isSignUp ? "Creating account" : "Signing in") : isSignUp ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-[0.8125rem] text-muted">
        {isSignUp ? "Already have an account?" : "New to Influx?"}{" "}
        <button
          type="button"
          className="text-link"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError(null);
            setMessage(null);
            setAgreed(false);
          }}
        >
          {isSignUp ? "Sign in" : "Create a free account"}
        </button>
      </p>

      {PAYMENTS_ENABLED && (
        <p className="mt-2 text-[0.8125rem]">
          <Link href="/pricing" className="text-link">
            See plans
          </Link>
        </p>
      )}
    </div>
  );
}
