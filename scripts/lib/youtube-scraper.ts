import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { extractEmail, extractSocialLinks } from "../../src/lib/scoring";
import { AUTH_STATE_PATH, hasAuthState, waitForEnter } from "./auth";
import type { EmailStatus } from "./supabase";

export interface ScrapeResult {
  email: string | null;
  website: string | null;
  instagram: string | null;
  twitter: string | null;
  tiktok: string | null;
  description: string | null;
  email_status: EmailStatus;
  pageText: string;
}

export interface ScrapeOptions {
  pauseOnCaptcha: boolean;
}

const BLOCKED_WEBSITE_DOMAINS = [
  "gstatic.com",
  "google.com",
  "googleapis.com",
  "youtube.com",
  "ytimg.com",
  "ggpht.com",
  "googleusercontent.com",
];

function aboutUrl(channel: { id: string; handle: string | null }): string {
  if (channel.handle) {
    const h = channel.handle.startsWith("@") ? channel.handle : `@${channel.handle}`;
    return `https://www.youtube.com/${h}/about`;
  }
  return `https://www.youtube.com/channel/${channel.id}/about`;
}

function sanitizeUrl(url: string | null): string | null {
  if (!url) return null;
  const cleaned = url.replace(/\\?["']+$/g, "").trim();
  if (!cleaned.startsWith("http")) return null;
  if (BLOCKED_WEBSITE_DOMAINS.some((d) => cleaned.includes(d))) return null;
  return cleaned;
}

async function dismissConsent(page: Page) {
  const selectors = [
    'button:has-text("Accept all")',
    'button:has-text("Reject all")',
    'button[aria-label*="Accept"]',
  ];

  for (const selector of selectors) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.click().catch(() => undefined);
      await page.waitForTimeout(800);
      return;
    }
  }
}

async function isCaptchaVisible(page: Page): Promise<boolean> {
  const iframeCaptcha = await page.locator('iframe[src*="recaptcha"], iframe[src*="hcaptcha"]').count();
  if (iframeCaptcha > 0) return true;

  const textPatterns = [/not a robot/i, /unusual traffic/i, /verify you/i];
  for (const pattern of textPatterns) {
    if (await page.getByText(pattern).first().isVisible({ timeout: 300 }).catch(() => false)) {
      return true;
    }
  }
  return false;
}

async function waitForCaptchaResolution(page: Page, channelTitle: string) {
  console.log(`\n  ⚠ CAPTCHA detected for "${channelTitle}"`);
  console.log("  Solve it in the browser window, then press Enter here to continue…");
  await waitForEnter("  ");
  await page.waitForTimeout(1500);
}

async function hasEmailGate(page: Page): Promise<boolean> {
  return page.getByText(/view email address/i).first().isVisible({ timeout: 800 }).catch(() => false);
}

async function tryRevealEmail(page: Page) {
  const viewEmail = page.getByText(/view email address/i).first();
  if (await viewEmail.isVisible({ timeout: 2000 }).catch(() => false)) {
    await viewEmail.click().catch(() => undefined);
    await page.waitForTimeout(1500);
  }
}

async function collectLinks(page: Page) {
  return page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll("a[href]"));
    return anchors.map((a) => ({
      href: (a as HTMLAnchorElement).href,
      text: (a.textContent ?? "").trim(),
    }));
  });
}

function extractFromLinks(links: { href: string; text: string }[]) {
  let email: string | null = null;
  const parts: string[] = [];

  for (const link of links) {
    if (link.href.startsWith("mailto:")) {
      const candidate = decodeURIComponent(link.href.replace(/^mailto:/i, "").split("?")[0]);
      if (candidate.includes("@")) {
        email = candidate;
      }
    }
    parts.push(`${link.text} ${link.href}`);
  }

  return { email, blob: parts.join("\n") };
}

function extractDescription(pageText: string): string | null {
  const markers = ["Description", "More info", "About"];
  for (const marker of markers) {
    const idx = pageText.indexOf(marker);
    if (idx >= 0) {
      const chunk = pageText.slice(idx, idx + 2000).trim();
      if (chunk.length > 20) return chunk;
    }
  }
  return null;
}

async function extractPageData(page: Page) {
  const pageText = await page.locator("body").innerText().catch(() => "");
  const html = await page.content();
  const links = await collectLinks(page);
  const fromLinks = extractFromLinks(links);

  const blob = `${pageText}\n${html}\n${fromLinks.blob}`;
  const email = fromLinks.email ?? extractEmail(blob);
  const social = extractSocialLinks(blob);

  return {
    email,
    website: sanitizeUrl(social.website),
    instagram: sanitizeUrl(social.instagram),
    twitter: sanitizeUrl(social.twitter),
    tiktok: sanitizeUrl(social.tiktok),
    description: extractDescription(pageText),
    pageText: pageText.slice(0, 500),
  };
}

export async function scrapeChannelAbout(
  page: Page,
  channel: { id: string; handle: string | null; title: string },
  options: ScrapeOptions
): Promise<ScrapeResult> {
  const url = aboutUrl(channel);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await dismissConsent(page);
  await page.waitForTimeout(1500);

  await tryRevealEmail(page);

  if (await isCaptchaVisible(page)) {
    if (options.pauseOnCaptcha) {
      await waitForCaptchaResolution(page, channel.title);
      await tryRevealEmail(page);
    }
  }

  let data = await extractPageData(page);

  if (!data.email && (await hasEmailGate(page))) {
    if (options.pauseOnCaptcha) {
      console.log(`\n  Email is gated for "${channel.title}". Click "View email address" and solve any CAPTCHA.`);
      await waitForEnter("  Press Enter when the email is visible… ");
      await tryRevealEmail(page);
      data = await extractPageData(page);
    }
  }

  let email_status: EmailStatus;
  if (data.email) {
    email_status = "found";
  } else if (await hasEmailGate(page)) {
    email_status = "locked";
  } else {
    email_status = "not_available";
  }

  return { ...data, email_status };
}

export async function createScraperBrowser(headless: boolean): Promise<Browser> {
  return chromium.launch({
    headless,
    args: ["--disable-blink-features=AutomationControlled"],
  });
}

export async function createScraperContext(options: {
  headless: boolean;
  useAuth: boolean;
}): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await createScraperBrowser(options.headless);

  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale: "en-US",
    ...(options.useAuth && hasAuthState() ? { storageState: AUTH_STATE_PATH } : {}),
  });

  return { browser, context };
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { aboutUrl, hasAuthState, AUTH_STATE_PATH };
