import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, Bebas_Neue, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { BRAND_DESCRIPTION, BRAND_TITLE } from "@/lib/brand";
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

export const metadata: Metadata = {
  title: BRAND_TITLE,
  description: BRAND_DESCRIPTION,
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
