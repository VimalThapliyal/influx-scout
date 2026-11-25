"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { BrandMark } from "@/components/BrandMark";
import { PlatformSwitcher } from "@/components/PlatformSwitcher";
import { PAYMENTS_ENABLED } from "@/lib/billing";
import {
  MoreIcon,
  isMoreNavActive,
  isNavActive,
  mobileMoreNav,
  mobilePrimaryNav,
} from "@/lib/nav";

export function MobileTopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center border-b border-line bg-canvas px-4 md:hidden">
      <Link href="/dashboard" className="flex items-center gap-2" aria-label="Influx home">
        <span className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-fg">Influx</span>
      </Link>
    </header>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const moreActive = isMoreNavActive(pathname);
  const moreItems = mobileMoreNav.filter(
    (item) => item.href !== "/admin" || isAdmin
  );

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    fetch("/api/user/subscription")
      .then((r) => r.json())
      .then((d) => {
        setUser(d.user);
        setIsSubscribed(d.isSubscribed === true);
        setIsAdmin(d.isAdmin === true);
      });
  }, [moreOpen, pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setMoreOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label="Mobile navigation"
      >
        <div className="grid h-16 grid-cols-4">
          {mobilePrimaryNav.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 text-xs font-medium transition ${
                  active ? "text-accent" : "text-muted hover:text-fg"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon active={active} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 text-xs font-medium transition ${
              moreActive ? "text-accent" : "text-muted hover:text-fg"
            }`}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
          >
            <MoreIcon active={moreActive || moreOpen} />
            <span>More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-fg/40"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-sm border-t border-line bg-surface shadow-pop"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-more-title"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 id="mobile-more-title" className="text-lg tracking-tight text-fg">
                More
              </h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-fg"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1 p-3">
              {moreItems.map((item) => {
                const active = isNavActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${active ? "nav-item-active" : ""}`}
                    onClick={() => setMoreOpen(false)}
                  >
                    <Icon active={active} />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <div className="border-t border-line p-4">
              <PlatformSwitcher variant="sidebar" />
            </div>

            <div className="space-y-3 border-t border-line p-4">
              {isSubscribed ? (
                <div className="rounded-md border border-success/30 bg-success-soft px-3 py-2.5 text-center text-xs font-medium text-success">
                  Pro plan active
                </div>
              ) : PAYMENTS_ENABLED ? (
                <Link
                  href="/subscribe"
                  className="btn-primary flex w-full text-sm"
                  onClick={() => setMoreOpen(false)}
                >
                  Upgrade to Pro
                </Link>
              ) : null}

              {user ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-subtle px-4 py-3">
                  <p className="truncate text-xs text-muted">{user.email}</p>
                  <button
                    type="button"
                    onClick={signOut}
                    className="shrink-0 text-xs font-medium text-muted hover:text-fg"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="btn-secondary flex w-full text-sm"
                  onClick={() => setMoreOpen(false)}
                >
                  Sign in
                </Link>
              )}

              <Link
                href="/"
                className="block text-center text-xs text-muted hover:text-muted"
                onClick={() => setMoreOpen(false)}
              >
                Back to marketing site
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}