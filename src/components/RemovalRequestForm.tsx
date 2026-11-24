"use client";

import { useState } from "react";

export function RemovalRequestForm() {
  const [channel, setChannel] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setMessage("");
    try {
      const res = await fetch("/api/removal-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, email, reason, company }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setState("done");
      setMessage(
        data.found === false
          ? "Thanks — we couldn't find that channel in our database, so there's nothing listed. We've logged your request in case it's added later."
          : "Done — your channel has been hidden from our site and search lists. We'll follow up by email if we need anything else."
      );
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (state === "done") {
    return (
      <div className="mkt-card p-6 text-center">
        <p className="text-3xl text-mkt-signal">✓</p>
        <p className="mkt-body mt-3">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mkt-card space-y-4 p-6">
      <label className="block">
        <span className="font-mono text-[11px] uppercase tracking-wider text-mkt-ash">Your YouTube channel link</span>
        <input
          required
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          placeholder="https://www.youtube.com/@yourhandle"
          className="mkt-input mt-1 w-full"
        />
      </label>
      <label className="block">
        <span className="font-mono text-[11px] uppercase tracking-wider text-mkt-ash">Your email</span>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mkt-input mt-1 w-full"
        />
        <span className="mt-1 block text-xs text-mkt-ash/80">Only used to follow up on this request.</span>
      </label>
      <label className="block">
        <span className="font-mono text-[11px] uppercase tracking-wider text-mkt-ash">Reason (optional)</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="mkt-input mt-1 w-full"
        />
      </label>
      {/* Honeypot — hidden from people, bots fill it in */}
      <input
        tabIndex={-1}
        autoComplete="off"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="hidden"
        aria-hidden="true"
        name="company"
      />
      {state === "error" && <p className="text-sm text-red-400" role="alert">{message}</p>}
      <button type="submit" disabled={state === "sending"} className="mkt-btn-primary w-full">
        {state === "sending" ? "Sending…" : "Remove my listing"}
      </button>
    </form>
  );
}
