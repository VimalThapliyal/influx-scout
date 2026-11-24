import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, LegalSection } from "@/components/LegalDoc";
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Cookie Notice — ${BRAND_NAME}`,
  description: `How ${BRAND_NAME} uses cookies and similar technologies.`,
};

export default function CookiesPage() {
  return (
    <LegalDoc title="Cookie Notice">
      <p>
        This Cookie Notice explains how {BRAND_NAME} uses cookies and similar
        technologies. For broader data practices, see our{" "}
        <Link href="/privacy" className="text-violet-400 hover:text-violet-300">
          Privacy Policy
        </Link>
        .
      </p>

      <LegalSection title="1. What are cookies?">
        <p>
          Cookies are small text files stored on your device. We also use local
          storage and similar technologies for session and preference data.
        </p>
      </LegalSection>

      <LegalSection title="2. How we use them">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-slate-200">Essential:</strong> sign-in
            sessions (via our auth provider), security, load balancing, and
            remembering basic UI preferences needed for the Service to work
          </li>
          <li>
            <strong className="text-slate-200">Functional:</strong> items such
            as outreach draft defaults stored in your browser (for example brand
            name fields you save locally)
          </li>
          <li>
            <strong className="text-slate-200">Analytics (if enabled):</strong>{" "}
            aggregated usage to improve the product. We will update this notice
            if we add third-party analytics cookies
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Your choices">
        <p>
          Most browsers let you block or delete cookies. Blocking essential
          cookies may prevent sign-in or core features from working. You can
          clear site data for this domain in your browser settings at any time.
        </p>
      </LegalSection>

      <LegalSection title="4. Contact">
        <p>
          Questions:{" "}
          <a className="text-violet-400 hover:text-violet-300" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
