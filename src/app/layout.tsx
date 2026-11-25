import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { BRAND_NAME } from "@/lib/brand";
import { SITE_URL } from "@/lib/seo";
import "./globals.css";

// One family for the whole product. See DESIGN_SYSTEM.md.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const SEO_DESCRIPTION =
  "Find active YouTube influencers in the USA & Europe by niche, views and engagement — " +
  "with public business contacts and outreach tracking.";

export const metadata: Metadata = {
  // Absolute URLs for canonical/OG tags; switch domains via NEXT_PUBLIC_APP_URL.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND_NAME} — Find YouTube Influencers in the USA & Europe`,
    template: "%s",
  },
  description: SEO_DESCRIPTION,
  // Google Search Console ownership tag (content value only, not the whole <meta>).
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
  openGraph: {
    siteName: BRAND_NAME,
    type: "website",
    locale: "en_US",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={inter.variable}
    >
      <body>{children}</body>
    </html>
  );
}
