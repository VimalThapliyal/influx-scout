"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PAYMENTS_ENABLED, UPGRADE_LABEL } from "@/lib/billing";

export function EmailGate({
  email,
  maskedPreview,
  locked = false,
  className = "",
  showCopy = false,
}: {
  email?: string | null;
  maskedPreview?: string | null;
  locked?: boolean;
  className?: string;
  showCopy?: boolean;
}) {
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [hasUser, setHasUser] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/user/subscription")
      .then((r) => r.json())
      .then((d) => {
        setIsSubscribed(d.isSubscribed === true);
        setHasUser(!!d.user);
      })
      .catch(() => {
        setIsSubscribed(false);
        setHasUser(false);
      });
  }, []);

  const showFull = isSubscribed && email && !locked;
  const preview = maskedPreview ?? (email ? `${email[0]}••••@${email.split("@")[1]}` : null);

  if (!email && !maskedPreview && !locked) {
    return <span className={`text-mkt-ash/60 ${className}`}>Not available</span>;
  }

  if (isSubscribed === null) {
    return <span className={`font-mono text-sm text-mkt-ash/60 ${className}`}>•••••@•••••.com</span>;
  }

  if (showFull && email) {
    if (showCopy) {
      return (
        <button
          type="button"
          className={`flex items-center gap-1 text-mkt-tally hover:brightness-110 ${className}`}
          onClick={() => {
            navigator.clipboard.writeText(email);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {email}
          <span className="text-xs">{copied ? "✓" : "⎘"}</span>
        </button>
      );
    }
    return (
      <a href={`mailto:${email}`} className={`text-mkt-tally hover:brightness-110 ${className}`}>
        {email}
      </a>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="font-mono text-sm text-mkt-ash">{preview ?? "•••••@•••••.com"}</span>
      {PAYMENTS_ENABLED ? (
        <Link
          href={hasUser ? "/subscribe" : "/login?redirect=/subscribe"}
          className="text-xs font-medium text-mkt-tally hover:brightness-110"
        >
          {hasUser ? "Upgrade to unlock →" : "Sign in to unlock →"}
        </Link>
      ) : (
        <span className="text-xs font-medium text-mkt-ash">{UPGRADE_LABEL}</span>
      )}
    </div>
  );
}

export function EmailLockedBanner() {
  return (
    <div className="flex items-start gap-3 rounded-sm border border-mkt-tally/25 bg-mkt-tally/10 px-4 py-3 text-sm text-mkt-paper">
      <span className="text-base">🔒</span>
      {PAYMENTS_ENABLED ? (
        <p>
          Contact emails are hidden on the free plan.{" "}
          <Link href="/subscribe" className="font-semibold text-mkt-tally underline hover:brightness-110">
            Upgrade to Pro
          </Link>{" "}
          to unlock emails and CSV export.
        </p>
      ) : (
        <p>
          Contact emails and CSV export are part of Pro, which is coming soon. Until then, use
          the YouTube About page or the creator&apos;s socials to reach out.
        </p>
      )}
    </div>
  );
}
