import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, LegalSection } from "@/components/LegalDoc";
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Terms of Service — ${BRAND_NAME}`,
  description: `Terms governing use of the ${BRAND_NAME} YouTube creator outreach Service.`,
};

export default function TermsPage() {
  return (
    <LegalDoc title="Terms of Service">
      <p>
        These Terms of Service (“Terms”) govern your access to and use of{" "}
        {BRAND_NAME} (the “Service”). By creating an account or using the
        Service, you agree to these Terms and our{" "}
        <Link href="/privacy" className="text-violet-400 hover:text-violet-300">
          Privacy Policy
        </Link>
        .
      </p>

      <LegalSection title="1. The Service">
        <p>
          {BRAND_NAME} provides tools to browse a library of YouTube creator
          profiles (focused on USA &amp; Europe outreach), filter and score
          channels, save campaign lists, and unlock publicly sourced contact
          details according to your plan. The library is built using the
          YouTube Data API and is subject to Google’s policies.
        </p>
        <p>
          We are <strong className="text-fg">not</strong> affiliated with
          YouTube, Google, or any creator. The Service is an independent
          discovery and outreach workflow tool.
        </p>
      </LegalSection>

      <LegalSection title="2. Accounts">
        <p>
          You must provide accurate registration information and keep your
          credentials secure. You are responsible for activity under your
          account. We may suspend or terminate accounts that violate these Terms
          or create risk for the Service or others.
        </p>
      </LegalSection>

      <LegalSection title="3. Subscriptions and payments">
        <p>
          Paid features (such as email unlock or higher limits) require an
          active subscription. Fees, billing intervals, and plan limits are
          described on our pricing page. Taxes may apply. Unless required by
          law, fees are non-refundable once a billing period has started.
        </p>
      </LegalSection>

      <LegalSection title="4. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Use creator contact data for spam, harassment, fraud, phishing, or
            unlawful marketing
          </li>
          <li>
            Violate CAN-SPAM, GDPR, ePrivacy, TCPA, or other applicable
            marketing and privacy laws when contacting creators
          </li>
          <li>
            Scrape, bulk-export, or resell the library in a way that competes
            with or circumvents the Service without our written permission
          </li>
          <li>
            Bypass paywalls, rate limits, CAPTCHAs, or access controls, or
            probe the Service for vulnerabilities except through coordinated
            disclosure
          </li>
          <li>
            Misrepresent affiliation with YouTube, Google, {BRAND_NAME}, or any
            brand or creator
          </li>
          <li>Upload malware or interfere with Service operations</li>
        </ul>
        <p>
          <strong className="text-fg">You</strong> are the sender of any
          outreach to creators. {BRAND_NAME} provides data and drafting helpers;
          you are responsible for lawful, consensual, and professional
          communication.
        </p>
      </LegalSection>

      <LegalSection title="5. Creator data and accuracy">
        <p>
          Library data comes from public sources and third-party APIs. Emails,
          social links, stats, niches, and country labels may be incomplete,
          outdated, or incorrect. We do not warrant that any contact is
          monitored, preferred for sponsorships, or authorized for commercial
          messages.
        </p>
        <p>
          Metrics may expire and be refreshed on a schedule. “Trust” or
          provenance labels describe our enrichment process; they are not legal
          certifications.
        </p>
      </LegalSection>

      <LegalSection title="6. Intellectual property">
        <p>
          The Service, branding, software, and curated database structure are
          owned by us or our licensors. You retain rights to content you submit
          (for example list names or outreach drafts). Public creator content
          remains owned by the respective rights holders.
        </p>
      </LegalSection>

      <LegalSection title="7. Third-party services">
        <p>
          The Service depends on providers such as hosting, authentication,
          databases, payments, and the YouTube Data API. Their terms and
          availability may affect the Service. We are not responsible for
          third-party outages or policy changes (including API quota limits).
        </p>
      </LegalSection>

      <LegalSection title="8. Disclaimers">
        <p>
          THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES
          OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY,
          FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT
          GUARANTEE UNINTERRUPTED ACCESS, SPECIFIC RESULTS FROM OUTREACH, OR
          CONTINUED AVAILABILITY OF ANY CREATOR CONTACT.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, {BRAND_NAME.toUpperCase()} AND
          ITS OPERATORS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR
          GOODWILL. OUR TOTAL LIABILITY FOR CLAIMS ARISING FROM THE SERVICE IS
          LIMITED TO THE AMOUNTS YOU PAID US IN THE THREE (3) MONTHS BEFORE THE
          CLAIM (OR USD $50 IF YOU HAVE NOT PAID).
        </p>
      </LegalSection>

      <LegalSection title="10. Indemnity">
        <p>
          You will defend and indemnify us against claims arising from your
          outreach, misuse of creator data, or violation of these Terms or
          applicable law.
        </p>
      </LegalSection>

      <LegalSection title="11. Termination">
        <p>
          You may stop using the Service at any time. We may suspend or end
          access if you breach these Terms. Sections that by nature should
          survive (including acceptable use, disclaimers, liability limits, and
          indemnity) will survive termination.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes">
        <p>
          We may update these Terms by posting a new version with an updated
          effective date. Material changes may also be communicated by email
          when appropriate. Continued use after the effective date constitutes
          acceptance.
        </p>
      </LegalSection>

      <LegalSection title="13. Governing law">
        <p>
          These Terms are governed by the laws of the jurisdiction in which the
          Service operator is established, without regard to conflict-of-law
          rules, unless mandatory consumer protections in your country require
          otherwise. Courts in that jurisdiction will have exclusive venue,
          except where prohibited.
        </p>
      </LegalSection>

      <LegalSection title="14. Contact">
        <p>
          Questions about these Terms:{" "}
          <a className="text-violet-400 hover:text-violet-300" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
