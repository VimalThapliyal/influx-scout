/**
 * robots.txt client (scrape.txt §17).
 * Cache per origin for 24h. Respect CreatorScoutBot, fall back to *.
 */

export const CRAWLER_USER_AGENT =
  "CreatorScoutBot/1.0 (+https://influencer-platform-mu.vercel.app)";

export const CRAWLER_UA_TOKEN = "CreatorScoutBot";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type RuleGroup = {
  userAgents: string[];
  allow: string[];
  disallow: string[];
};

type RobotsRecord = {
  fetchedAt: number;
  groups: RuleGroup[];
  /** true if robots.txt was fetched successfully (even if empty) */
  ok: boolean;
  /** if fetch failed, fail-open (allow) but record */
  fetchError?: string;
};

const cache = new Map<string, RobotsRecord>();

function originOf(url: string): string | null {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname || "/";
  } catch {
    return "/";
  }
}

/** Match robots path pattern (* = any, $ = end). */
export function pathMatchesRule(path: string, pattern: string): boolean {
  if (!pattern) return false;
  let p = pattern.trim();
  if (p === "") return false;
  if (p === "/") return path.startsWith("/");

  const anchoredEnd = p.endsWith("$");
  if (anchoredEnd) p = p.slice(0, -1);

  let regex = "^";
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "*") regex += ".*";
    else if (/[.+?^${}()|[\]\\]/.test(c)) regex += `\\${c}`;
    else regex += c;
  }
  if (anchoredEnd) regex += "$";
  // Prefix match unless $ used
  if (!anchoredEnd) regex += ".*";

  try {
    return new RegExp(regex, "i").test(path);
  } catch {
    return path.startsWith(p);
  }
}

export function parseRobotsTxt(text: string): RuleGroup[] {
  const groups: RuleGroup[] = [];
  let current: RuleGroup | null = null;
  let pendingAgents: string[] = [];

  const flush = () => {
    if (current && (current.allow.length || current.disallow.length || current.userAgents.length)) {
      groups.push(current);
    }
    current = null;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (key === "user-agent") {
      const agent = value.toLowerCase();
      if (current && (current.allow.length || current.disallow.length)) {
        flush();
        pendingAgents = [agent];
        current = { userAgents: [...pendingAgents], allow: [], disallow: [] };
      } else if (current) {
        current.userAgents.push(agent);
        pendingAgents = current.userAgents;
      } else {
        pendingAgents = pendingAgents.length ? [...pendingAgents, agent] : [agent];
        current = { userAgents: [...pendingAgents], allow: [], disallow: [] };
      }
      continue;
    }

    if (!current) {
      current = { userAgents: pendingAgents.length ? [...pendingAgents] : ["*"], allow: [], disallow: [] };
    }

    if (key === "disallow") {
      current.disallow.push(value);
    } else if (key === "allow") {
      current.allow.push(value);
    } else if (key === "user-agent") {
      // already handled
    }
    // Ignore crawl-delay / sitemap for MVP
  }
  flush();
  return groups;
}

function pickGroup(groups: RuleGroup[], uaToken: string): RuleGroup | null {
  const token = uaToken.toLowerCase();
  let specific: RuleGroup | null = null;
  let wildcard: RuleGroup | null = null;

  for (const g of groups) {
    for (const a of g.userAgents) {
      if (a === "*") wildcard = g;
      else if (a.includes(token) || token.includes(a)) specific = g;
    }
  }
  return specific ?? wildcard;
}

/**
 * Longest matching Allow/Disallow wins (RFC 9309 style approximation).
 * Empty Disallow means allow all for that rule.
 */
export function isPathAllowedByGroups(
  path: string,
  groups: RuleGroup[],
  uaToken: string
): boolean {
  const group = pickGroup(groups, uaToken);
  if (!group) return true;

  type Hit = { type: "allow" | "disallow"; len: number };
  const hits: Hit[] = [];

  for (const rule of group.allow) {
    if (rule === "") continue;
    if (pathMatchesRule(path, rule)) hits.push({ type: "allow", len: rule.length });
  }
  for (const rule of group.disallow) {
    if (rule === "") continue; // empty disallow = allow all
    if (pathMatchesRule(path, rule)) hits.push({ type: "disallow", len: rule.length });
  }

  if (hits.length === 0) return true;
  hits.sort((a, b) => b.len - a.len);
  return hits[0].type === "allow";
}

async function fetchRobotsTxt(origin: string): Promise<RobotsRecord> {
  const robotsUrl = `${origin}/robots.txt`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(robotsUrl, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": CRAWLER_USER_AGENT,
        Accept: "text/plain,*/*",
      },
    });
    if (res.status === 404 || res.status === 410) {
      return { fetchedAt: Date.now(), groups: [], ok: true };
    }
    if (!res.ok) {
      return {
        fetchedAt: Date.now(),
        groups: [],
        ok: false,
        fetchError: `HTTP ${res.status}`,
      };
    }
    const text = await res.text();
    return {
      fetchedAt: Date.now(),
      groups: parseRobotsTxt(text),
      ok: true,
    };
  } catch (err) {
    return {
      fetchedAt: Date.now(),
      groups: [],
      ok: false,
      fetchError: err instanceof Error ? err.message : "fetch failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function getRobotsRecord(origin: string): Promise<RobotsRecord> {
  const key = origin.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }
  const record = await fetchRobotsTxt(origin);
  cache.set(key, record);
  return record;
}

export type RobotsCheck = {
  allowed: boolean;
  origin: string;
  path: string;
  /** robots.txt retrieved OK */
  robotsOk: boolean;
  reason: string;
};

/**
 * Check if crawling url is allowed for CreatorScoutBot.
 * On robots fetch failure: fail-open (allow) but flag robotsOk=false.
 */
export async function checkRobotsUrl(url: string): Promise<RobotsCheck> {
  const origin = originOf(url);
  const path = pathOf(url);
  if (!origin) {
    return {
      allowed: false,
      origin: "",
      path,
      robotsOk: false,
      reason: "Invalid URL",
    };
  }

  const record = await getRobotsRecord(origin);
  if (!record.ok) {
    return {
      allowed: true,
      origin,
      path,
      robotsOk: false,
      reason: `robots.txt unavailable (${record.fetchError}); fail-open`,
    };
  }

  const allowed = isPathAllowedByGroups(path, record.groups, CRAWLER_UA_TOKEN);
  return {
    allowed,
    origin,
    path,
    robotsOk: true,
    reason: allowed ? "Allowed by robots.txt" : "Disallowed by robots.txt",
  };
}

export function clearRobotsCache(): void {
  cache.clear();
}
