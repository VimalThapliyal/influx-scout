import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { RemovalRequestForm } from "@/components/RemovalRequestForm";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Remove My Listing — ${BRAND_NAME}`,
  description: `YouTube creators can ask ${BRAND_NAME} to remove their channel and contact details from our lists.`,
  alternates: { canonical: "/remove-my-listing" },
};

export default function RemoveMyListingPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-xl">
        <h1 className="h-page">Remove my listing</h1>
        <p className="text-body mt-3">
          {BRAND_NAME} lists public information about YouTube channels — channel name, public statistics and
          business contact details the creator has published. If you&apos;d rather not be listed, send this form
          and we&apos;ll hide your channel right away.
        </p>
        <ul className="mt-4 space-y-1.5 text-sm text-muted">
          <li>• Your channel disappears from our public pages and from search results inside {BRAND_NAME}.</li>
          <li>• We won&apos;t re-add it when our lists refresh.</li>
          <li>• You can also ask us to delete the stored data entirely — mention it in the reason.</li>
        </ul>
        <div className="mt-8">
          <RemovalRequestForm />
        </div>
        <p className="mt-6 text-xs text-muted">
          See our <Link href="/privacy" className="text-link">Privacy Policy</Link> for how we handle data.
        </p>
      </div>
    </MarketingShell>
  );
}
