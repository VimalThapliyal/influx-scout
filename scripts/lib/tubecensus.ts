/**
 * Normalise raw YouTube channel identifiers (TubeCensus / Internet Archive style)
 * into a canonical shape we can store in `channel_seed`.
 *
 * TubeCensus captures four identifier formats:
 *   /channel/UC…   → canonical channel id (validatable via channels.list?id=, 1 unit / 50)
 *   /user/Name     → legacy username     (resolve via channels.list?forUsername=, 1 unit each)
 *   /@handle       → handle              (resolve via channels.list?forHandle=,  1 unit each)
 *   /c/Slug        → custom URL          (no cheap API resolver → search.list only, 100 units)
 */

export type SeedFormat = "channel" | "handle" | "user" | "custom";

export interface SeedIdentifier {
  seedKey: string; // e.g. "channel:UCabc", "handle:@name"
  idFormat: SeedFormat;
  channelId: string | null;
  handle: string | null; // stored with leading "@"
  username: string | null;
  customUrl: string | null;
}

const UC_ID = /^UC[0-9A-Za-z_-]{22}$/;

function stripUrlNoise(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  // Drop scheme + host, query, fragment, surrounding quotes/whitespace
  s = s.replace(/^['"]|['"]$/g, "").trim();
  s = s.replace(/^https?:\/\//i, "");
  s = s.replace(/^(www\.|m\.)/i, "");
  s = s.replace(/^youtube\.com/i, "");
  s = s.replace(/^youtu\.be/i, "");
  // Cut query string / fragment
  s = s.split(/[?#]/)[0]!;
  // Trim trailing slash
  s = s.replace(/\/+$/, "");
  return s.trim();
}

/**
 * Parse a single raw token (URL, path, bare id, or @handle) into a SeedIdentifier.
 * Returns null when the token is empty or not recognisably a channel identifier.
 */
export function normaliseIdentifier(raw: string): SeedIdentifier | null {
  if (!raw) return null;
  const s = stripUrlNoise(raw);
  if (!s) return null;

  // Bare canonical channel id (no path)
  if (UC_ID.test(s)) {
    return {
      seedKey: `channel:${s}`,
      idFormat: "channel",
      channelId: s,
      handle: null,
      username: null,
      customUrl: null,
    };
  }

  // Bare @handle (no path)
  if (s.startsWith("@")) {
    const h = sanitiseHandle(s);
    if (!h) return null;
    return {
      seedKey: `handle:${h.toLowerCase()}`,
      idFormat: "handle",
      channelId: null,
      handle: h,
      username: null,
      customUrl: null,
    };
  }

  const lower = s.toLowerCase();

  if (lower.startsWith("/channel/") || lower.startsWith("channel/")) {
    const id = s.split("/").filter(Boolean)[1] ?? "";
    if (!UC_ID.test(id)) return null;
    return {
      seedKey: `channel:${id}`,
      idFormat: "channel",
      channelId: id,
      handle: null,
      username: null,
      customUrl: null,
    };
  }

  if (lower.startsWith("/@") || lower.startsWith("@")) {
    const h = sanitiseHandle(s.replace(/^\//, ""));
    if (!h) return null;
    return {
      seedKey: `handle:${h.toLowerCase()}`,
      idFormat: "handle",
      channelId: null,
      handle: h,
      username: null,
      customUrl: null,
    };
  }

  if (lower.startsWith("/user/") || lower.startsWith("user/")) {
    const name = (s.split("/").filter(Boolean)[1] ?? "").trim();
    if (!isValidSlug(name)) return null;
    return {
      seedKey: `user:${name.toLowerCase()}`,
      idFormat: "user",
      channelId: null,
      handle: null,
      username: name,
      customUrl: null,
    };
  }

  if (lower.startsWith("/c/") || lower.startsWith("c/")) {
    const slug = (s.split("/").filter(Boolean)[1] ?? "").trim();
    if (!isValidSlug(slug)) return null;
    return {
      seedKey: `custom:${slug.toLowerCase()}`,
      idFormat: "custom",
      channelId: null,
      handle: null,
      username: null,
      customUrl: slug,
    };
  }

  // A single path segment that looks like a vanity slug → treat as custom url.
  if (!s.includes("/") && isValidSlug(s)) {
    return {
      seedKey: `custom:${s.toLowerCase()}`,
      idFormat: "custom",
      channelId: null,
      handle: null,
      username: null,
      customUrl: s,
    };
  }

  return null;
}

function sanitiseHandle(raw: string): string | null {
  let h = raw.trim();
  if (!h.startsWith("@")) h = `@${h}`;
  const body = h.slice(1);
  // YouTube handles: 3–30 chars, letters/digits/._-
  if (!/^[A-Za-z0-9._-]{3,30}$/.test(body)) return null;
  return `@${body}`;
}

function isValidSlug(name: string): boolean {
  return /^[A-Za-z0-9._-]{2,80}$/.test(name);
}
