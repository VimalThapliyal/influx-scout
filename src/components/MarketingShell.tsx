import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

const NAV = [
  { href: "/youtubers", label: "Creator lists" },
  { href: "/blog", label: "Guides" },
  { href: "/tools", label: "Free tools" },
  { href: "/pricing", label: "Pricing" },
];

const FOOTER: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/channels", label: "Browse creators" },
      { href: "/youtubers", label: "Creator lists" },
      { href: "/pricing", label: "Pricing" },
      { href: "/compare", label: "Compare tools" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/blog", label: "Guides" },
      { href: "/tools/youtube-engagement-rate-calculator", label: "Engagement calculator" },
      { href: "/tools/youtube-sponsorship-calculator", label: "Sponsorship calculator" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/remove-my-listing", label: "Remove your channel" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/cookies", label: "Cookies" },
    ],
  },
];

export function Wordmark() {
  return <span className="text-base font-semibold tracking-[-0.02em] text-fg">{BRAND_NAME}</span>;
}

export function MarketingHeader({ width = "max-w-5xl" }: { width?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas">
      <div className={`mx-auto flex h-14 ${width} items-center gap-6 px-4 sm:px-6`}>
        <Link href="/" aria-label={`${BRAND_NAME} home`}>
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="btn-ghost btn-sm">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/login" className="btn-ghost btn-sm">
            Sign in
          </Link>
          <Link href="/channels" className="btn-primary btn-sm">
            Browse creators
          </Link>
        </div>
      </div>
      <nav aria-label="Main" className="flex gap-1 overflow-x-auto border-t border-line px-2 py-1.5 md:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="btn-ghost btn-sm">
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function MarketingFooter({ width = "max-w-5xl" }: { width?: string }) {
  return (
    <footer className="mt-20 border-t border-line">
      <div className={`mx-auto grid ${width} gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]`}>
        <div>
          <Wordmark />
          <p className="mt-2 max-w-[16rem] text-[0.8125rem] text-muted">
            YouTube creators in the US and Europe, re-checked every two weeks.
          </p>
        </div>
        {FOOTER.map((col) => (
          <div key={col.title}>
            <p className="text-[0.8125rem] font-medium text-fg">{col.title}</p>
            <ul className="mt-3 space-y-2 text-[0.8125rem]">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted hover:text-fg">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-xs text-muted md:col-span-4">
          © {new Date().getFullYear()} {BRAND_NAME}. Channel statistics come from the YouTube Data API.
        </p>
      </div>
    </footer>
  );
}

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <MarketingHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">{children}</main>
      <MarketingFooter />
    </div>
  );
}
