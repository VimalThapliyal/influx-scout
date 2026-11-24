/**
 * Track which seed-list roundup URLs have already been imported.
 * Used by grow + Cursor rule to refresh unique URLs with less intervention.
 *
 * Rules:
 * - URLs are always stored normalized (lowercase, no trailing slash, strip tracking params)
 * - Once used, a URL stays used unless --recycle is explicitly enabled
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { resolve } from "path";

export interface SeedHistory {
  used_urls: string[];
  last_import_at?: string;
  last_queued?: number;
  last_links_found?: number;
  updated_at?: string;
}

const HISTORY_PATH = resolve(process.cwd(), "data/seed-history.json");
const FLAG_PATH = resolve(process.cwd(), "data/seeds-need-refresh.flag");

/** Canonical form so the same page is never tracked twice. */
export function normSeedUrl(url: string): string {
  const raw = (url || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    u.hash = "";
    // Drop common tracking / share junk
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
    let path = u.pathname.replace(/\/+$/, "") || "";
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const qs = u.searchParams.toString();
    return `https://${host}${path}${qs ? `?${qs}` : ""}`;
  } catch {
    return raw.replace(/\/+$/, "").toLowerCase();
  }
}

export function historyPath() {
  return HISTORY_PATH;
}

export function flagPath() {
  return FLAG_PATH;
}

export function loadSeedHistory(): SeedHistory {
  if (!existsSync(HISTORY_PATH)) {
    return { used_urls: [] };
  }
  try {
    const raw = JSON.parse(readFileSync(HISTORY_PATH, "utf8")) as SeedHistory;
    const used = Array.from(
      new Set((raw.used_urls || []).map(normSeedUrl).filter(Boolean))
    ).sort();
    return {
      used_urls: used,
      last_import_at: raw.last_import_at,
      last_queued: raw.last_queued,
      last_links_found: raw.last_links_found,
      updated_at: raw.updated_at,
    };
  } catch {
    return { used_urls: [] };
  }
}

export function saveSeedHistory(history: SeedHistory) {
  const next: SeedHistory = {
    ...history,
    used_urls: Array.from(
      new Set((history.used_urls || []).map(normSeedUrl).filter(Boolean))
    ).sort(),
    updated_at: new Date().toISOString().slice(0, 10),
  };
  writeFileSync(HISTORY_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");
}

export function usedSeedUrlSet(): Set<string> {
  return new Set(loadSeedHistory().used_urls.map(normSeedUrl));
}

export function isSeedUrlUsed(url: string, used?: Set<string>): boolean {
  const set = used ?? usedSeedUrlSet();
  return set.has(normSeedUrl(url));
}

export function markSeedUrlsUsed(
  urls: string[],
  stats?: { queued: number; links: number }
) {
  const history = loadSeedHistory();
  const before = history.used_urls.length;
  for (const u of urls) {
    const t = normSeedUrl(u);
    if (t) history.used_urls.push(t);
  }
  history.last_import_at = new Date().toISOString();
  if (stats) {
    history.last_queued = stats.queued;
    history.last_links_found = stats.links;
  }
  saveSeedHistory(history);
  const after = loadSeedHistory().used_urls.length;
  const added = Math.max(0, after - before);
  if (added > 0) {
    console.log(
      `  seed-history: +${added} unique URL(s) marked used (total ${after})`
    );
  }
  return loadSeedHistory();
}

/** Filter a list of seed entries down to URLs never imported before. */
export function filterUnusedSeedEntries<T extends { url: string }>(
  entries: T[]
): { unused: T[]; skipped: T[] } {
  const used = usedSeedUrlSet();
  const seen = new Set<string>();
  const unused: T[] = [];
  const skipped: T[] = [];
  for (const e of entries) {
    const n = normSeedUrl(e.url);
    if (!n || used.has(n) || seen.has(n)) {
      skipped.push(e);
      continue;
    }
    seen.add(n);
    unused.push(e);
  }
  return { unused, skipped };
}

/** Low new yield → seeds are mostly already known; refresh next time. */
export function seedsLookExhausted(queued: number, linksFound: number): boolean {
  if (linksFound <= 0) return true;
  if (queued <= 5) return true;
  if (linksFound >= 20 && queued / linksFound < 0.08) return true;
  return false;
}

export function setSeedsNeedRefresh(reason: string) {
  writeFileSync(
    FLAG_PATH,
    `${new Date().toISOString()}\n${reason}\nSay "grow" in Cursor to fetch fresh unique seed URLs.\n`,
    "utf8"
  );
}

export function clearSeedsNeedRefresh() {
  if (existsSync(FLAG_PATH)) unlinkSync(FLAG_PATH);
}

export function seedsNeedRefresh(): boolean {
  return existsSync(FLAG_PATH);
}
