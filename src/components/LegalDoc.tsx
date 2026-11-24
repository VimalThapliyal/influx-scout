import Link from "next/link";
import { BRAND_NAME, LEGAL_EFFECTIVE_DATE, SUPPORT_EMAIL } from "@/lib/brand";
import { MarketingShell } from "@/components/MarketingShell";

export function LegalDoc({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-wider text-mkt-tally/90">
          Legal
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          Effective date: {LEGAL_EFFECTIVE_DATE} · {BRAND_NAME}
        </p>
        <div className="prose-legal mt-10 space-y-8 text-[15px] leading-relaxed text-slate-300">
          {children}
        </div>
        <nav
          className="mt-14 flex flex-wrap gap-4 border-t border-white/10 pt-8 text-sm text-slate-500"
          aria-label="Other legal documents"
        >
          <Link href="/privacy" className="hover:text-white">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-white">
            Terms of Service
          </Link>
          <Link href="/cookies" className="hover:text-white">
            Cookie Notice
          </Link>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="hover:text-white"
          >
            Contact
          </a>
        </nav>
      </article>
    </MarketingShell>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
