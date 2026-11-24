/**
 * City/state keyword packs — USA local long-tail without new niches.
 * Surfaces creators who rank for "finance texas" but not broad "finance usa".
 */

const INFLUX_GEO_PLACES = [
  // Large states
  "california",
  "texas",
  "florida",
  "new york",
  "illinois",
  "georgia",
  "arizona",
  "washington",
  "colorado",
  "tennessee",
  "north carolina",
  "ohio",
  // Major metros
  "los angeles",
  "miami",
  "austin",
  "seattle",
  "chicago",
  "atlanta",
  "denver",
  "nashville",
  "houston",
  "dallas",
  "san diego",
  "phoenix",
  "boston",
  "portland",
];

/** 3 local stems per niche (kept short so packs stay overnight-friendly). */
const INFLUX_GEO_STEMS = {
  finance: ["personal finance", "investing", "real estate"],
  gaming: ["gaming", "twitch streamer", "esports"],
  beauty: ["skincare", "makeup", "beauty"],
  fashion: ["fashion", "streetwear", "style"],
  fitness: ["fitness", "gym", "yoga"],
  tech: ["tech reviews", "coding", "gadgets"],
  food: ["cooking", "food blogger", "recipes"],
  travel: ["travel vlog", "road trip", "hiking"],
  parenting: ["parenting", "mom life", "family vlog"],
  education: ["study tips", "teacher", "tutoring"],
  pets: ["dog training", "cat care", "pets"],
  diy: ["diy", "home improvement", "woodworking"],
};

/** Built flat list: "<stem> <place>" per niche, in niche order. */
const INFLUX_GEO_CLUSTERS = (function buildGeoClusters() {
  const out = {};
  const nicheIds = Object.keys(INFLUX_GEO_STEMS);
  for (const id of nicheIds) {
    const stems = INFLUX_GEO_STEMS[id] || [];
    const terms = [];
    for (const stem of stems) {
      for (const place of INFLUX_GEO_PLACES) {
        terms.push(`${stem} ${place}`);
      }
    }
    out[id] = terms;
  }
  return out;
})();
