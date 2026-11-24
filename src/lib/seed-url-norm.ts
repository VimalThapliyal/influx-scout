/** Canonical seed URL form for shared pool dedupe. */
export function normSeedUrl(url: string): string {
  const raw = (url || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    u.hash = "";
    for (const key of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "fbclid",
      "gclid",
      "srsltid",
      "ref",
    ]) {
      u.searchParams.delete(key);
    }
    const path = u.pathname.replace(/\/+$/, "") || "";
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const qs = u.searchParams.toString();
    return `https://${host}${path}${qs ? `?${qs}` : ""}`;
  } catch {
    return raw.replace(/\/+$/, "").toLowerCase();
  }
}
