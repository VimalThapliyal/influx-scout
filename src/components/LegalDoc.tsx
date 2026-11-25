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
        <p className="text-xs font-medium text-accent">
          Legal
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg md:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-muted">
          Effective date: {LEGAL_EFFECTIVE_DATE} · {BRAND_NAME}
        </p>
        <div className="prose-legal mt-10 space-y-8 text-[15px] leading-relaxed text-fg">
          {children}
        </div>
        <nav
          className="mt-14 flex flex-wrap gap-4 border-t border-line pt-8 text-sm text-muted"
          aria-label="Other legal documents"
        >
          <Link href="/privacy" className="hover:text-fg">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-fg">
            Terms of Service
          </Link>
          <Link href="/cookies" className="hover:text-fg">
            Cookie Notice
          </Link>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="hover:text-fg"
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
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
