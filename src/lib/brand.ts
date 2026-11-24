import { POSITIONING } from "./positioning";

export const BRAND_NAME = "Influx";

export const BRAND_TAGLINE = "YouTube outreach for USA & Europe";

export const BRAND_TITLE = `${BRAND_NAME} — YouTube Creator Outreach`;

export const BRAND_DESCRIPTION = `${POSITIONING.workflow}. ${POSITIONING.scope}.`;

export const BRAND_LOGO_LETTERS = "In";

export const BRAND_STORAGE_PREFIX = "influx";

/** Shown on Privacy / Terms / Cookies. Override with NEXT_PUBLIC_SUPPORT_EMAIL. */
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "support@influx.app";

export const LEGAL_EFFECTIVE_DATE = "July 16, 2026";
