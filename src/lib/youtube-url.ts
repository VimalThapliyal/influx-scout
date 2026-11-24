/** Parse YouTube URLs / raw IDs into normalized channel references. */

export type ParsedYouTubeRef =
  | { kind: "channel_id"; value: string }
  | { kind: "handle"; value: string }
  | { kind: "video_id"; value: string };

const CHANNEL_ID_RE = /^UC[\w-]{22}$/i;

/** CSS at-rules / vendor junk often scraped from stylesheets as fake @handles. */
const CSS_AT_RULE_NAMES = new Set([
  "media",
  "supports",
  "keyframes",
  "font-face",
  "import",
  "charset",
  "namespace",
  "document",
  "page",
  "counter-style",
  "font-feature-values",
  "property",
  "layer",
  "container",
  "scope",
  "starting-style",
  "color-profile",
  "moz-document",
  "webkit-keyframes",
]);

export function isValidYouTubeChannelId(id: string): boolean {
  return CHANNEL_ID_RE.test(id.trim());
}

/**
 * Plausible YouTube @handle (blocks CSS at-rules, domains, vendor prefixes).
 * YouTube handles: 3–30 chars, letters/digits/._-
 */
export function isPlausibleYouTubeHandle(
  handle: string | null | undefined
): boolean {
  if (!handle) return false;
  const h = handle.trim().replace(/^@/, "");
  if (h.length < 3 || h.length > 30) return false;
  if (h.startsWith("-") || h.startsWith(".") || h.startsWith("_")) return false;
  if (h.endsWith("-") || h.endsWith(".") || h.endsWith("_")) return false;
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]$/.test(h) &&
    !/^[a-zA-Z0-9]{3}$/.test(h)
  ) {
    return false;
  }
  // Looks like a website domain, not a handle
  if (/\.(com|org|net|io|co|ca|uk|us|in|au|tv|me|app|dev|info|biz)$/i.test(h)) {
    return false;
  }
  const lower = h.toLowerCase();
  if (CSS_AT_RULE_NAMES.has(lower)) return false;
  const unprefixed = lower.replace(/^(?:moz|webkit|ms|o)-/, "");
  if (CSS_AT_RULE_NAMES.has(unprefixed)) return false;
  if (/^(?:webkit|moz|ms|o)-/i.test(h)) return false;
  return true;
}

export function parseYouTubeRef(input: string): ParsedYouTubeRef | null {
  const raw = input.trim();
  if (!raw) return null;

  if (CHANNEL_ID_RE.test(raw)) {
    return { kind: "channel_id", value: raw };
  }

  if (raw.startsWith("@")) {
    const handle = raw.slice(1).split(/[/?#]/)[0];
    if (handle && isPlausibleYouTubeHandle(handle)) {
      return { kind: "handle", value: handle };
    }
    return null;
  }

  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  if (host !== "youtube.com" && host !== "youtu.be" && host !== "m.youtube.com") {
    return null;
  }

  const path = url.pathname;

  if (host === "youtu.be") {
    const id = path.slice(1).split("/")[0];
    return id ? { kind: "video_id", value: id } : null;
  }

  const channelMatch = path.match(/^\/channel\/(UC[\w-]{22})\b/i);
  if (channelMatch?.[1]) {
    return { kind: "channel_id", value: channelMatch[1] };
  }

  const handleMatch = path.match(/^\/@([^/?#]+)/);
  if (handleMatch?.[1] && isPlausibleYouTubeHandle(handleMatch[1])) {
    return { kind: "handle", value: handleMatch[1] };
  }

  const watchId = url.searchParams.get("v");
  if (path === "/watch" && watchId) {
    return { kind: "video_id", value: watchId };
  }

  return null;
}

export function parseYouTubeRefsFromText(text: string): ParsedYouTubeRef[] {
  const seen = new Set<string>();
  const refs: ParsedYouTubeRef[] = [];

  const add = (ref: ParsedYouTubeRef | null) => {
    if (!ref) return;
    const key = `${ref.kind}:${ref.value.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push(ref);
  };

  for (const line of text.split(/[\n,]+/)) {
    add(parseYouTubeRef(line));
  }

  const urlPattern =
    /https?:\/\/(?:www\.)?(?:youtube\.com\/[^\s]+|youtu\.be\/[^\s]+)/gi;
  for (const match of Array.from(text.matchAll(urlPattern))) {
    add(parseYouTubeRef(match[0]));
  }

  return refs;
}
