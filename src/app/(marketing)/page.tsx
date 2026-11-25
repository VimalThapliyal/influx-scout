import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";
import { getLandingData, type LandingData } from "@/lib/landing-data";
import { getSeoData, type SeoData } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Live counts and sample creators, rebuilt at most once an hour.
export const revalidate = 3600;

export default async function Home() {
  let data: LandingData = { passCount: null, withEmailCount: null, reachableCount: null, creators: [] };
  let seo: SeoData = { combos: [], countryTotals: [] };
  try {
    [data, seo] = await Promise.all([getLandingData(), getSeoData()]);
  } catch {
    // The page still renders (without live numbers) if the database is slow.
  }
  return <LandingPage data={data} seo={seo} />;
}
