export interface NicheConfig {
  id: string;
  label: string;
  searches: string[];
}

/** Four target niches — USA & Europe market (problems.md). */
export const NICHE_PLAN: NicheConfig[] = [
  {
    id: "beauty",
    label: "Beauty & Personal Care",
    searches: ["beauty influencer", "skincare routine", "makeup tutorial"],
  },
  {
    id: "gaming",
    label: "Gaming & Tech",
    searches: ["gaming channel", "tech reviews", "esports"],
  },
  {
    id: "finance",
    label: "Finance",
    searches: ["personal finance", "investing tips", "stock market"],
  },
  {
    id: "fashion",
    label: "Fashion",
    searches: ["fashion haul", "streetwear", "outfit ideas"],
  },
];

export function pickRotatingSearches(
  searches: string[],
  count: number,
  nightIndex: number
): string[] {
  if (count >= searches.length) return [...searches];
  const picked: string[] = [];
  for (let i = 0; i < count; i++) {
    picked.push(searches[(nightIndex + i) % searches.length]);
  }
  return picked;
}

export function nightIndexFromDate(date = new Date()): number {
  return Math.floor(date.getTime() / (24 * 60 * 60 * 1000));
}
