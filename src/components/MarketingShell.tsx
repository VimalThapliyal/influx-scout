import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { BRAND_NAME } from "@/lib/brand";
import { DATA_SOURCE } from "@/lib/data-sources";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mkt-shell">
      <header className="border-b mkt-hairline">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/">
            <BrandMark size="md" variant="mkt" />
          </Link>
          <Link href="/channels" className="mkt-link font-mono text-xs uppercase tracking-wider">
            {DATA_SOURCE.database.label} →
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-12">{children}</main>
      <footer className="border-t mkt-hairline py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 font-mono text-xs uppercase tracking-wider text-mkt-ash md:flex-row">
          <p>
            © {new Date().getFullYear()} {BRAND_NAME}
          </p>
          <div className="flex flex-wrap justify-center gap-5">
            <Link href="/youtubers" className="hover:text-mkt-paper">
              Creator lists
            </Link>
            <Link href="/tools" className="hover:text-mkt-paper">
              Free tools
            </Link>
            <Link href="/privacy" className="hover:text-mkt-paper">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-mkt-paper">
              Terms
            </Link>
            <Link href="/cookies" className="hover:text-mkt-paper">
              Cookies
            </Link>
            <Link href="/login" className="hover:text-mkt-paper">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
