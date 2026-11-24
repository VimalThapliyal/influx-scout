/**
 * Pull next unused batch from seed-bank → seed-lists.
 * When bank is empty, auto-generate + validate new roundup URL candidates,
 * then recycle oldest used URLs so grow:loop never sits idle forever.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import {
  clearSeedsNeedRefresh,
  saveSeedHistory,
  loadSeedHistory,
  normSeedUrl,
  usedSeedUrlSet,
  filterUnusedSeedEntries,
} from "./seed-history";

const BANK_PATH = resolve(process.cwd(), "data/seed-bank.json");
const SEED_PATH = resolve(process.cwd(), "data/seed-lists.json");

export interface BankEntry {
  niche: string;
  title: string;
  url: string;
}

interface BankFile {
  _comment?: string;
  updated_at?: string;
  urls?: BankEntry[];
}

/** Broad Feedspot-style niche slugs (many are real list pages). */
const FEEDSPOT_SLUGS: Array<{ niche: string; slug: string }> = [
  { niche: "finance", slug: "finance" },
  { niche: "finance", slug: "investing" },
  { niche: "finance", slug: "cryptocurrency" },
  { niche: "finance", slug: "real_estate" },
  { niche: "finance", slug: "stock_market" },
  { niche: "finance", slug: "business" },
  { niche: "finance", slug: "entrepreneur" },
  { niche: "fitness", slug: "fitness" },
  { niche: "fitness", slug: "yoga" },
  { niche: "fitness", slug: "weight_loss" },
  { niche: "fitness", slug: "workout" },
  { niche: "fitness", slug: "crossfit" },
  { niche: "fitness", slug: "bodybuilding" },
  { niche: "beauty", slug: "beauty" },
  { niche: "beauty", slug: "makeup" },
  { niche: "beauty", slug: "skincare" },
  { niche: "beauty", slug: "hair" },
  { niche: "fashion", slug: "fashion" },
  { niche: "fashion", slug: "style" },
  { niche: "food", slug: "food" },
  { niche: "food", slug: "cooking" },
  { niche: "food", slug: "baking" },
  { niche: "food", slug: "vegan" },
  { niche: "food", slug: "recipes" },
  { niche: "travel", slug: "travel" },
  { niche: "travel", slug: "adventure" },
  { niche: "travel", slug: "van_life" },
  { niche: "parenting", slug: "parenting" },
  { niche: "parenting", slug: "family" },
  { niche: "parenting", slug: "mom" },
  { niche: "education", slug: "education" },
  { niche: "education", slug: "science" },
  { niche: "education", slug: "history" },
  { niche: "education", slug: "math" },
  { niche: "pets", slug: "pet" },
  { niche: "pets", slug: "dog" },
  { niche: "pets", slug: "cat" },
  { niche: "diy", slug: "diy" },
  { niche: "diy", slug: "home_improvement" },
  { niche: "diy", slug: "woodworking" },
  { niche: "diy", slug: "crafts" },
  { niche: "tech", slug: "tech" },
  { niche: "tech", slug: "programming" },
  { niche: "tech", slug: "gadget" },
  { niche: "tech", slug: "coding" },
  { niche: "tech", slug: "ai" },
  { niche: "gaming", slug: "gaming" },
  { niche: "gaming", slug: "esports" },
  { niche: "gaming", slug: "minecraft" },
  { niche: "gaming", slug: "fortnite" },
  { niche: "gaming", slug: "roblox" },
];

const TOP10GRID_NICHES = [
  "personal-finance",
  "fitness",
  "cooking-food",
  "gaming",
  "tech",
  "beauty",
  "travel",
  "education",
  "fashion",
  "parenting",
];

/** From idea.txt — USA ranking pages (prefer over generic Feedspot). */
const USA_RANKING_SOURCES: BankEntry[] = [
  { niche: "finance", title: "HypeAuditor USA Finance", url: "https://hypeauditor.com/top-youtube-finance-and-economics-united-states/" },
  { niche: "education", title: "HypeAuditor USA Education", url: "https://hypeauditor.com/top-youtube-education-united-states/" },
  { niche: "tech", title: "HypeAuditor USA Science & Tech", url: "https://hypeauditor.com/top-youtube-science-and-technology-united-states/" },
  { niche: "fitness", title: "HypeAuditor USA Fitness", url: "https://hypeauditor.com/top-youtube-fitness-united-states/" },
  { niche: "beauty", title: "HypeAuditor USA Beauty", url: "https://hypeauditor.com/top-youtube-beauty-united-states/" },
  { niche: "gaming", title: "HypeAuditor USA Gaming", url: "https://hypeauditor.com/top-youtube-games-united-states/" },
  { niche: "travel", title: "HypeAuditor USA Travel", url: "https://hypeauditor.com/top-youtube-travel-united-states/" },
  { niche: "food", title: "HypeAuditor USA Food", url: "https://hypeauditor.com/top-youtube-food-and-drinks-united-states/" },
  { niche: "pets", title: "HypeAuditor USA Animals", url: "https://hypeauditor.com/top-youtube-animals-and-pets-united-states/" },
  { niche: "tech", title: "HypeAuditor USA Autos", url: "https://hypeauditor.com/top-youtube-autos-and-vehicles-united-states/" },
  { niche: "all", title: "HypeAuditor Top YouTube USA", url: "https://hypeauditor.com/top-youtube-all-united-states/" },
  { niche: "all", title: "Social Blade Top 50 USA", url: "https://socialblade.com/youtube/lists/top/50/subscribers/all/US" },
  { niche: "gaming", title: "Social Blade Top Gaming USA", url: "https://socialblade.com/youtube/lists/top/50/subscribers/games/US" },
  { niche: "tech", title: "Social Blade Top Science USA", url: "https://socialblade.com/youtube/lists/top/50/subscribers/science/US" },
  { niche: "howto", title: "Social Blade Top Howto USA", url: "https://socialblade.com/youtube/lists/top/50/subscribers/howto/US" },
  { niche: "tech", title: "Heepsy Top Tech USA", url: "https://www.heepsy.com/top-youtube/tech/united-states" },
  { niche: "beauty", title: "Heepsy Top Beauty USA", url: "https://www.heepsy.com/top-youtube/beauty/united-states" },
  { niche: "fitness", title: "Heepsy Top Fitness USA", url: "https://www.heepsy.com/top-youtube/fitness/united-states" },
  { niche: "travel", title: "Heepsy Top Travel USA", url: "https://www.heepsy.com/top-youtube/travel/united-states" },
  { niche: "fashion", title: "Heepsy Top Fashion USA", url: "https://www.heepsy.com/top-youtube/fashion/united-states" },
  { niche: "food", title: "Heepsy Top Food USA", url: "https://www.heepsy.com/top-youtube/food/united-states" },
  { niche: "gaming", title: "Heepsy Top Gaming USA", url: "https://www.heepsy.com/top-youtube/gaming/united-states" },
  { niche: "all", title: "Feedspot American YouTubers", url: "https://videos.feedspot.com/american_youtube_channels/" },
  { niche: "travel", title: "Feedspot USA Travel", url: "https://videos.feedspot.com/usa_travel_youtube_channels/" },
  { niche: "fashion", title: "Feedspot US Fashion", url: "https://videos.feedspot.com/us_fashion_youtube_channels/" },
  { niche: "finance", title: "Feedspot Business YouTubers", url: "https://videos.feedspot.com/business_youtube_channels/" },
  { niche: "education", title: "Feedspot Career YouTubers", url: "https://videos.feedspot.com/career_youtube_channels/" },
  { niche: "fitness", title: "Influencers.club Fitness", url: "https://influencers.club/blog/youtube-fitness-influencers/" },
];

/** Cap generic Feedspot invent-URLs so bank isn't all feedspot.com */
const MAX_GENERIC_FEEDSPOT = 12;

/** Curated extras — keep adding here; validated at refill time. */
const CURATED_EXTRAS: BankEntry[] = [
  { niche: "finance", title: "Sprout Social YouTube Influencers 2026", url: "https://sproutsocial.com/insights/youtube-influencers/" },
  { niche: "finance", title: "Dashdevs Fintech YouTube", url: "https://dashdevs.com/blog/top-10-fintech-youtube-channels-to-subscribe-to-in-2021/" },
  { niche: "finance", title: "NerdWallet YouTube money creators", url: "https://www.nerdwallet.com/article/finance/best-personal-finance-youtube-channels" },
  { niche: "fitness", title: "Men's Health workout YouTubers", url: "https://www.menshealth.com/fitness/a19545684/best-youtube-workout-channels/" },
  { niche: "fitness", title: "Shape best workout YouTube", url: "https://www.shape.com/fitness/workouts/best-youtube-workout-channels" },
  { niche: "beauty", title: "Allure beauty YouTubers", url: "https://www.allure.com/story/best-beauty-youtube-channels" },
  { niche: "beauty", title: "Cosmopolitan beauty YouTubers", url: "https://www.cosmopolitan.com/style-beauty/beauty/g25385154/best-beauty-youtubers/" },
  { niche: "fashion", title: "Who What Wear fashion YouTubers", url: "https://www.whowhatwear.com/best-fashion-youtubers" },
  { niche: "food", title: "Tasting Table cooking YouTubers", url: "https://www.tastingtable.com/best-cooking-youtube-channels/" },
  { niche: "food", title: "Serious Eats YouTube cooks", url: "https://www.seriouseats.com/best-cooking-youtube-channels" },
  { niche: "travel", title: "Lonely Planet travel YouTubers", url: "https://www.lonelyplanet.com/articles/best-travel-youtubers" },
  { niche: "travel", title: "Timeout travel YouTubers", url: "https://www.timeout.com/travel/best-travel-youtubers" },
  { niche: "parenting", title: "Parents.com YouTube channels", url: "https://www.parents.com/best-youtube-channels-for-kids-8630472" },
  { niche: "education", title: "Common Sense Media YouTube kids", url: "https://www.commonsensemedia.org/lists/best-youtube-channels-for-kids" },
  { niche: "tech", title: "PCMag tech YouTubers", url: "https://www.pcmag.com/news/the-best-tech-youtube-channels" },
  { niche: "tech", title: "Wired tech YouTubers", url: "https://www.wired.com/story/best-tech-youtube-channels/" },
  { niche: "gaming", title: "IGN gaming creators", url: "https://www.ign.com/articles/best-youtube-gaming-channels" },
  { niche: "diy", title: "Family Handyman DIY YouTubers", url: "https://www.familyhandyman.com/list/best-diy-youtube-channels/" },
  { niche: "pets", title: "PetMD pet YouTubers", url: "https://www.petmd.com/dog/care/best-dog-youtube-channels" },
  { niche: "pets", title: "American Kennel Club dog YouTube", url: "https://www.akc.org/expert-advice/lifestyle/best-dog-youtube-channels/" },
  { niche: "gaming", title: "Polygon YouTube creators", url: "https://www.polygon.com/youtube" },
  { niche: "education", title: "Edutopia YouTube teachers", url: "https://www.edutopia.org/article/best-youtube-channels-teachers" },
  { niche: "finance", title: "Bankrate finance YouTubers", url: "https://www.bankrate.com/banking/best-personal-finance-youtube-channels/" },
  { niche: "fitness", title: "Self magazine workout YouTube", url: "https://www.self.com/story/best-youtube-workout-channels" },
  { niche: "beauty", title: "Into The Gloss beauty YouTube", url: "https://intothegloss.com/2019/05/best-beauty-youtubers/" },
  { niche: "tech", title: "The Verge YouTube creators", url: "https://www.theverge.com/creators" },
  { niche: "food", title: "Eater YouTube food", url: "https://www.eater.com/youtube" },
  { niche: "diy", title: "Apartment Therapy DIY YouTube", url: "https://www.apartmenttherapy.com/best-diy-youtube-channels-36749205" },
  { niche: "parenting", title: "Fatherly dad YouTubers", url: "https://www.fatherly.com/entertainment/best-dad-youtubers" },
  { niche: "travel", title: "Conde Nast Traveler YouTubers", url: "https://www.cntraveler.com/story/best-travel-youtubers" },
];

function normUrl(url: string): string {
  return normSeedUrl(url);
}

function loadBank(): BankEntry[] {
  if (!existsSync(BANK_PATH)) return [];
  try {
    const raw = JSON.parse(readFileSync(BANK_PATH, "utf8")) as BankFile;
    return raw.urls || [];
  } catch {
    return [];
  }
}

function saveBank(urls: BankEntry[]) {
  const dedup = new Map<string, BankEntry>();
  for (const e of urls) {
    if (!e.url) continue;
    dedup.set(normUrl(e.url), e);
  }
  const payload: BankFile = {
    _comment:
      "Roundup URL pool for grow:loop. Prefers USA sources (idea.txt): HypeAuditor, Social Blade, Heepsy.",
    updated_at: new Date().toISOString().slice(0, 10),
    urls: Array.from(dedup.values()),
  };
  writeFileSync(BANK_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

export function bankRemaining(): number {
  const used = usedSeedUrlSet();
  return loadBank().filter((e) => e.url && !used.has(normUrl(e.url))).length;
}

function candidatePool(): BankEntry[] {
  const out: BankEntry[] = [];

  // 1) USA ranking pages first (idea.txt)
  out.push(...USA_RANKING_SOURCES);

  // 2) Editorial curated lists
  out.push(...CURATED_EXTRAS);

  // 3) Top10Grid year variants
  for (const niche of TOP10GRID_NICHES) {
    for (const year of ["2026", "2025"]) {
      out.push({
        niche: niche.split("-")[0],
        title: `Top10Grid ${niche} ${year}`,
        url: `https://top10grid.com/top-10-youtube-channels-${niche}-${year}`,
      });
    }
  }

  // 4) Cap generic Feedspot invent-URLs
  for (const { niche, slug } of FEEDSPOT_SLUGS.slice(0, MAX_GENERIC_FEEDSPOT)) {
    out.push({
      niche,
      title: `Feedspot ${slug} YouTube channels`,
      url: `https://videos.feedspot.com/${slug}_youtube_channels/`,
    });
  }

  return out;
}

async function urlLooksAlive(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; InfluxSeedBot/1.0; +https://influencer-platform-mu.vercel.app)",
        Accept: "text/html",
      },
    });
    clearTimeout(t);
    if (res.status >= 400) return false;
    const ct = res.headers.get("content-type") || "";
    if (ct && !/html|text|xml/i.test(ct)) return false;
    const text = (await res.text()).slice(0, 80_000).toLowerCase();
    return text.includes("youtube") || text.includes("youtu.be");
  } catch {
    return false;
  }
}

/**
 * OPTIONAL: re-queue oldest used roundup URLs (sites may update over time).
 * Off by default — grow keeps unique seed URLs only.
 * Enable with: npm run grow:loop -- --allow-recycle
 */
export function recycleUsedSeeds(count = 25): number {
  const history = loadSeedHistory();
  const used = history.used_urls || [];
  if (used.length === 0) return 0;

  const take = used.slice(0, Math.min(count, used.length));
  const remaining = used.slice(take.length);
  history.used_urls = remaining;
  saveSeedHistory(history);

  const bank = loadBank();
  const existing = new Set(bank.map((e) => normUrl(e.url)));
  for (const url of take) {
    if (existing.has(normUrl(url))) continue;
    bank.push({
      niche: "recycle",
      title: `Recycled roundup`,
      url,
    });
  }
  saveBank(bank);
  console.log(
    `  recycle: re-queued ${take.length} oldest used URLs (${remaining.length} still in history)`
  );
  return take.length;
}

export async function refillSeedBankAuto(options?: {
  maxValidate?: number;
  /** If true, when no new candidates exist, re-queue oldest used URLs. Default false. */
  allowRecycle?: boolean;
}): Promise<{ added: number; checked: number; remaining: number; recycled: number }> {
  const maxValidate = options?.maxValidate ?? 40;
  const allowRecycle = options?.allowRecycle === true;
  const historyUsed = usedSeedUrlSet();
  const bank = loadBank();
  const bankUsed = new Set(bank.map((e) => normUrl(e.url)));

  const candidates = candidatePool().filter((e) => {
    const n = normUrl(e.url);
    return !historyUsed.has(n) && !bankUsed.has(n);
  });

  console.log(
    `  refill: ${candidates.length} candidate URLs not yet used — validating up to ${maxValidate}…`
  );

  const added: BankEntry[] = [];
  let checked = 0;
  for (const c of candidates) {
    if (added.length >= maxValidate) break;
    checked++;
    process.stdout.write(`    ? ${c.url} … `);
    const ok = await urlLooksAlive(c.url);
    console.log(ok ? "OK" : "skip");
    if (ok) {
      added.push(c);
      bankUsed.add(normUrl(c.url));
    }
    await new Promise((r) => setTimeout(r, 350));
  }

  if (added.length > 0) {
    saveBank([...bank, ...added]);
  }

  let recycled = 0;
  if (added.length === 0 && allowRecycle) {
    console.log("  refill found 0 new URLs — recycling oldest used seeds…");
    recycled = recycleUsedSeeds(30);
  } else if (added.length === 0) {
    console.log(
      "  refill found 0 new URLs — NOT recycling (unique-only). Add URLs to seed-bank or pass --allow-recycle."
    );
  }

  const remaining = bankRemaining();
  console.log(
    `  refill done: +${added.length} new, recycled ${recycled} · unused in bank now ${remaining}`
  );
  return { added: added.length, checked, remaining, recycled };
}

/**
 * Write next unused batch from seed-bank → seed-lists.json.
 * Only never-used URLs (not in seed-history.json). Import marks them used after processing.
 */
export function autoRefreshSeedLists(options?: {
  limit?: number;
}): { added: number; total: number; remaining: number; skippedCurrent: number } {
  const limit = options?.limit ?? 20;

  const used = usedSeedUrlSet();
  const unused = loadBank().filter(
    (e) => e.url && !used.has(normUrl(e.url))
  );

  const { unused: batch, skipped } = filterUnusedSeedEntries(
    unused.slice(0, limit)
  );

  const payload = {
    _comment:
      "Auto batch of UNIQUE unused roundups from seed-bank.json. Already-imported URLs live in seed-history.json.",
    updated_at: new Date().toISOString().slice(0, 10),
    lists: batch,
  };
  writeFileSync(SEED_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
  clearSeedsNeedRefresh();

  const remaining = Math.max(0, unused.length - batch.length);
  console.log(
    `  bank: picked ${batch.length} unique URLs (${remaining} unused left in bank, history=${used.size})`
  );
  return {
    added: batch.length,
    total: batch.length,
    remaining,
    skippedCurrent: skipped.length,
  };
}
