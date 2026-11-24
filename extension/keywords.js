/** Rotating USA channel search terms — 20 per niche, all niches in sequence overnight. */

const INFLUX_KEYWORD_CLUSTERS = {
  finance: [
    "finance usa",
    "personal finance usa",
    "money usa",
    "investing usa",
    "stock market usa",
    "trading usa",
    "wealth building usa",
    "financial freedom usa",
    "budgeting usa",
    "passive income usa",
    "retirement planning usa",
    "side hustle usa",
    "debt free usa",
    "credit score usa",
    "real estate investing usa",
    "crypto investing usa",
    "financial advisor usa",
    "money management usa",
    "save money usa",
    "fire movement usa",
  ],
  gaming: [
    "gaming usa",
    "gaming channel usa",
    "pc gaming usa",
    "esports usa",
    "game reviews usa",
    "streaming gaming usa",
    "xbox usa",
    "playstation usa",
    "nintendo usa",
    "minecraft usa",
    "fortnite usa",
    "call of duty usa",
    "indie games usa",
    "mobile gaming usa",
    "speedrun usa",
    "gaming news usa",
    "vr gaming usa",
    "racing games usa",
    "fighting games usa",
    "gaming setup usa",
  ],
  beauty: [
    "beauty usa",
    "skincare usa",
    "makeup usa",
    "beauty influencer usa",
    "cosmetics usa",
    "makeup tutorial usa",
    "skincare routine usa",
    "hair care usa",
    "nails usa",
    "clean beauty usa",
    "anti aging usa",
    "beauty reviews usa",
    "grwm usa",
    "fragrance usa",
    "beauty tips usa",
    "drugstore makeup usa",
    "luxury beauty usa",
    "acne skincare usa",
    "beauty guru usa",
    "spa at home usa",
  ],
  fashion: [
    "fashion usa",
    "streetwear usa",
    "outfit ideas usa",
    "fashion haul usa",
    "style usa",
    "mens fashion usa",
    "womens fashion usa",
    "thrift fashion usa",
    "sustainable fashion usa",
    "luxury fashion usa",
    "casual outfits usa",
    "workwear usa",
    "sneaker usa",
    "fashion trends usa",
    "plus size fashion usa",
    "minimalist wardrobe usa",
    "fashion vlog usa",
    "runway fashion usa",
    "budget fashion usa",
    "capsule wardrobe usa",
  ],
  fitness: [
    "fitness usa",
    "workout usa",
    "gym usa",
    "health fitness usa",
    "weight loss usa",
    "home workout usa",
    "yoga usa",
    "pilates usa",
    "crossfit usa",
    "running usa",
    "bodybuilding usa",
    "calisthenics usa",
    "nutrition usa",
    "meal prep usa",
    "hiit workout usa",
    "strength training usa",
    "fitness motivation usa",
    "personal trainer usa",
    "womens fitness usa",
    "mens fitness usa",
  ],
  tech: [
    "tech reviews usa",
    "technology usa",
    "gadgets usa",
    "software usa",
    "ai usa",
    "smartphone reviews usa",
    "laptop reviews usa",
    "pc build usa",
    "coding usa",
    "cybersecurity usa",
    "apple usa",
    "android usa",
    "smart home usa",
    "electric vehicles usa",
    "tech news usa",
    "startup usa",
    "saas usa",
    "cloud computing usa",
    "robotics usa",
    "tech tips usa",
  ],
  food: [
    "food usa",
    "cooking usa",
    "recipes usa",
    "food blogger usa",
    "baking usa",
    "meal ideas usa",
    "healthy recipes usa",
    "vegan recipes usa",
    "air fryer recipes usa",
    "grilling usa",
    "bbq usa",
    "dessert recipes usa",
    "budget meals usa",
    "meal prep recipes usa",
    "restaurant reviews usa",
    "street food usa",
    "chef usa",
    "home cooking usa",
    "comfort food usa",
    "foodie usa",
  ],
  travel: [
    "travel usa",
    "travel vlog usa",
    "road trip usa",
    "national parks usa",
    "budget travel usa",
    "solo travel usa",
    "family travel usa",
    "travel tips usa",
    "hotel reviews usa",
    "flight hacks usa",
    "van life usa",
    "camping usa",
    "hiking usa",
    "city guides usa",
    "weekend getaways usa",
    "travel packing usa",
    "adventure travel usa",
    "luxury travel usa",
    "travel influencer usa",
    "us destinations usa",
  ],
  parenting: [
    "parenting usa",
    "mom life usa",
    "dad life usa",
    "pregnancy usa",
    "newborn tips usa",
    "toddler activities usa",
    "homeschool usa",
    "gentle parenting usa",
    "family vlog usa",
    "baby products usa",
    "postpartum usa",
    "working mom usa",
    "kids activities usa",
    "parenting tips usa",
    "breastfeeding usa",
    "child development usa",
    "special needs parenting usa",
    "twin parenting usa",
    "single parent usa",
    "family routines usa",
  ],
  education: [
    "education usa",
    "study tips usa",
    "online learning usa",
    "sat prep usa",
    "college tips usa",
    "teacher usa",
    "homeschool curriculum usa",
    "science explained usa",
    "history explained usa",
    "math help usa",
    "language learning usa",
    "english learning usa",
    "career advice usa",
    "interview tips usa",
    "resume tips usa",
    "scholarship usa",
    "stem education usa",
    "kids learning usa",
    "tutoring usa",
    "online courses usa",
  ],
  pets: [
    "pets usa",
    "dog training usa",
    "cat care usa",
    "puppy training usa",
    "dog breeds usa",
    "pet tips usa",
    "dog vlog usa",
    "cat vlog usa",
    "pet rescue usa",
    "aquarium usa",
    "reptile pets usa",
    "bird care usa",
    "pet products usa",
    "dog grooming usa",
    "senior dog care usa",
    "pet nutrition usa",
    "veterinary tips usa",
    "hamster care usa",
    "pet funny usa",
    "adopt dont shop usa",
  ],
  diy: [
    "diy usa",
    "home improvement usa",
    "woodworking usa",
    "crafts usa",
    "home renovation usa",
    "ikea hacks usa",
    "painting tips usa",
    "plumbing diy usa",
    "electrical diy usa",
    "garden diy usa",
    "landscaping usa",
    "furniture makeover usa",
    "organization tips usa",
    "tiny house usa",
    "tool reviews usa",
    "sewing diy usa",
    "upcycling usa",
    "home decor diy usa",
    "garage projects usa",
    "weekend diy usa",
  ],
};

/** Overnight order: original 6 niches, then food → travel → parenting → education → pets → diy */
const INFLUX_NICHE_ORDER = [
  "finance",
  "gaming",
  "beauty",
  "fashion",
  "fitness",
  "tech",
  "food",
  "travel",
  "parenting",
  "education",
  "pets",
  "diy",
];

/** Search modes: same keyword, different result sets (channel filter + query variants). */
const INFLUX_SEARCH_MODES = [
  {
    id: "channels",
    label: "all",
    suffix: "",
    sp: "EgIQAg%253D%253D",
    resultType: "channel",
  },
  {
    id: "after_2026",
    label: "2026+",
    suffix: " after:2026-01-01",
    sp: "EgIQAg%253D%253D",
    resultType: "channel",
  },
  {
    id: "after_2025",
    label: "2025+",
    suffix: " after:2025-01-01",
    sp: "EgIQAg%253D%253D",
    resultType: "channel",
  },
  {
    id: "new_channel",
    label: "new",
    suffix: " new channel",
    sp: "EgIQAg%253D%253D",
    resultType: "channel",
  },
  {
    id: "creator",
    label: "creator",
    suffix: " creator",
    sp: "EgIQAg%253D%253D",
    resultType: "channel",
  },
  {
    id: "videos",
    label: "videos",
    suffix: "",
    sp: "EgIQAQ%253D%253D",
    resultType: "video",
  },
  {
    id: "videos_2026",
    label: "v·2026",
    suffix: " after:2026-01-01",
    sp: "EgIQAQ%253D%253D",
    resultType: "video",
  },
];

const KEYWORD_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // empty / exhausted
const KEYWORD_COOLDOWN_USED_MS = 14 * 24 * 60 * 60 * 1000; // had saves — longer so bank doesn't recycle soon
const KEYWORD_COOLDOWN_SATURATED_MS = 21 * 24 * 60 * 60 * 1000; // mostly already-known channels
const COOLDOWN_STORAGE_KEY = "influxKeywordCooldown";
const KEYWORD_CURSOR_KEY = "influxKeywordCursor";
const SEEN_CHANNELS_KEY = "influxSeenChannelUrls";
const SEEN_CHANNELS_MAX = 8000;
const SEEN_CHANNELS_TTL_MS = 45 * 24 * 60 * 60 * 1000;

const INFLUX_US_STATES = [
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
  "connecticut", "florida", "georgia", "hawaii", "illinois", "indiana",
  "iowa", "kansas", "kentucky", "louisiana", "maine", "maryland",
  "massachusetts", "michigan", "minnesota", "mississippi", "missouri",
  "montana", "nebraska", "nevada", "new jersey", "new mexico", "new york",
  "north carolina", "ohio", "oklahoma", "oregon", "pennsylvania",
  "south carolina", "tennessee", "texas", "utah", "virginia", "washington",
  "wisconsin",
];

const INFLUX_FRESH_MODIFIERS = [
  "2024",
  "2025",
  "2026",
  "new creator",
  "small channel",
  "micro influencer",
  "rising creator",
  "independent creator",
  "underrated",
  "local",
  "beginner",
];

function influxNormalizeQuery(query) {
  return decodeURIComponent(query || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function influxKeywordsForNiche(id) {
  return [
    ...(INFLUX_KEYWORD_CLUSTERS[id] || []),
    ...((typeof INFLUX_LONGTAIL_CLUSTERS !== "undefined"
      ? INFLUX_LONGTAIL_CLUSTERS[id]
      : []) || []),
    ...((typeof INFLUX_GEO_CLUSTERS !== "undefined"
      ? INFLUX_GEO_CLUSTERS[id]
      : []) || []),
  ];
}

function influxGetAllKeywordsFlat() {
  const tier1 = INFLUX_NICHE_ORDER.flatMap((id) => INFLUX_KEYWORD_CLUSTERS[id]);
  const tier2 = INFLUX_NICHE_ORDER.flatMap(
    (id) =>
      (typeof INFLUX_LONGTAIL_CLUSTERS !== "undefined"
        ? INFLUX_LONGTAIL_CLUSTERS[id]
        : []) || []
  );
  const tier3 = INFLUX_NICHE_ORDER.flatMap(
    (id) =>
      (typeof INFLUX_GEO_CLUSTERS !== "undefined"
        ? INFLUX_GEO_CLUSTERS[id]
        : []) || []
  );
  return [...tier1, ...tier2, ...tier3];
}

function influxGetKeywordPosition(currentQuery) {
  const all = influxGetAllKeywordsFlat();
  const n = influxStripKeywordModifiers(currentQuery);
  const index = all.findIndex((k) => influxStripKeywordModifiers(k) === n);
  if (index < 0) return null;
  const nicheId =
    INFLUX_NICHE_ORDER.find((id) =>
      influxKeywordsForNiche(id).some(
        (k) => influxStripKeywordModifiers(k) === n
      )
    ) ?? "unknown";
  return { index, total: all.length, nicheId, oneBased: index + 1 };
}

function influxVariantsFromQuery(query) {
  const n = influxNormalizeQuery(query);
  const base = n.replace(/\s*usa\s*$/i, "").trim() || n;
  const uniq = new Set([
    n,
    `${base} usa`,
    `${base} channel usa`,
    `personal ${base} usa`,
    `${base} tips usa`,
    `${base} creator usa`,
  ]);
  return [...uniq];
}

function influxFindCluster(query) {
  const n = influxNormalizeQuery(query);
  if (!n) return { id: "finance", keywords: INFLUX_KEYWORD_CLUSTERS.finance };

  for (const id of INFLUX_NICHE_ORDER) {
    const keywords = INFLUX_KEYWORD_CLUSTERS[id];
    if (keywords.some((k) => influxNormalizeQuery(k) === n)) {
      return { id, keywords };
    }
  }

  for (const id of INFLUX_NICHE_ORDER) {
    const stem = id.replace(/_/g, " ");
    const keywords = INFLUX_KEYWORD_CLUSTERS[id];
    if (n.includes(stem) || keywords.some((k) => n.includes(stem))) {
      return { id, keywords };
    }
  }

  return { id: "custom", keywords: influxVariantsFromQuery(n) };
}

function influxGetCurrentSearchQuery() {
  try {
    return new URLSearchParams(location.search).get("search_query") || "";
  } catch {
    return "";
  }
}

function influxStripKeywordModifiers(query) {
  return influxNormalizeQuery(query)
    .replace(/\s+after:\S+/gi, "")
    .replace(/\s+new\s+channel\s*$/i, "")
    .trim();
}

function influxGetSearchModeCount() {
  return INFLUX_SEARCH_MODES.length;
}

function influxGetSearchModeLabel(modeIndex) {
  const mode = INFLUX_SEARCH_MODES[modeIndex] || INFLUX_SEARCH_MODES[0];
  return mode.label;
}

function influxSearchModeHasChannelFilter(modeIndex) {
  const mode = INFLUX_SEARCH_MODES[modeIndex] || INFLUX_SEARCH_MODES[0];
  return mode.resultType !== "video";
}

function influxIsVideoSearchMode(modeIndex) {
  const mode = INFLUX_SEARCH_MODES[modeIndex] || INFLUX_SEARCH_MODES[0];
  return mode.resultType === "video";
}

function influxBuildChannelSearchUrl(keyword, modeIndex = 0) {
  const mode = INFLUX_SEARCH_MODES[modeIndex] || INFLUX_SEARCH_MODES[0];
  const base = influxStripKeywordModifiers(keyword);
  const fullQuery = `${base}${mode.suffix}`.trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(fullQuery)}&sp=${mode.sp}`;
}

async function influxLoadCooldowns() {
  try {
    const result = await chrome.storage.local.get(COOLDOWN_STORAGE_KEY);
    return result[COOLDOWN_STORAGE_KEY] || {};
  } catch {
    return {};
  }
}

async function influxSaveCooldowns(map) {
  try {
    await chrome.storage.local.set({ [COOLDOWN_STORAGE_KEY]: map });
  } catch {
    /* ignore */
  }
}

async function influxIsKeywordOnCooldown(keyword) {
  const map = await influxLoadCooldowns();
  const entry = map[influxResolveBankKeyword(keyword)];
  if (!entry?.cooldownUntil) return false;
  if (Date.now() >= entry.cooldownUntil) {
    delete entry.cooldownUntil;
    await influxSaveCooldowns(map);
    return false;
  }
  return true;
}

/** Map freshened SERP query ("finance texas usa") back to bank key ("finance usa"). */
function influxResolveBankKeyword(query) {
  const n = influxStripKeywordModifiers(query);
  if (!n) return "";
  const all = influxGetAllKeywordsFlat();
  const exact = all.find((k) => influxNormalizeQuery(k) === n);
  if (exact) return influxNormalizeQuery(exact);

  let cleaned = n;
  for (const state of INFLUX_US_STATES) {
    cleaned = cleaned.replace(new RegExp(`\\b${state}\\b`, "gi"), " ");
  }
  for (const mod of INFLUX_FRESH_MODIFIERS) {
    cleaned = cleaned.replace(new RegExp(`\\b${mod.replace(/\s+/g, "\\s+")}\\b`, "gi"), " ");
  }
  cleaned = cleaned
    .replace(/\bchannel\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  let best = all[0] || n;
  let bestScore = -1;
  for (const kw of all) {
    const kn = influxNormalizeQuery(kw);
    const words = kn.split(/\s+/).filter(Boolean);
    const score = words.filter((w) => cleaned.includes(w) || n.includes(w)).length;
    if (score > bestScore || (score === bestScore && kn.length < best.length)) {
      bestScore = score;
      best = kn;
    }
  }
  return best;
}

async function influxSaveKeywordCursor(keyword) {
  try {
    await chrome.storage.local.set({
      [KEYWORD_CURSOR_KEY]: {
        keyword: influxStripKeywordModifiers(keyword),
        bank: influxResolveBankKeyword(keyword),
        at: Date.now(),
      },
    });
  } catch {
    /* ignore */
  }
}

async function influxLoadKeywordCursor() {
  try {
    const result = await chrome.storage.local.get(KEYWORD_CURSOR_KEY);
    return result[KEYWORD_CURSOR_KEY] || null;
  } catch {
    return null;
  }
}

async function influxRecordKeywordExhausted(keyword, stats) {
  const key = influxResolveBankKeyword(keyword);
  if (!key) return;
  const map = await influxLoadCooldowns();
  map[key] = {
    lastRunAt: Date.now(),
    lastSaves: stats.saves ?? 0,
    lastScrollDepth: stats.scrollDepth ?? 0,
    cooldownUntil: Date.now() + KEYWORD_COOLDOWN_MS,
  };
  await influxSaveCooldowns(map);
}

async function influxRecordKeywordProgress(keyword, saves) {
  if (saves <= 0) return;
  const key = influxResolveBankKeyword(keyword);
  if (!key) return;
  const map = await influxLoadCooldowns();
  const prev = map[key] || {};
  map[key] = {
    ...prev,
    lastRunAt: Date.now(),
    lastSaves: (prev.lastSaves || 0) + saves,
    cooldownUntil: Date.now() + KEYWORD_COOLDOWN_USED_MS,
  };
  await influxSaveCooldowns(map);
}

async function influxRecordKeywordSaturated(keyword, stats) {
  const key = influxResolveBankKeyword(keyword);
  if (!key) return;
  const map = await influxLoadCooldowns();
  map[key] = {
    lastRunAt: Date.now(),
    lastSaves: stats?.saves ?? 0,
    lastScrollDepth: stats?.scrollDepth ?? 0,
    saturated: true,
    cooldownUntil: Date.now() + KEYWORD_COOLDOWN_SATURATED_MS,
  };
  await influxSaveCooldowns(map);
}

/** Make each run hit a different YouTube result slice (state / year / long-tail). */
function influxFreshenKeyword(baseKeyword) {
  const raw = influxStripKeywordModifiers(baseKeyword || "") || "creator";
  const stem = raw
    .replace(/\s+usa\s*$/i, "")
    .replace(/\s+united states\s*$/i, "")
    .trim() || "creator";
  const roll = Math.random();
  const state =
    INFLUX_US_STATES[Math.floor(Math.random() * INFLUX_US_STATES.length)];
  const mod =
    INFLUX_FRESH_MODIFIERS[
      Math.floor(Math.random() * INFLUX_FRESH_MODIFIERS.length)
    ];

  if (roll < 0.28) return `${stem} ${state}`;
  if (roll < 0.48) return `${stem} ${state} usa`;
  if (roll < 0.66) return `${stem} ${mod} usa`;
  if (roll < 0.8) return `${mod} ${stem} usa`;
  if (roll < 0.9) return `${stem} channel ${state}`;
  return `${stem} usa ${mod}`;
}

/**
 * Next unused keyword — random among free keys (not sequential bank loop).
 * Then freshen so YouTube SERP differs even for the same niche.
 */
async function influxGetNextKeywordSkippingCooldown(currentQuery) {
  const all = influxGetAllKeywordsFlat();
  if (!all.length) return influxFreshenKeyword("creator");

  const currentBank = influxResolveBankKeyword(currentQuery);
  const free = [];
  for (const kw of all) {
    const bank = influxResolveBankKeyword(kw);
    if (bank && bank === currentBank) continue; // never re-pick same niche immediately
    if (!(await influxIsKeywordOnCooldown(kw))) free.push(kw);
  }

  let picked;
  if (free.length) {
    picked = free[Math.floor(Math.random() * free.length)];
  } else {
    // All cooling — least recently used base (not current), then freshen hard
    const map = await influxLoadCooldowns();
    let best = all.find((k) => influxResolveBankKeyword(k) !== currentBank) || all[0];
    let bestAt = Infinity;
    for (const kw of all) {
      const key = influxResolveBankKeyword(kw);
      if (key === currentBank) continue;
      const at = map[key]?.lastRunAt || map[key]?.cooldownUntil || 0;
      if (at < bestAt) {
        bestAt = at;
        best = kw;
      }
    }
    picked = best;
  }

  return influxFreshenKeyword(picked);
}

async function influxPickFreshStartKeyword() {
  return influxGetNextKeywordSkippingCooldown(
    (await influxLoadKeywordCursor())?.keyword || ""
  );
}

async function influxMarkChannelSeen(url) {
  const key = (url || "").split(/[?#]/)[0].replace(/\/$/, "").toLowerCase();
  if (!key || (!key.includes("/@") && !key.includes("/channel/"))) return;
  try {
    const result = await chrome.storage.local.get(SEEN_CHANNELS_KEY);
    const map = result[SEEN_CHANNELS_KEY] || {};
    const now = Date.now();
    map[key] = now;
    // prune
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const kept = {};
    for (const [u, t] of entries) {
      if (now - t > SEEN_CHANNELS_TTL_MS) continue;
      if (Object.keys(kept).length >= SEEN_CHANNELS_MAX) break;
      kept[u] = t;
    }
    await chrome.storage.local.set({ [SEEN_CHANNELS_KEY]: kept });
  } catch {
    /* ignore */
  }
}

async function influxWasChannelSeen(url) {
  const key = (url || "").split(/[?#]/)[0].replace(/\/$/, "").toLowerCase();
  if (!key) return false;
  try {
    const result = await chrome.storage.local.get(SEEN_CHANNELS_KEY);
    const map = result[SEEN_CHANNELS_KEY] || {};
    const t = map[key];
    if (!t) return false;
    if (Date.now() - t > SEEN_CHANNELS_TTL_MS) return false;
    return true;
  } catch {
    return false;
  }
}

function influxGetNextNicheId(currentNicheId) {
  const idx = INFLUX_NICHE_ORDER.indexOf(currentNicheId);
  if (idx < 0) return INFLUX_NICHE_ORDER[0];
  return INFLUX_NICHE_ORDER[(idx + 1) % INFLUX_NICHE_ORDER.length];
}

/** Next keyword across ALL niches (20 finance → 20 gaming → … → 20 tech → finance again). */
function influxGetNextKeyword(currentQuery) {
  const all = influxGetAllKeywordsFlat();
  const n = influxNormalizeQuery(currentQuery);
  const idx = all.findIndex((k) => influxNormalizeQuery(k) === n);

  if (idx >= 0) {
    return all[(idx + 1) % all.length];
  }

  const { id, keywords } = influxFindCluster(currentQuery);
  if (id !== "custom" && INFLUX_NICHE_ORDER.includes(id)) {
    const nextNiche = influxGetNextNicheId(id);
    return INFLUX_KEYWORD_CLUSTERS[nextNiche][0];
  }

  return all[0];
}

function influxReadAutoSaveFromUrl() {
  try {
    const p = new URLSearchParams(location.search);
    if (p.get("influx_auto") !== "1") return null;
    return {
      active: true,
      delayMs: parseInt(p.get("influx_delay") || "1000", 10) || 1000,
      rotateEnabled: p.get("influx_rotate") !== "0",
      rotations: parseInt(p.get("influx_rot") || "0", 10) || 0,
      saved: parseInt(p.get("influx_saved") || "0", 10) || 0,
      tooSmall: parseInt(p.get("influx_small") || "0", 10) || 0,
      keyword: influxGetCurrentSearchQuery(),
    };
  } catch {
    return null;
  }
}
