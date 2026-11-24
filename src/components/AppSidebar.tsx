"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { PlatformSwitcher } from "@/components/PlatformSwitcher";
import { BrandMark } from "@/components/BrandMark";
import { BRAND_TAGLINE } from "@/lib/brand";
import { PAYMENTS_ENABLED } from "@/lib/billing";
import { isNavActive, sidebarNavItems } from "@/lib/nav";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const nav = sidebarNavItems({ includeAdmin: isAdmin });

  useEffect(() => {
    fetch("/api/user/subscription")
      .then((r) => r.json())
      .then((d) => {
        setUser(d.user);
        setIsSubscribed(d.isSubscribed === true);
        setIsAdmin(d.isAdmin === true);
      });
  }, [pathname]);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-mkt-manila/15 bg-mkt-ink md:flex">
      <div className="flex h-16 items-center gap-3 border-b border-mkt-manila/15 px-5">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <BrandMark size="md" tagline={BRAND_TAGLINE} variant="mkt" />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label="App navigation">
        {nav.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${active ? "nav-item-active" : ""}`}
            >
              <Icon active={active} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <PlatformSwitcher variant="sidebar" />

      <div className="space-y-3 border-t border-mkt-manila/15 p-4">
        {isSubscribed ? (
          <div className="rounded-sm border border-mkt-signal/30 bg-mkt-signal/10 px-3 py-2 text-center font-mono text-xs font-medium uppercase tracking-wide text-mkt-signal">
            ✦ Pro plan active
          </div>
        ) : PAYMENTS_ENABLED ? (
          <Link href="/subscribe" className="mkt-btn-primary flex w-full !min-h-[38px] text-xs">
            Upgrade to Pro
          </Link>
        ) : null}
        {user ? (
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-mono text-xs text-mkt-ash">{user.email}</p>
            <button
              type="button"
              onClick={signOut}
              className="shrink-0 text-xs text-mkt-ash hover:text-mkt-paper"
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link href="/login" className="block text-center text-xs text-mkt-tally hover:brightness-110">
            Sign in →
          </Link>
        )}
      </div>
    </aside>
  );
}
