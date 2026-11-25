import Link from "next/link";
import { Check } from "lucide-react";
import { PAYMENTS_ENABLED } from "@/lib/billing";

const FREE = [
  "Browse every listed creator",
  "Filter by niche, country, size, recent views and engagement",
  "See whether a public email, contact form or social link exists",
  "Campaign lists with contacted and replied tracking",
  "Engagement and sponsorship price calculators",
];

const PRO = ["Everything in Free", "Full email addresses", "CSV export of campaign lists", "AI-drafted outreach emails"];

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-fg">
      <Check size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-success" />
      {children}
    </li>
  );
}

/** The two plans. Shown on the homepage and /pricing. No price is shown for Pro until it is on sale. */
export function PlanCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card flex flex-col p-6" aria-labelledby="plan-free">
        <h3 id="plan-free" className="h-section">Free</h3>
        <p className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-fg">
          $0 <span className="text-sm font-normal text-muted">no card needed</span>
        </p>
        <ul className="mt-5 flex-1 space-y-2.5">
          {FREE.map((f) => (
            <Feature key={f}>{f}</Feature>
          ))}
        </ul>
        <Link href="/login" className="btn-primary mt-6 w-full">
          Create a free account
        </Link>
      </section>

      <section className="card flex flex-col p-6" aria-labelledby="plan-pro">
        <h3 id="plan-pro" className="h-section">Pro</h3>
        <p className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-fg">
          {PAYMENTS_ENABLED ? (
            <>
              $9 <span className="text-sm font-normal text-muted">per month</span>
            </>
          ) : (
            <span className="text-base font-medium text-muted">Not available yet. Price to be announced.</span>
          )}
        </p>
        <ul className="mt-5 flex-1 space-y-2.5">
          {PRO.map((f) => (
            <Feature key={f}>{f}</Feature>
          ))}
        </ul>
        {PAYMENTS_ENABLED ? (
          <Link href="/subscribe" className="btn-secondary mt-6 w-full">
            Upgrade to Pro
          </Link>
        ) : (
          <p className="mt-6 text-[0.8125rem] text-muted">
            Create a free account and you&apos;ll be able to upgrade from inside the app when Pro opens.
          </p>
        )}
      </section>
    </div>
  );
}
