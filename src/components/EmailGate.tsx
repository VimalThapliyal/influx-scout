"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Lock } from "lucide-react";
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
    return <span className={`text-muted ${className}`}>Not available</span>;
  }

  if (isSubscribed === null) {
    return <span className={`text-sm text-muted ${className}`}>•••••@•••••.com</span>;
  }

  if (showFull && email) {
    if (showCopy) {
      return (
        <button
          type="button"
          className={`flex items-center gap-1 text-accent hover:text-accent-hover ${className}`}
          onClick={() => {
            navigator.clipboard.writeText(email);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {email}
          {copied ? <Check size={14} strokeWidth={1.75} aria-label="Copied" /> : <Copy size={14} strokeWidth={1.75} aria-label="Copy" />}
        </button>
      );
    }
    return (
      <a href={`mailto:${email}`} className={`text-accent hover:text-accent-hover ${className}`}>
        {email}
      </a>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-sm text-muted">{preview ?? "•••••@•••••.com"}</span>
      {PAYMENTS_ENABLED ? (
        <Link
          href={hasUser ? "/subscribe" : "/login?redirect=/subscribe"}
          className="text-xs font-medium text-accent hover:text-accent-hover"
        >
          {hasUser ? "Upgrade to unlock" : "Sign in to unlock"}
        </Link>
      ) : (
        <span className="text-xs font-medium text-muted">{UPGRADE_LABEL}</span>
      )}
    </div>
  );
}

export function EmailLockedBanner() {
  return (
    <p className="flex items-start gap-2 text-[0.8125rem] text-muted">
      <Lock size={14} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
      {PAYMENTS_ENABLED ? (
        <span>
          Email addresses and CSV export are part of Pro.{" "}
          <Link href="/subscribe" className="text-link">
            See plans
          </Link>
        </span>
      ) : (
        <span>
          Email addresses and CSV export will be part of Pro, which isn&apos;t available yet. For now, use
          the links on each creator&apos;s profile to reach them.
        </span>
      )}
    </p>
  );
}
