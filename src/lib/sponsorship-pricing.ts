/**
 * Rough sponsorship pricing model: price = expected views / 1000 × CPM.
 * These are ASSUMPTIONS (typical ranges quoted by creators and agencies),
 * not measured data — the page says so next to the result.
 */
export const FORMAT_CPM: Record<string, { label: string; low: number; high: number }> = {
  integration: { label: "Integrated mention (60–90 sec)", low: 15, high: 35 },
  dedicated: { label: "Dedicated video", low: 35, high: 75 },
  short: { label: "YouTube Short", low: 5, high: 15 },
};

export const NICHE_MULTIPLIER: { value: string; label: string; m: number }[] = [
  { value: "personal-finance", label: "Personal finance", m: 1.6 },
  { value: "business", label: "Business", m: 1.5 },
  { value: "tech", label: "Tech", m: 1.4 },
  { value: "education", label: "Education", m: 1.2 },
  { value: "self-improvement", label: "Self-improvement", m: 1.2 },
  { value: "beauty", label: "Beauty", m: 1.1 },
  { value: "fitness", label: "Fitness", m: 1.1 },
  { value: "parenting", label: "Parenting", m: 1.1 },
  { value: "home", label: "Home & DIY", m: 1.0 },
  { value: "fashion", label: "Fashion", m: 1.0 },
  { value: "food", label: "Food", m: 1.0 },
  { value: "travel", label: "Travel", m: 1.0 },
  { value: "lifestyle", label: "Lifestyle", m: 1.0 },
  { value: "pets", label: "Pets", m: 1.0 },
  { value: "podcast", label: "Podcast", m: 1.0 },
  { value: "sports", label: "Sports", m: 0.9 },
  { value: "music", label: "Music", m: 0.8 },
  { value: "gaming", label: "Gaming", m: 0.8 },
  { value: "entertainment", label: "Entertainment", m: 0.8 },
];
