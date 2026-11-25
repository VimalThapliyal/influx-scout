"use client";

import { useState } from "react";

/** "Tell me when Pro opens" form. One email field; shows a confirmation in place. */
export function WaitlistForm({ source }: { source: string }) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, company, source }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "We couldn't save your email. Try again in a moment.");
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't save your email. Try again in a moment.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-[0.8125rem] text-success">
        You&apos;re on the list. We&apos;ll email {email} once when Pro opens, and not before.
      </p>
    );
  }

  const id = `waitlist-${source}`;
  return (
    <form onSubmit={submit} noValidate={false}>
      <label htmlFor={id} className="field-label">
        Get one email when Pro opens
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          className="input-field"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={error ? true : undefined}
        />
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          className="hidden"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
        <button type="submit" className="btn-secondary" disabled={state === "saving"}>
          {state === "saving" ? "Joining" : "Join the waitlist"}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-[0.8125rem] text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
