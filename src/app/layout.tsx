import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, Bebas_Neue, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { BRAND_NAME } from "@/lib/brand";
import { SITE_URL } from "@/lib/seo";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

// Marketing-site type system (contact-sheet / production-log direction).
// Scoped to the (marketing) route group via the `font-poster`/`font-plex`/
// `font-mono` Tailwind tokens -- the app dashboard keeps Inter/Jakarta.
const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bebas",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
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
      className={`${inter.variable} ${jakarta.variable} ${bebas.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
