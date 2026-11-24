"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SignInToSaveBanner({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const loginHref = `/login?redirect=${encodeURIComponent(pathname)}`;

  if (compact) {
    return (
      <p className="text-sm text-slate-400">
        <Link href={loginHref} className="font-medium text-mkt-tally hover:text-mkt-tally">
          Sign in
        </Link>{" "}
        to save campaign lists and track outreach.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-mkt-tally/25 bg-mkt-tally/10 px-4 py-3 sm:px-5 sm:py-4">
      <p className="text-sm font-medium text-mkt-tally">Sign in to save progress</p>
      <p className="mt-1 text-xs text-slate-400">
        Campaign lists and outreach tracking are saved to your account. Browse creators without
        signing in — sign in when you&apos;re ready to build lists.
      </p>
      <Link href={loginHref} className="btn-primary mt-3 inline-flex min-h-[36px] text-xs">
        Sign in →
      </Link>
    </div>
  );
}
