"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { BRAND_NAME } from "@/lib/brand";
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
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-line bg-canvas md:flex">
      <div className="flex h-14 items-center px-4">
        <Link href="/dashboard" className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-fg">
          {BRAND_NAME}
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 px-2" aria-label="App navigation">
        {nav.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`nav-item ${active ? "nav-item-active" : ""}`}
            >
              <Icon active={active} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-line p-3">
        {isSubscribed ? (
          <p className="tag-pill bg-success-soft text-success">Pro plan</p>
        ) : PAYMENTS_ENABLED ? (
          <Link href="/subscribe" className="btn-secondary btn-sm w-full">
            Upgrade to Pro
          </Link>
        ) : null}
        {user ? (
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs text-muted" title={user.email}>{user.email}</p>
            <button type="button" onClick={signOut} className="shrink-0 text-xs font-medium text-muted hover:text-fg">
              Sign out
            </button>
          </div>
        ) : (
          <Link href="/login" className="btn-secondary btn-sm w-full">
            Sign in
          </Link>
        )}
      </div>
    </aside>
  );
}
