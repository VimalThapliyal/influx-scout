"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SignInToSaveBanner({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const loginHref = `/login?redirect=${encodeURIComponent(pathname)}`;

  if (compact) {
    return (
      <p className="text-sm text-muted">
        <Link href={loginHref} className="font-medium text-accent hover:text-accent">
          Sign in
        </Link>{" "}
        to save campaign lists and track outreach.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-accent/25 bg-accent-soft px-4 py-3 sm:px-5 sm:py-4">
      <p className="text-sm font-medium text-accent">Sign in to save progress</p>
      <p className="mt-1 text-xs text-muted">
        Campaign lists and outreach tracking are saved to your account. Browse creators without
        signing in — sign in when you&apos;re ready to build lists.
      </p>
      <Link href={loginHref} className="btn-primary mt-3 inline-flex text-xs">
        Sign in
      </Link>
    </div>
  );
}
