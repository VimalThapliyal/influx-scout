import type { Metadata } from "next";
import { LegalDoc, LegalSection } from "@/components/LegalDoc";
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Privacy Policy — ${BRAND_NAME}`,
  description: `How ${BRAND_NAME} collects, uses, and protects personal data.`,
};

export default function PrivacyPage() {
  return (
    <LegalDoc title="Privacy Policy">
      <p>
        This Privacy Policy explains how {BRAND_NAME} (“we,” “us,” or “our”)
        collects, uses, and shares information when you use our website and
        services (the “Service”). The Service helps marketers discover YouTube
        creators and manage outreach lists. By using the Service, you agree to
        this Policy.
      </p>

      <LegalSection title="1. Who this applies to">
        <p>
          <strong className="text-slate-200">Account users</strong> — people who
          sign up, subscribe, or use dashboards, campaigns, and email unlock
          features.
        </p>
        <p>
          <strong className="text-slate-200">Creators in our library</strong> —
          we index publicly available YouTube channel information and, where
          available, publicly posted contact details (for example emails or
          links on public About pages or linked websites). We do not claim to be
          affiliated with YouTube, Google, or any creator.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <p>
          <strong className="text-slate-200">Account data:</strong> email
          address, password (stored hashed by our auth provider), subscription
          status, and profile settings you choose.
        </p>
        <p>
          <strong className="text-slate-200">Usage data:</strong> pages viewed,
          searches, filters, campaign list actions, feature usage, approximate
          device/browser information, and IP address for security and abuse
          prevention.
        </p>
        <p>
          <strong className="text-slate-200">Creator / library data:</strong>{" "}
          public channel metadata (title, handle, stats, country signals,
          niche labels), publicly sourced contact fields (email, website,
          social links), and enrichment metadata (for example source type and
          when data was last checked).
        </p>
        <p>
          <strong className="text-slate-200">Communications:</strong> messages
          you send us (support, feedback). Outreach emails you send to creators
          are composed by you; we do not send those emails on your behalf unless
          a future feature explicitly says so.
        </p>
      </LegalSection>

      <LegalSection title="3. How we use information">
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide, operate, and improve the Service</li>
          <li>Authenticate users and manage subscriptions</li>
          <li>Build and refresh the creator library from public sources</li>
          <li>Show contact details according to your plan entitlements</li>
          <li>Prevent fraud, spam, and abuse</li>
          <li>Comply with law and enforce our Terms</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Legal bases (EEA/UK users)">
        <p>
          Where applicable, we process personal data based on: performance of a
          contract (providing the Service); legitimate interests (securing the
          Service, improving discovery, indexing public creator information);
          consent (where we ask for it); and legal obligations.
        </p>
      </LegalSection>

      <LegalSection title="5. Sharing">
        <p>We may share information with:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-slate-200">Service providers</strong> such
            as hosting (e.g. Vercel), database/auth (e.g. Supabase), payment
            processors, and email infrastructure — only as needed to run the
            Service
          </li>
          <li>
            <strong className="text-slate-200">YouTube / Google APIs</strong> —
            when you or our systems request public channel data under Google’s
            terms and API policies
          </li>
          <li>
            <strong className="text-slate-200">Legal / safety</strong> — if
            required by law or to protect rights, users, or the public
          </li>
        </ul>
        <p>
          We do not sell your account personal information as a standalone
          consumer data product. Access to creator contact fields in the library
          is part of the paid/product offering to authorized users for outreach
          purposes described in our Terms.
        </p>
      </LegalSection>

      <LegalSection title="6. Retention">
        <p>
          We keep account data while your account is active and as needed for
          billing, disputes, and legal requirements. Creator library records are
          retained and refreshed as part of operating the database; outdated
          fields may be updated or removed over time.
        </p>
      </LegalSection>

      <LegalSection title="7. Security">
        <p>
          We use industry-standard measures (HTTPS, access controls, hashed
          passwords via our auth provider). No method of transmission or storage
          is 100% secure.
        </p>
      </LegalSection>

      <LegalSection title="8. Your choices and rights">
        <p>
          You may access or update account information by signing in, and
          request deletion of your account by contacting us. Depending on where
          you live, you may have rights to access, correct, delete, or restrict
          processing of personal data, or to object to certain processing. To
          exercise rights, email{" "}
          <a className="text-violet-400 hover:text-violet-300" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
        <p>
          Creators who believe a public contact listing should be corrected or
          removed may also contact us at the same address. We may need to verify
          the request.
        </p>
      </LegalSection>

      <LegalSection title="9. Children">
        <p>
          The Service is not directed to children under 16 (or the age required
          in your jurisdiction). We do not knowingly collect account data from
          children.
        </p>
      </LegalSection>

      <LegalSection title="10. International transfers">
        <p>
          We may process data in the United States and other countries where our
          providers operate. Where required, we use appropriate safeguards for
          cross-border transfers.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes">
        <p>
          We may update this Policy. We will post the new effective date on this
          page. Continued use after changes means you accept the updated Policy.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          Privacy questions:{" "}
          <a className="text-violet-400 hover:text-violet-300" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
