import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

const NAV = [
  { href: "/youtubers", label: "Creator lists" },
  { href: "/blog", label: "Data & guides" },
  { href: "/tools", label: "Free tools" },
];

const FOOTER = [
  { href: "/youtubers", label: "Creator lists" },
  { href: "/blog", label: "Data & guides" },
  { href: "/tools", label: "Free tools" },
  { href: "/compare", label: "Compare tools" },
  { href: "/remove-my-listing", label: "Remove your channel" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
];

export function Wordmark() {
  return (
    <span className="font-poster text-[1.35rem] font-semibold tracking-tight text-mkt-paper">
      {BRAND_NAME}
    </span>
  );
}

export function MarketingHeader({ width = "max-w-5xl" }: { width?: string }) {
  return (
    <header className="border-b border-mkt-manila/15">
      <div className={`mx-auto flex h-16 ${width} items-center gap-8 px-5 sm:px-6`}>
        <Link href="/" aria-label={`${BRAND_NAME} home`}>
          <Wordmark />
        </Link>
        <nav className="hidden flex-1 gap-6 text-[0.95rem] text-mkt-ash md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-mkt-paper">
              {n.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/login"
          className="ml-auto rounded-md border border-mkt-manila/30 px-4 py-1.5 text-sm font-medium text-mkt-paper hover:border-mkt-manila/60 md:ml-0"
        >
          Sign in
        </Link>
      </div>
    </header>
  );
}

export function MarketingFooter({ width = "max-w-5xl" }: { width?: string }) {
  return (
    <footer className="mt-16 border-t border-mkt-manila/15">
      <div className={`mx-auto grid ${width} gap-8 px-5 py-10 text-sm text-mkt-ash sm:px-6 md:grid-cols-[1fr_2fr]`}>
        <div>
          <Wordmark />
          <p className="mt-2 max-w-xs">
            YouTube creators in the US and Europe, checked against their last five uploads every two weeks.
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {FOOTER.map((f) => (
            <li key={f.href}>
              <Link href={f.href} className="hover:text-mkt-paper">
                {f.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-xs md:col-span-2">
          © {new Date().getFullYear()} {BRAND_NAME}. Channel data from the YouTube Data API.
        </p>
      </div>
    </footer>
  );
}

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mkt-shell">
      <MarketingHeader />
      <main className="mx-auto max-w-5xl px-5 py-12 sm:px-6">{children}</main>
      <MarketingFooter />
    </div>
  );
}
