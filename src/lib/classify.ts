/**
 * Niche + country classification (scrape.txt §§22–23).
 * MVP: weighted keyword rules + YouTube/website country signals.
 */

export type NicheSlug =
  | "fitness"
  | "gaming"
  | "beauty"
  | "fashion"
  | "personal-finance"
  | "tech"
  | "education"
  | "food"
  | "travel"
  | "lifestyle"
  | "entertainment"
  | "parenting"
  | "pets"
  | "home"
  | "business"
  | "podcast"
  | "self-improvement"
  | "music"
  | "sports";

export type CountryConfidence =
  | "confirmed"
  | "high"
  | "medium"
  | "low"
  | "unknown";

export type ClassificationFields = {
  primary_niche: NicheSlug | null;
  niche_confidence: number | null;
  niche_method: string | null;
  niche_evidence: string[];
  niche_classified_at: string;
  category: string | null;
  country_confidence: CountryConfidence;
  country_evidence: string[];
  country_classified_at: string;
};

/** Weighted phrase → niche (higher weight = stronger evidence). */
const NICHE_RULES: Array<{ niche: NicheSlug; weight: number; phrase: string }> = [
  // fitness
  { niche: "fitness", weight: 5, phrase: "home workout" },
  { niche: "fitness", weight: 5, phrase: "strength training" },
  { niche: "fitness", weight: 4, phrase: "weight loss" },
  { niche: "fitness", weight: 3, phrase: "gym" },
  { niche: "fitness", weight: 3, phrase: "fitness" },
  { niche: "fitness", weight: 3, phrase: "workout" },
  { niche: "fitness", weight: 2, phrase: "nutrition" },
  { niche: "fitness", weight: 2, phrase: "yoga" },
  // gaming
  { niche: "gaming", weight: 5, phrase: "lets play" },
  { niche: "gaming", weight: 5, phrase: "let's play" },
  { niche: "gaming", weight: 4, phrase: "esports" },
  { niche: "gaming", weight: 4, phrase: "gameplay" },
  { niche: "gaming", weight: 3, phrase: "gaming" },
  { niche: "gaming", weight: 3, phrase: "gamer" },
  { niche: "gaming", weight: 2, phrase: "twitch" },
  // beauty
  { niche: "beauty", weight: 5, phrase: "makeup tutorial" },
  { niche: "beauty", weight: 4, phrase: "skincare" },
  { niche: "beauty", weight: 3, phrase: "makeup" },
  { niche: "beauty", weight: 3, phrase: "beauty" },
  { niche: "beauty", weight: 2, phrase: "cosmetics" },
  // fashion
  { niche: "fashion", weight: 4, phrase: "outfit" },
  { niche: "fashion", weight: 3, phrase: "fashion" },
  { niche: "fashion", weight: 3, phrase: "style" },
  { niche: "fashion", weight: 2, phrase: "wardrobe" },
  // personal-finance
  { niche: "personal-finance", weight: 5, phrase: "personal finance" },
  { niche: "personal-finance", weight: 4, phrase: "credit card" },
  { niche: "personal-finance", weight: 4, phrase: "investing" },
  { niche: "personal-finance", weight: 3, phrase: "stock market" },
  { niche: "personal-finance", weight: 3, phrase: "budget" },
  { niche: "personal-finance", weight: 3, phrase: "finance" },
  { niche: "personal-finance", weight: 2, phrase: "money" },
  // tech
  { niche: "tech", weight: 4, phrase: "programming" },
  { niche: "tech", weight: 4, phrase: "software" },
  { niche: "tech", weight: 3, phrase: "coding" },
  { niche: "tech", weight: 3, phrase: "technology" },
  { niche: "tech", weight: 2, phrase: "tech" },
  { niche: "tech", weight: 2, phrase: "gadget" },
  // education
  { niche: "education", weight: 4, phrase: "tutorial" },
  { niche: "education", weight: 3, phrase: "learn" },
  { niche: "education", weight: 3, phrase: "course" },
  { niche: "education", weight: 2, phrase: "education" },
  // food
  { niche: "food", weight: 4, phrase: "recipe" },
  { niche: "food", weight: 3, phrase: "cooking" },
  { niche: "food", weight: 3, phrase: "food" },
  { niche: "food", weight: 2, phrase: "kitchen" },
  // travel
  { niche: "travel", weight: 4, phrase: "travel vlog" },
  { niche: "travel", weight: 3, phrase: "travel" },
  { niche: "travel", weight: 2, phrase: "tourism" },
  { niche: "travel", weight: 2, phrase: "adventure" },
  // lifestyle
  { niche: "lifestyle", weight: 3, phrase: "lifestyle" },
  { niche: "lifestyle", weight: 3, phrase: "vlog" },
  { niche: "lifestyle", weight: 2, phrase: "daily life" },
  // entertainment
  { niche: "entertainment", weight: 3, phrase: "comedy" },
  { niche: "entertainment", weight: 3, phrase: "entertainment" },
  { niche: "entertainment", weight: 2, phrase: "funny" },
  // parenting
  { niche: "parenting", weight: 4, phrase: "parenting" },
  { niche: "parenting", weight: 3, phrase: "mom life" },
  { niche: "parenting", weight: 3, phrase: "dad life" },
  { niche: "parenting", weight: 2, phrase: "family" },
  // pets
  { niche: "pets", weight: 4, phrase: "cat channel" },
  { niche: "pets", weight: 3, phrase: "dog" },
  { niche: "pets", weight: 3, phrase: "cat" },
  { niche: "pets", weight: 3, phrase: "pet" },
  { niche: "pets", weight: 2, phrase: "rescue" },
  // home
  { niche: "home", weight: 4, phrase: "home decor" },
  { niche: "home", weight: 3, phrase: "diy" },
  { niche: "home", weight: 2, phrase: "interior" },
  // business
  { niche: "business", weight: 4, phrase: "entrepreneur" },
  { niche: "business", weight: 3, phrase: "startup" },
  { niche: "business", weight: 3, phrase: "business" },
  { niche: "business", weight: 2, phrase: "marketing" },
  // podcast (format) — weight kept below strong topic phrases so e.g. a
  // gameplay-heavy gaming podcast still classifies as gaming
  { niche: "podcast", weight: 4, phrase: "podcast" },
  { niche: "podcast", weight: 3, phrase: "full episode" },
  { niche: "podcast", weight: 2, phrase: "interview" },
  { niche: "podcast", weight: 2, phrase: "episode" },
  // self-improvement
  { niche: "self-improvement", weight: 5, phrase: "self improvement" },
  { niche: "self-improvement", weight: 5, phrase: "self-improvement" },
  { niche: "self-improvement", weight: 5, phrase: "personal development" },
  { niche: "self-improvement", weight: 4, phrase: "self help" },
  { niche: "self-improvement", weight: 4, phrase: "self-help" },
  { niche: "self-improvement", weight: 4, phrase: "mental health" },
  { niche: "self-improvement", weight: 4, phrase: "relationship advice" },
  { niche: "self-improvement", weight: 4, phrase: "stoicism" },
  { niche: "self-improvement", weight: 3, phrase: "motivation" },
  { niche: "self-improvement", weight: 3, phrase: "motivational" },
  { niche: "self-improvement", weight: 3, phrase: "mindset" },
  { niche: "self-improvement", weight: 3, phrase: "productivity" },
  { niche: "self-improvement", weight: 3, phrase: "meditation" },
  { niche: "self-improvement", weight: 2, phrase: "life advice" },
  { niche: "self-improvement", weight: 2, phrase: "habit" },
  // music
  { niche: "music", weight: 6, phrase: "official music video" },
  { niche: "music", weight: 5, phrase: "music video" },
  { niche: "music", weight: 5, phrase: "official audio" },
  { niche: "music", weight: 5, phrase: "lyric video" },
  { niche: "music", weight: 5, phrase: "kpop" },
  { niche: "music", weight: 5, phrase: "k-pop" },
  { niche: "music", weight: 5, phrase: "fancam" },
  { niche: "music", weight: 4, phrase: "music" },
  { niche: "music", weight: 4, phrase: "concert" },
  { niche: "music", weight: 4, phrase: "world tour" },
  { niche: "music", weight: 4, phrase: "album" },
  { niche: "music", weight: 4, phrase: "singer" },
  { niche: "music", weight: 4, phrase: "rapper" },
  { niche: "music", weight: 4, phrase: "remix" },
  { niche: "music", weight: 3, phrase: "lyrics" },
  { niche: "music", weight: 3, phrase: "song" },
  { niche: "music", weight: 3, phrase: "live performance" },
  { niche: "music", weight: 3, phrase: "mv" },
  { niche: "music", weight: 3, phrase: "dj" },
  // sports
  { niche: "sports", weight: 5, phrase: "nfl" },
  { niche: "sports", weight: 5, phrase: "nba" },
  { niche: "sports", weight: 5, phrase: "mlb" },
  { niche: "sports", weight: 5, phrase: "nhl" },
  { niche: "sports", weight: 5, phrase: "ufc" },
  { niche: "sports", weight: 5, phrase: "mma" },
  { niche: "sports", weight: 5, phrase: "wwe" },
  { niche: "sports", weight: 5, phrase: "f1" },
  { niche: "sports", weight: 5, phrase: "formula 1" },
  { niche: "sports", weight: 5, phrase: "premier league" },
  { niche: "sports", weight: 4, phrase: "world cup" },
  { niche: "sports", weight: 4, phrase: "football" },
  { niche: "sports", weight: 4, phrase: "soccer" },
  { niche: "sports", weight: 4, phrase: "basketball" },
  { niche: "sports", weight: 4, phrase: "baseball" },
  { niche: "sports", weight: 4, phrase: "hockey" },
  { niche: "sports", weight: 4, phrase: "tennis" },
  { niche: "sports", weight: 4, phrase: "golf" },
  { niche: "sports", weight: 4, phrase: "boxing" },
  { niche: "sports", weight: 4, phrase: "wrestling" },
  { niche: "sports", weight: 4, phrase: "cricket" },
  { niche: "sports", weight: 4, phrase: "quarterback" },
  { niche: "sports", weight: 4, phrase: "sports" },
  { niche: "sports", weight: 3, phrase: "athlete" },
  { niche: "sports", weight: 3, phrase: "racing" },
  { niche: "sports", weight: 2, phrase: "highlights" },
];

export const NICHE_LABELS: Record<NicheSlug, string> = {
  fitness: "Fitness",
  gaming: "Gaming",
  beauty: "Beauty",
  fashion: "Fashion",
  "personal-finance": "Personal finance",
  tech: "Tech",
  education: "Education",
  food: "Food",
  travel: "Travel",
  lifestyle: "Lifestyle",
  entertainment: "Entertainment",
  parenting: "Parenting",
  pets: "Pets",
  home: "Home & DIY",
  business: "Business",
  podcast: "Podcast",
  "self-improvement": "Self-improvement",
  music: "Music",
  sports: "Sports",
};

export const NICHE_FILTER_OPTIONS: { value: "" | NicheSlug; label: string }[] = [
  { value: "", label: "All niches" },
  ...Object.entries(NICHE_LABELS).map(([value, label]) => ({
    value: value as NicheSlug,
    label,
  })),
];

const COUNTRY_NAME_HINTS: Array<{ code: string; patterns: RegExp[] }> = [
  { code: "US", patterns: [/\bunited states\b/i, /\busa\b/i, /\bu\.s\.a\.?\b/i, /\bbased in (the )?us\b/i] },
  { code: "GB", patterns: [/\bunited kingdom\b/i, /\bbritain\b/i, /\bengland\b/i, /\bscotland\b/i, /\blondon\b/i] },
  { code: "CA", patterns: [/\bcanada\b/i, /\btoronto\b/i, /\bvancouver\b/i] },
  { code: "AU", patterns: [/\baustralia\b/i, /\bsydney\b/i, /\bmelbourne\b/i] },
  { code: "DE", patterns: [/\bgermany\b/i, /\bberlin\b/i, /\bdeutsch\b/i] },
  { code: "FR", patterns: [/\bfrance\b/i, /\bparis\b/i] },
  { code: "IN", patterns: [/\bindia\b/i, /\bmumbai\b/i, /\bdelhi\b/i] },
];

const TLD_TO_COUNTRY: Record<string, string> = {
  uk: "GB",
  de: "DE",
  fr: "FR",
  nl: "NL",
  es: "ES",
  it: "IT",
  se: "SE",
  ie: "IE",
  at: "AT",
  ch: "CH",
  pl: "PL",
  no: "NO",
  dk: "DK",
  fi: "FI",
  pt: "PT",
  ca: "CA",
  au: "AU",
  in: "IN",
  us: "US",
};

export function nicheLabel(slug: string | null | undefined): string {
  if (!slug) return "Unknown niche";
  return NICHE_LABELS[slug as NicheSlug] ?? slug;
}

export function countryConfidenceLabel(level: string | null | undefined): string {
  switch (level) {
    case "confirmed":
      return "Country confirmed";
    case "high":
      return "Country high confidence";
    case "medium":
      return "Country medium confidence";
    case "low":
      return "Country low confidence";
    default:
      return "Country unknown";
  }
}

const phraseMatchers = new Map<string, RegExp>();

/**
 * Whole-word match (optional plural "s"), so "cat" doesn't fire on
 * "education"/"vacation" and "pet" doesn't fire on "competition".
 */
function phraseMatcher(phrase: string): RegExp {
  let re = phraseMatchers.get(phrase);
  if (!re) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(`(?<![a-z0-9])${escaped}s?(?![a-z0-9])`);
    phraseMatchers.set(phrase, re);
  }
  return re;
}

export function classifyNiche(input: {
  title?: string | null;
  description?: string | null;
}): {
  primary_niche: NicheSlug | null;
  niche_confidence: number | null;
  niche_method: string | null;
  niche_evidence: string[];
} {
  const text = `${input.title ?? ""} ${input.description ?? ""}`.toLowerCase();
  if (!text.trim()) {
    return {
      primary_niche: null,
      niche_confidence: null,
      niche_method: null,
      niche_evidence: [],
    };
  }

  const scores = new Map<NicheSlug, { score: number; evidence: string[] }>();

  for (const rule of NICHE_RULES) {
    if (!phraseMatcher(rule.phrase).test(text)) continue;
    const prev = scores.get(rule.niche) ?? { score: 0, evidence: [] };
    if (!prev.evidence.includes(rule.phrase)) {
      prev.evidence.push(rule.phrase);
    }
    prev.score += rule.weight;
    scores.set(rule.niche, prev);
  }

  if (scores.size === 0) {
    return {
      primary_niche: null,
      niche_confidence: null,
      niche_method: null,
      niche_evidence: [],
    };
  }

  const ranked = Array.from(scores.entries()).sort(
    (a, b) => b[1].score - a[1].score
  );
  const [topNiche, top] = ranked[0]!;
  const second = ranked[1]?.[1].score ?? 0;
  // Confidence from score magnitude + margin over second place
  const raw = Math.min(0.95, 0.35 + top.score * 0.06 + Math.max(0, top.score - second) * 0.04);
  const confidence = Math.round(raw * 100) / 100;

  return {
    primary_niche: topNiche,
    niche_confidence: confidence,
    niche_method: "weighted_rules",
    niche_evidence: top.evidence.slice(0, 6),
  };
}

export function classifyCountry(input: {
  country?: string | null;
  website?: string | null;
  description?: string | null;
  title?: string | null;
}): {
  country_confidence: CountryConfidence;
  country_evidence: string[];
} {
  const evidence: string[] = [];
  const yt = input.country?.trim().toUpperCase() || null;
  if (yt) {
    evidence.push(`YouTube channel country: ${yt}`);
  }

  let tldCountry: string | null = null;
  if (input.website) {
    try {
      const host = new URL(
        input.website.includes("://") ? input.website : `https://${input.website}`
      ).hostname.replace(/^www\./, "");
      const tld = host.split(".").pop()?.toLowerCase() ?? "";
      if (TLD_TO_COUNTRY[tld]) {
        tldCountry = TLD_TO_COUNTRY[tld];
        evidence.push(`Website TLD .${tld} → ${tldCountry}`);
      }
    } catch {
      // ignore bad URLs
    }
  }

  const text = `${input.title ?? ""} ${input.description ?? ""}`;
  const bioHints: string[] = [];
  for (const hint of COUNTRY_NAME_HINTS) {
    if (hint.patterns.some((re) => re.test(text))) {
      bioHints.push(hint.code);
      evidence.push(`Bio/text mentions ${hint.code}`);
    }
  }

  if (yt && tldCountry && yt === tldCountry) {
    return { country_confidence: "high", country_evidence: evidence.slice(0, 4) };
  }
  if (yt && bioHints.includes(yt)) {
    return { country_confidence: "high", country_evidence: evidence.slice(0, 4) };
  }
  if (yt && tldCountry && yt !== tldCountry) {
    evidence.push(`Signal conflict: YouTube ${yt} vs TLD ${tldCountry}`);
    return { country_confidence: "low", country_evidence: evidence.slice(0, 5) };
  }
  if (yt) {
    return { country_confidence: "medium", country_evidence: evidence.slice(0, 4) };
  }
  if (tldCountry || bioHints.length > 0) {
    return { country_confidence: "low", country_evidence: evidence.slice(0, 4) };
  }
  return { country_confidence: "unknown", country_evidence: [] };
}

export const CLASSIFICATION_COLUMN_KEYS = [
  "primary_niche",
  "niche_confidence",
  "niche_method",
  "niche_evidence",
  "niche_classified_at",
  "country_confidence",
  "country_evidence",
  "country_classified_at",
] as const;

export function stripClassificationFields<T extends Record<string, unknown>>(
  payload: T
): T {
  const next = { ...payload };
  for (const key of CLASSIFICATION_COLUMN_KEYS) {
    delete next[key];
  }
  return next;
}

export function isMissingClassificationColumnError(
  message: string | null | undefined
): boolean {
  if (!message) return false;
  return /primary_niche|niche_confidence|niche_method|niche_evidence|niche_classified_at|country_confidence|country_evidence|country_classified_at|schema cache/i.test(
    message
  );
}

/** Merge niche + country classification onto a channel-like row. */
export function withChannelClassification<T extends Record<string, unknown>>(
  row: T,
  classifiedAt: Date | string = new Date()
): T & ClassificationFields {
  const at =
    typeof classifiedAt === "string" ? classifiedAt : classifiedAt.toISOString();
  const niche = classifyNiche({
    title: typeof row.title === "string" ? row.title : null,
    description: typeof row.description === "string" ? row.description : null,
  });
  const country = classifyCountry({
    country: typeof row.country === "string" ? row.country : null,
    website: typeof row.website === "string" ? row.website : null,
    description: typeof row.description === "string" ? row.description : null,
    title: typeof row.title === "string" ? row.title : null,
  });

  const primary = niche.primary_niche;
  const existingCategory =
    typeof row.category === "string" && row.category.trim()
      ? row.category
      : null;

  return {
    ...row,
    primary_niche: primary,
    niche_confidence: niche.niche_confidence,
    niche_method: niche.niche_method,
    niche_evidence: niche.niche_evidence,
    niche_classified_at: at,
    category: existingCategory ?? primary,
    country_confidence: country.country_confidence,
    country_evidence: country.country_evidence,
    country_classified_at: at,
  };
}
