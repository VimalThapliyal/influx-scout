/**
 * Extract public emails from channel description links (Linktree, sites, etc.).
 * Does NOT touch YouTube CAPTCHA / "View email address".
 */

import {
  CRAWLER_USER_AGENT,
  checkRobotsUrl,
} from "./robots";

const EMAIL_RE =
  /(?:mailto:)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;

const URL_RE =
  /https?:\/\/[^\s<>"'\)\]]+/gi;

const JUNK_EMAIL_PARTS = [
  "noreply",
  "no-reply",
  "donotreply",
  "example.com",
  "sentry.io",
  "wixpress.com",
  "cloudflare",
  "schema.org",
  "github.com",
  "googleapis.com",
  "w3.org",
  "placeholder",
  "your@email",
  "email@domain",
  "name@email",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  "zendesk.com",
  "wix.com",
  "squarespace.com",
  "newyorker.com",
  "nytimes.com",
  "patreon.com",
  "support@",
  "privacy@",
  "legal@",
  "press@",
  "guidelines@",
  "help@",
  "abuse@",
];

/** Hosts that rarely expose a public email — skip fetch (Instagram handled separately). */
const SKIP_FETCH_HOSTS = [
  "youtube.com",
  "youtu.be",
  "google.com",
  "gstatic.com",
  "facebook.com",
  "fb.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "linkedin.com",
  "reddit.com",
  "discord.com",
  "discord.gg",
  "twitch.tv",
  "amazon.com",
  "amzn.to",
  "apple.com",
  "apps.apple.com",
  "play.google.com",
  "spotify.com",
  "music.apple.com",
];

/** Link-in-bio / contact pages — fetch first. */
const PRIORITY_HOST_PARTS = [
  "linktr.ee",
  "linktree.com",
  "beacons.ai",
  "bio.link",
  "carrd.co",
  "stan.store",
  "withkoji.com",
  "koji.to",
  "allmylinks.com",
  "lnk.bio",
  "tap.bio",
  "campsite.bio",
  "solo.to",
  "snipfeed.co",
  "flow.page",
  "msha.ke",
  "milkshake.app",
  "direct.me",
  "contactin.bio",
  "hoo.be",
];

/** Likely contact / collab paths on a creator-owned site (scrape.txt §16.1). */
export const WEBSITE_CONTACT_PATHS = [
  "/",
  "/contact",
  "/contact-us",
  "/contactus",
  "/work-with-me",
  "/workwithme",
  "/collaborate",
  "/collaboration",
  "/partnerships",
  "/partnership",
  "/sponsorship",
  "/sponsor",
  "/media-kit",
  "/mediakit",
  "/about",
  "/about-me",
  "/aboutme",
  "/press",
  "/business",
  "/management",
  "/booking",
];

export type EmailSourceType =
  | "description"
  | "creator_website"
  | "link_in_bio"
  | "management_website"
  | "instagram"
  | "other";

export type SocialLinks = {
  website: string | null;
  instagram: string | null;
  twitter: string | null;
  tiktok: string | null;
};

export type LinkEmailResult = SocialLinks & {
  email: string | null;
  emailSource: string | null;
  emailSourceType: EmailSourceType | null;
  urlsTried: string[];
  contactForm: ContactFormInfo | null;
  robots: {
    allowedPages: number;
    blockedPages: number;
    robotsOk: boolean;
    anyAllowed: boolean;
  } | null;
};

function normalizeUrl(raw: string): string | null {
  let u = raw.replace(/[.,;:!?)]+$/, "").trim();
  if (!u) return null;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function classifyEmailSourceType(
  source: string | null | undefined
): EmailSourceType | null {
  if (!source) return null;
  if (source === "description") return "description";
  const host = hostOf(source);
  if (!host) return "other";
  if (host.includes("instagram.com") || host === "instagr.am") return "instagram";
  if (PRIORITY_HOST_PARTS.some((p) => host.includes(p))) return "link_in_bio";
  if (
    /manag|talent|agency|roster|booking/i.test(host) ||
    /\/(management|talent|roster|agency)\b/i.test(source)
  ) {
    return "management_website";
  }
  return "creator_website";
}

export function isJunkEmail(email: string): boolean {
  let e = email.toLowerCase().trim();
  e = e.replace(/^u003[ce]/, "").replace(/^3[ce]/, "");
  if (!e.includes("@") || e.length < 6 || e.length > 120) return true;
  if (JUNK_EMAIL_PARTS.some((p) => e.includes(p))) return true;
  if (/^\d+@/.test(e)) return true;
  return false;
}

export function extractEmailsFromText(text: string): string[] {
  const found = new Set<string>();
  const cleaned = text
    .replace(/\\u003[ce]/gi, "")
    .replace(/u003[ce]/gi, "")
    .replace(/&#?\w+;/g, " ");
  let m: RegExpExecArray | null;
  const re = new RegExp(EMAIL_RE.source, EMAIL_RE.flags);
  while ((m = re.exec(cleaned)) !== null) {
    let email = (m[1] ?? m[0]).replace(/^mailto:/i, "").toLowerCase();
    email = email.replace(/^u003[ce]/, "");
    if (!isJunkEmail(email)) found.add(email);
  }
  return Array.from(found);
}

export function extractUrlsFromText(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(URL_RE.source, URL_RE.flags);
  while ((m = re.exec(text)) !== null) {
    const n = normalizeUrl(m[0]);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    found.push(n);
  }
  return found;
}

export function classifySocialLinks(urls: string[]): SocialLinks {
  const out: SocialLinks = {
    website: null,
    instagram: null,
    twitter: null,
    tiktok: null,
  };

  for (const url of urls) {
    const host = hostOf(url);
    if (!host) continue;

    if (!out.instagram && (host.includes("instagram.com") || host === "instagr.am")) {
      out.instagram = url;
      continue;
    }
    if (
      !out.twitter &&
      (host === "twitter.com" || host === "x.com" || host.endsWith(".twitter.com"))
    ) {
      out.twitter = url;
      continue;
    }
    if (!out.tiktok && host.includes("tiktok.com")) {
      out.tiktok = url;
      continue;
    }
    if (
      !out.website &&
      !SKIP_FETCH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)) &&
      !host.includes("instagram.com") &&
      !host.includes("tiktok.com") &&
      host !== "twitter.com" &&
      host !== "x.com"
    ) {
      out.website = url;
    }
  }

  return out;
}

function urlPriority(url: string): number {
  const host = hostOf(url);
  if (PRIORITY_HOST_PARTS.some((p) => host.includes(p))) return 0;
  // Instagram last among fetchable (often login-walled)
  if (host.includes("instagram.com")) return 50;
  if (SKIP_FETCH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return 99;
  return 1;
}

export function rankUrlsForEmailFetch(urls: string[], max = 4): string[] {
  return [...urls]
    .filter((u) => urlPriority(u) < 99)
    .sort((a, b) => urlPriority(a) - urlPriority(b))
    .slice(0, max);
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi, " $1 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

export type ContactFormInfo = {
  found: boolean;
  pageUrl: string | null;
  purpose: string | null;
  hasCaptcha: boolean;
  action: string | null;
};

const CAPTCHA_RE =
  /recaptcha|hcaptcha|captcha|turnstile|cf-turnstile|g-recaptcha|h-captcha/i;

const LOGIN_FORM_RE =
  /type=["']password["']|name=["'](?:password|passwd|login|username)["']/i;

const SEARCH_FORM_RE =
  /role=["']search["']|type=["']search["']|name=["'](?:q|query|search|s)["']/i;

const NEWSLETTER_ONLY_RE =
  /newsletter|subscribe|mailing.?list/i;

function inferFormPurpose(pageUrl: string, html: string, formHtml: string): string {
  const blob = `${pageUrl} ${html.slice(0, 2000)} ${formHtml}`.toLowerCase();
  if (/sponsor|sponsorship|brand.?partner|partnership/.test(blob)) {
    return "brand partnerships";
  }
  if (/work.?with.?me|collaborat|collab|booking/.test(blob)) {
    return "collaborations / booking";
  }
  if (/media.?kit|press/.test(blob)) return "press / media";
  if (/management|talent|represent/.test(blob)) return "management inquiry";
  if (/contact/.test(blob)) return "general contact";
  return "contact form";
}

/** Detect a public contact/collaborate form in HTML. Never submits. */
export function detectContactFormInHtml(
  html: string,
  pageUrl: string
): ContactFormInfo {
  const empty: ContactFormInfo = {
    found: false,
    pageUrl: null,
    purpose: null,
    hasCaptcha: false,
    action: null,
  };
  if (!html || html.length < 40) return empty;

  const formMatches = Array.from(
    html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/gi)
  );
  if (formMatches.length === 0) {
    // JS-rendered contact widgets sometimes expose text only
    if (
      /get.?in.?touch|send.?us.?a.?message|contact.?form|work.?with.?me/i.test(
        html
      ) &&
      /<input\b/i.test(html)
    ) {
      return {
        found: true,
        pageUrl,
        purpose: inferFormPurpose(pageUrl, html, ""),
        hasCaptcha: CAPTCHA_RE.test(html),
        action: null,
      };
    }
    return empty;
  }

  for (const m of formMatches) {
    const full = m[0] ?? "";
    const inner = m[1] ?? "";
    if (LOGIN_FORM_RE.test(full)) continue;
    if (SEARCH_FORM_RE.test(full) && !/email|message|textarea/i.test(full)) {
      continue;
    }
    // Skip pure newsletter if only email field and newsletter wording
    const hasMessage =
      /<textarea\b/i.test(full) ||
      /name=["'](?:message|body|comments|inquiry|details)["']/i.test(full);
    const hasEmailField =
      /type=["']email["']/i.test(full) || /name=["'][^"']*email/i.test(full);
    if (
      !hasMessage &&
      hasEmailField &&
      NEWSLETTER_ONLY_RE.test(full) &&
      !/contact|partner|collab|sponsor|work.?with/i.test(pageUrl + full)
    ) {
      continue;
    }
    if (!hasEmailField && !hasMessage && !/<input\b/i.test(full)) continue;

    const actionMatch = full.match(/action=["']([^"']+)["']/i);
    let action = actionMatch?.[1]?.trim() || null;
    if (action === "#" || action === "") action = null;

    return {
      found: true,
      pageUrl,
      purpose: inferFormPurpose(pageUrl, html, inner.slice(0, 500)),
      hasCaptcha: CAPTCHA_RE.test(full) || CAPTCHA_RE.test(html.slice(0, 8000)),
      action,
    };
  }

  return empty;
}

export async function fetchPageHtml(
  url: string,
  opts?: { timeoutMs?: number; maxBytes?: number; respectRobots?: boolean }
): Promise<string | null> {
  if (opts?.respectRobots !== false) {
    const check = await checkRobotsUrl(url);
    if (!check.allowed) return null;
  }

  const timeoutMs = opts?.timeoutMs ?? 10_000;
  const maxBytes = opts?.maxBytes ?? 600_000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": CRAWLER_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) return null;
    const ctype = res.headers.get("content-type") ?? "";
    if (
      ctype &&
      !ctype.includes("text/html") &&
      !ctype.includes("text/plain") &&
      !ctype.includes("application/xhtml") &&
      !ctype.includes("json")
    ) {
      return null;
    }
    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > maxBytes ? buf.slice(0, maxBytes) : buf;
    return new TextDecoder("utf-8", { fatal: false }).decode(slice);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPageText(
  url: string,
  opts?: { timeoutMs?: number; maxBytes?: number }
): Promise<string | null> {
  const html = await fetchPageHtml(url, opts);
  return html ? htmlToText(html) : null;
}

/**
 * Best-effort: pull a public email from an Instagram profile page / bio.
 * Also follows the profile's external / link-in-bio URL (often Linktree).
 * Often fails when Instagram shows a login wall — that is expected.
 * Does NOT solve YouTube CAPTCHA business emails.
 */
export async function findEmailFromInstagramProfile(
  instagramUrl: string
): Promise<{ email: string | null; source: string | null }> {
  const url = normalizeUrl(instagramUrl);
  if (!url || !hostOf(url).includes("instagram.com")) {
    return { email: null, source: null };
  }

  const timeoutMs = 14_000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return { email: null, source: null };
    const html = await res.text();

    // Structured fields Instagram sometimes embeds publicly
    for (const re of [
      /"public_email"\s*:\s*"([^"]+@[^"]+)"/gi,
      /"business_email"\s*:\s*"([^"]+@[^"]+)"/gi,
      /"email"\s*:\s*"([^"]+@[^"]+)"/gi,
      /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    ]) {
      for (const m of Array.from(html.matchAll(re))) {
        const email = (m[1] || "").toLowerCase();
        if (email && !isJunkEmail(email)) {
          return { email, source: url };
        }
      }
    }

    const bioChunks: string[] = [];
    for (const m of Array.from(
      html.matchAll(/"biography"\s*:\s*"((?:\\.|[^"\\])*)"/gi)
    )) {
      bioChunks.push(
        m[1]
          .replace(/\\u0026/g, "&")
          .replace(/\\n/g, " ")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\")
      );
    }
    for (const m of Array.from(
      html.matchAll(/property="og:description"\s+content="([^"]*)"/gi)
    )) {
      bioChunks.push(m[1]);
    }
    for (const m of Array.from(
      html.matchAll(/content="([^"]*)"\s+property="og:description"/gi)
    )) {
      bioChunks.push(m[1]);
    }

    const blob = `${bioChunks.join(" ")} ${htmlToText(html)}`;
    const emails = extractEmailsFromText(blob);
    if (emails.length > 0) {
      return { email: emails[0], source: url };
    }

    // Follow external / bio link (Linktree, Beacons, etc.)
    const externalUrls: string[] = [];
    for (const re of [
      /"external_url"\s*:\s*"(https?:\\\/\\\/[^"]+)"/gi,
      /"external_url"\s*:\s*"(https?:\/\/[^"]+)"/gi,
      /"url"\s*:\s*"(https?:\\\/\\\/(?:linktr\.ee|beacons\.ai|bio\.link|carrd\.co|stan\.store|lnk\.bio|solo\.to)[^"]*)"/gi,
      /rel="me nofollow noopener noreferrer"[^>]*href="(https?:\/\/[^"]+)"/gi,
      /href="(https?:\/\/(?:linktr\.ee|beacons\.ai|bio\.link|carrd\.co|stan\.store|lnk\.bio|solo\.to)[^"]*)"/gi,
    ]) {
      for (const m of Array.from(html.matchAll(re))) {
        let raw = (m[1] || "")
          .replace(/\\\//g, "/")
          .replace(/\\u0026/g, "&");
        const n = normalizeUrl(raw);
        if (n && !hostOf(n).includes("instagram.com")) externalUrls.push(n);
      }
    }
    // Also any link-in-bio style URL in bio text
    for (const u of extractUrlsFromText(bioChunks.join(" "))) {
      if (!hostOf(u).includes("instagram.com")) externalUrls.push(u);
    }

    const uniqueExt = Array.from(new Set(externalUrls)).slice(0, 3);
    for (const ext of uniqueExt) {
      const text = await fetchPageText(ext);
      if (!text) continue;
      const found = extractEmailsFromText(text);
      if (found.length > 0) {
        return { email: found[0], source: ext };
      }
    }

    return { email: null, source: null };
  } catch {
    return { email: null, source: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function findPublicEmailFromUrls(
  urls: string[],
  opts?: { maxUrls?: number; delayMs?: number; tryInstagram?: boolean }
): Promise<{ email: string | null; source: string | null; tried: string[] }> {
  const candidates = rankUrlsForEmailFetch(urls, opts?.maxUrls ?? 4);
  const delayMs = opts?.delayMs ?? 400;
  const tried: string[] = [];

  for (const url of candidates) {
    tried.push(url);
    if (hostOf(url).includes("instagram.com")) {
      if (opts?.tryInstagram === false) continue;
      const ig = await findEmailFromInstagramProfile(url);
      if (ig.email) return { email: ig.email, source: ig.source, tried };
    } else {
      const text = await fetchPageText(url);
      if (text) {
        const emails = extractEmailsFromText(text);
        if (emails.length > 0) {
          return { email: emails[0], source: url, tried };
        }
      }
    }
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }

  return { email: null, source: null, tried };
}

/**
 * Crawl a creator website homepage + common contact paths for a public email
 * and/or contact form (scrape.txt §16 / §20). HTTP only — never submits forms.
 * Respects robots.txt for CreatorScoutBot (scrape.txt §17).
 */
export async function findPublicEmailFromWebsite(
  websiteUrl: string,
  opts?: { maxPages?: number; delayMs?: number }
): Promise<{
  email: string | null;
  source: string | null;
  tried: string[];
  contactForm: ContactFormInfo | null;
  robots: {
    allowedPages: number;
    blockedPages: number;
    robotsOk: boolean;
    /** true if at least one useful page was allowed */
    anyAllowed: boolean;
  };
}> {
  const emptyRobots = {
    allowedPages: 0,
    blockedPages: 0,
    robotsOk: true,
    anyAllowed: false,
  };

  const base = normalizeUrl(websiteUrl);
  const tried: string[] = [];
  if (!base) {
    return {
      email: null,
      source: null,
      tried,
      contactForm: null,
      robots: emptyRobots,
    };
  }

  let origin: string;
  try {
    const u = new URL(base);
    origin = `${u.protocol}//${u.host}`;
  } catch {
    return {
      email: null,
      source: null,
      tried,
      contactForm: null,
      robots: emptyRobots,
    };
  }

  const maxPages = Math.min(opts?.maxPages ?? 8, WEBSITE_CONTACT_PATHS.length);
  const delayMs = opts?.delayMs ?? 350;
  const paths = WEBSITE_CONTACT_PATHS.slice(0, maxPages);

  const firstPaths: string[] = [];
  try {
    const u = new URL(base);
    if (u.pathname && u.pathname !== "/") {
      firstPaths.push(base);
    }
  } catch {
    /* ignore */
  }

  const pageUrls = [
    ...firstPaths,
    ...paths.map((p) => (p === "/" ? `${origin}/` : `${origin}${p}`)),
  ];
  const seen = new Set<string>();
  let contactForm: ContactFormInfo | null = null;
  let email: string | null = null;
  let source: string | null = null;
  let allowedPages = 0;
  let blockedPages = 0;
  let robotsOk = true;

  for (const url of pageUrls) {
    const key = url.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tried.push(url);

    const robots = await checkRobotsUrl(url);
    if (!robots.robotsOk) robotsOk = false;
    if (!robots.allowed) {
      blockedPages++;
      continue;
    }
    allowedPages++;

    const html = await fetchPageHtml(url, { respectRobots: false });
    if (html) {
      if (!email) {
        const emails = extractEmailsFromText(htmlToText(html));
        if (emails.length > 0) {
          email = emails[0];
          source = url;
        }
      }
      if (!contactForm?.found) {
        const form = detectContactFormInHtml(html, url);
        if (form.found) contactForm = form;
      }
      if (email && contactForm?.found) break;
    }
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }

  return {
    email,
    source,
    tried,
    contactForm,
    robots: {
      allowedPages,
      blockedPages,
      robotsOk,
      anyAllowed: allowedPages > 0,
    },
  };
}

/** Parse description → social fields + optional public email from linked pages. */
export async function enrichContactsFromDescription(
  description: string | null | undefined,
  opts?: {
    existingEmail?: string | null;
    existingWebsite?: string | null;
    fetchLinks?: boolean;
    maxUrls?: number;
    tryInstagram?: boolean;
    crawlWebsitePaths?: boolean;
  }
): Promise<LinkEmailResult> {
  const text = description ?? "";
  const urls = extractUrlsFromText(text);
  if (opts?.existingWebsite) urls.unshift(opts.existingWebsite);
  const social = classifySocialLinks(urls);
  if (opts?.existingWebsite && !social.website) {
    social.website = opts.existingWebsite;
  }
  const descEmails = extractEmailsFromText(text);

  let email = opts?.existingEmail?.toLowerCase() ?? null;
  if (email && isJunkEmail(email)) email = null;
  if (!email && descEmails.length > 0) email = descEmails[0];

  let emailSource: string | null = email ? "description" : null;
  let urlsTried: string[] = [];
  let contactForm: ContactFormInfo | null = null;
  let robots: LinkEmailResult["robots"] = null;

  // Prefer crawling the known website contact paths (highest trust).
  if (
    opts?.crawlWebsitePaths !== false &&
    (social.website || opts?.existingWebsite)
  ) {
    const site = social.website || opts!.existingWebsite!;
    const fromSite = await findPublicEmailFromWebsite(site, { maxPages: 8 });
    urlsTried.push(...fromSite.tried);
    robots = fromSite.robots;
    if (fromSite.contactForm?.found) {
      contactForm = fromSite.contactForm;
    }
    if (!email && fromSite.email) {
      email = fromSite.email;
      emailSource = fromSite.source;
    }
  }

  if (!email && opts?.fetchLinks !== false && urls.length > 0) {
    const found = await findPublicEmailFromUrls(urls, {
      maxUrls: opts?.maxUrls ?? 5,
      tryInstagram: opts?.tryInstagram === true,
    });
    urlsTried = [...urlsTried, ...found.tried];
    if (found.email) {
      email = found.email;
      emailSource = found.source;
    }
  }

  // Explicit Instagram pass only when requested
  if (
    !email &&
    opts?.tryInstagram === true &&
    social.instagram &&
    !urlsTried.includes(social.instagram)
  ) {
    urlsTried.push(social.instagram);
    const ig = await findEmailFromInstagramProfile(social.instagram);
    if (ig.email) {
      email = ig.email;
      emailSource = ig.source;
    }
  }

  return {
    ...social,
    email,
    emailSource,
    emailSourceType: classifyEmailSourceType(emailSource),
    urlsTried,
    contactForm,
    robots,
  };
}
