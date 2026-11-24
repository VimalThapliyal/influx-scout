/**
 * Extract YouTube channel URLs from external roundup / list pages.
 * Zero YouTube API quota — only fetches the HTML of the list page.
 */

const YT_URL_RE =
  /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:@[\w.-]+|channel\/UC[\w-]{22}|c\/[\w.-]+|user\/[\w.-]+)(?:\/[^\s"'<>]*)?|youtu\.be\/[\w-]+)/gi;

const HANDLE_RE = /(?:^|[^\w/])@([A-Za-z0-9._-]{3,30})\b/g;

export function normalizeChannelUrl(raw: string): string | null {
  try {
    const u = new URL(raw.split(/[?#]/)[0]);
    const host = u.hostname.replace(/^www\./, "");
    if (
      host !== "youtube.com" &&
      host !== "youtu.be" &&
      host !== "m.youtube.com"
    ) {
      return null;
    }
    if (host === "youtu.be") return null;
    const path = u.pathname.replace(/\/$/, "");
    if (/^\/(watch|shorts|playlist|results|feed)/i.test(path)) return null;
    if (/^\/@[^/]+/.test(path)) {
      return `https://www.youtube.com${path.split("/").slice(0, 2).join("/")}`;
    }
    if (/^\/channel\/UC[\w-]{22}$/i.test(path) || /^\/channel\/UC[\w-]{22}\//i.test(path)) {
      const id = path.split("/")[2];
      if (id && /^UC[\w-]{22}$/i.test(id)) {
        return `https://www.youtube.com/channel/${id}`;
      }
      return null;
    }
    if (/^\/(c|user)\/[^/]+/i.test(path)) {
      return `https://www.youtube.com${path.split("/").slice(0, 3).join("/")}`;
    }
    return null;
  } catch {
    return null;
  }
}

export function extractYouTubeChannels(html: string): string[] {
  const found = new Set<string>();

  for (const match of Array.from(html.matchAll(YT_URL_RE))) {
    const n = normalizeChannelUrl(match[0]);
    if (n) found.add(n);
  }

  for (const match of Array.from(
    html.matchAll(/youtube\.com\/(@[\w.-]+|channel\/UC[\w-]{22})/gi)
  )) {
    const n = normalizeChannelUrl(`https://www.youtube.com/${match[1]}`);
    if (n) found.add(n);
  }

  for (const match of Array.from(html.matchAll(HANDLE_RE))) {
    const h = match[1];
    if (/^(media|font|keyframes|import|charset|supports)$/i.test(h)) continue;
    if (h.length < 4) continue;
    found.add(`https://www.youtube.com/@${h}`);
  }

  return Array.from(found);
}

export function isYouTubeChannelUrl(url: string): boolean {
  return normalizeChannelUrl(url) !== null;
}

export async function fetchListPageHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; InfluxSeedBot/1.0; +https://influencer-platform-mu.vercel.app)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

export async function extractChannelsFromListPages(
  listUrls: string[]
): Promise<{
  channels: string[];
  pages: Array<{ url: string; count: number; error?: string }>;
}> {
  const channels = new Set<string>();
  const pages: Array<{ url: string; count: number; error?: string }> = [];

  for (const raw of listUrls) {
    const url = raw.trim();
    if (!url) continue;
    try {
      const html = await fetchListPageHtml(url);
      const found = extractYouTubeChannels(html);
      found.forEach((c) => channels.add(c));
      pages.push({ url, count: found.length });
    } catch (err) {
      pages.push({
        url,
        count: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { channels: Array.from(channels), pages };
}
