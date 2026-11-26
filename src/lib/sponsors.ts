/**
 * Sponsorships disclosed in video descriptions ("Thanks to X for sponsoring").
 * Deliberately strict: affiliate links and discount codes are not counted, and
 * "not sponsored" is not a sponsorship. A miss is fine; a wrong brand is not.
 */

export interface SponsorSignal {
  /** A sponsorship disclosure was found in at least one description. */
  sponsored: boolean;
  /** Brand names stated in the disclosures (may be empty even when sponsored). */
  sponsors: string[];
}

// Brand: starts with a letter or digit, up to ~4 words, may contain . & ' + -
const BRAND = String.raw`([A-Za-z0-9][A-Za-z0-9.&'+\-]*(?: [A-Za-z0-9][A-Za-z0-9.&'+\-]*){0,3})`;
const NAMED: RegExp[] = [
  new RegExp(String.raw`thanks? (?:so much )?to (?:our (?:friends|sponsor) (?:at|over at) )?@?${BRAND} for sponsor`, "gi"),
  new RegExp(String.raw`(?<!not |n't |never |un)sponsored by @?${BRAND}`, "gi"),
  new RegExp(String.raw`brought to you by @?${BRAND}`, "gi"),
  new RegExp(String.raw`(?:today'?s|this video'?s|this episode'?s|our) sponsor(?: is|:|,)? @?${BRAND}`, "gi"),
  new RegExp(String.raw`in (?:paid )?(?:partnership|collaboration) with @?${BRAND}`, "gi"),
];
const UNNAMED = /(?<!not |n't |never )(?:this (?:video|episode) is sponsored|sponsored (?:video|content|post)|paid (?:partnership|promotion)|#sponsored\b|#ad\b|#advert\b)/i;
const NEGATED = /\b(?:not|isn't|is not|wasn't|never|no) sponsored|unsponsored|not a sponsored|no sponsor/i;

const NOT_A_BRAND = new Set([
  "me", "you", "nobody", "no one", "noone", "anyone", "myself", "us", "them", "the", "a", "an", "our", "my",
  "this", "today", "viewers", "patrons", "patreon", "members", "channel members", "youtube", "you guys", "all",
]);

function cleanBrand(raw: string): string | null {
  // Keep the leading run of brand-looking words: capitalised, containing a digit,
  // or a domain. "Nourish this video may" → "Nourish"; "Squarespace. Go to" → "Squarespace".
  const words: string[] = [];
  for (const w of raw.trim().split(" ")) {
    const endsSentence = /[.,!:;]$/.test(w);
    const word = w.replace(/[.,!:;'\-&+]+$/, "");
    const isDomain = /^[a-z0-9-]+\.[a-z]{2,}$/i.test(word);
    if (!word || !(/^[A-Z0-9]/.test(word) || isDomain)) break;
    words.push(word);
    if (endsSentence) break;
  }
  const name = words.join(" ");
  if (name.length < 2 || name.length > 40) return null;
  if (NOT_A_BRAND.has(name.toLowerCase())) return null;
  if (!/[A-Za-z]/.test(name)) return null;
  return name;
}

export function detectSponsors(descriptions: Array<string | null | undefined>): SponsorSignal {
  const brands = new Map<string, string>();
  let sponsored = false;
  for (const d of descriptions) {
    if (!d) continue;
    const text = d.slice(0, 3000).replace(/\s+/g, " ");
    for (const re of NAMED) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const brand = cleanBrand(m[1] ?? "");
        if (!brand) continue;
        sponsored = true;
        const key = brand.toLowerCase();
        if (!brands.has(key)) brands.set(key, brand);
      }
    }
    if (!sponsored && UNNAMED.test(text) && !NEGATED.test(text)) sponsored = true;
  }
  return { sponsored, sponsors: Array.from(brands.values()).slice(0, 5) };
}
