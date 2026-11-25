/** Primary markets — USA & Europe (from product brief). */
export const TARGET_MARKET_LABEL = "USA & Europe";

/** ISO 3166-1 alpha-2 codes for European markets we target. */
export const EUROPE_COUNTRY_CODES = [
  "GB",
  "DE",
  "FR",
  "NL",
  "ES",
  "IT",
  "SE",
  "PL",
  "IE",
  "BE",
  "AT",
  "CH",
  "NO",
  "DK",
  "FI",
  "PT",
  "CZ",
  "RO",
  "HU",
  "GR",
] as const;

export const USA_COUNTRY_CODE = "US";

/** Same countries the quality checks accept: US, Canada, Australia and Europe. */
export const TARGET_COUNTRY_CODES: string[] = [
  USA_COUNTRY_CODE,
  "CA",
  "AU",
  ...EUROPE_COUNTRY_CODES,
];

/** Rotate YouTube `regionCode` across key markets for broader coverage. */
export const SEARCH_REGION_ROTATION = ["US", "GB", "DE", "FR", "NL", "ES"] as const;

export type SearchRegionCode = (typeof SEARCH_REGION_ROTATION)[number];

export function isTargetMarketCountry(country: string | null | undefined): boolean {
  if (!country) return false;
  return TARGET_COUNTRY_CODES.includes(country.toUpperCase());
}

/**
 * Library browse: treat unknown YouTube country as eligible for USA & Europe.
 * (Many creators omit country — excluding them hides overnight enrich results.)
 */
export function isTargetMarketCountryOrUnknown(
  country: string | null | undefined
): boolean {
  if (!country) return true;
  return TARGET_COUNTRY_CODES.includes(country.toUpperCase());
}

/** PostgREST `.or(...)` for us-eu market including null country. */
export function targetMarketOrFilter(): string {
  return `country.is.null,country.in.(${TARGET_COUNTRY_CODES.join(",")})`;
}

export function pickRotatingRegionCode(seed: number): SearchRegionCode {
  return SEARCH_REGION_ROTATION[seed % SEARCH_REGION_ROTATION.length];
}

export function regionRelevanceLanguage(regionCode: string): string {
  return ["US", "GB", "IE"].includes(regionCode) ? "en" : "en";
}
