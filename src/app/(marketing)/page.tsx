import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";
import { getLandingData, type LandingData } from "@/lib/landing-data";
import { getSeoCombos, type SeoCombo } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Live counts and sample creators, rebuilt at most once an hour.
export const revalidate = 3600;

export default async function Home() {
  let data: LandingData = { libraryCount: null, passCount: null, creators: [] };
  let combos: SeoCombo[] = [];
  try {
    [data, combos] = await Promise.all([getLandingData(), getSeoCombos()]);
  } catch {
    // The page still renders (without live numbers) if the database is slow.
  }
  return <LandingPage data={data} combos={combos} />;
}
