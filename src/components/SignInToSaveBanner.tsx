"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SignInToSaveBanner({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const loginHref = `/login?redirect=${encodeURIComponent(pathname)}`;

  if (compact) {
    return (
      <p className="text-sm text-muted">
        <Link href={loginHref} className="text-link">
          Sign in
        </Link>{" "}
        to save campaign lists and track outreach.
      </p>
    );
  }

  return (
    <div className="card px-4 py-3">
      <p className="text-sm font-medium text-fg">Sign in to save lists</p>
      <p className="mt-1 text-[0.8125rem] text-muted">
        Campaign lists and outreach tracking are saved to your account.
      </p>
      <Link href={loginHref} className="btn-primary btn-sm mt-3">
        Sign in
      </Link>
    </div>
  );
}
