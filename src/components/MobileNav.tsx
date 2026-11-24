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
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center border-b border-mkt-manila/15 bg-mkt-ink/95 px-4 md:hidden">
      <Link href="/dashboard" className="flex items-center gap-2" aria-label="Influx home">
        <BrandMark size="sm" variant="mkt" />
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
        className="fixed inset-x-0 bottom-0 z-40 border-t border-mkt-manila/15 bg-mkt-ink/95 md:hidden"
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
                className={`flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium transition ${
                  active ? "text-mkt-tally" : "text-mkt-ash hover:text-mkt-paper"
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
            className={`flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium transition ${
              moreActive ? "text-mkt-tally" : "text-mkt-ash hover:text-mkt-paper"
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
            className="absolute inset-0 bg-black/60"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-sm border-t border-mkt-manila/20 bg-[#1B1F27] shadow-2xl"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-more-title"
          >
            <div className="flex items-center justify-between border-b border-mkt-manila/15 px-5 py-4">
              <h2 id="mobile-more-title" className="font-poster text-lg uppercase tracking-tight text-mkt-paper">
                More
              </h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-sm text-mkt-ash hover:bg-white/5 hover:text-mkt-paper"
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

            <div className="border-t border-mkt-manila/15 p-4">
              <PlatformSwitcher variant="sidebar" />
            </div>

            <div className="space-y-3 border-t border-mkt-manila/15 p-4">
              {isSubscribed ? (
                <div className="rounded-sm border border-mkt-signal/30 bg-mkt-signal/10 px-3 py-2.5 text-center font-mono text-xs font-medium uppercase tracking-wide text-mkt-signal">
                  ✦ Pro plan active
                </div>
              ) : PAYMENTS_ENABLED ? (
                <Link
                  href="/subscribe"
                  className="mkt-btn-primary flex w-full text-sm"
                  onClick={() => setMoreOpen(false)}
                >
                  Upgrade to Pro
                </Link>
              ) : null}

              {user ? (
                <div className="flex items-center justify-between gap-2 rounded-sm border border-mkt-manila/20 bg-white/[0.02] px-4 py-3">
                  <p className="truncate font-mono text-xs text-mkt-ash">{user.email}</p>
                  <button
                    type="button"
                    onClick={signOut}
                    className="shrink-0 text-xs font-medium text-mkt-ash hover:text-mkt-paper"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="mkt-btn-secondary flex w-full text-sm"
                  onClick={() => setMoreOpen(false)}
                >
                  Sign in
                </Link>
              )}

              <Link
                href="/"
                className="block text-center text-xs text-mkt-ash/70 hover:text-mkt-ash"
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