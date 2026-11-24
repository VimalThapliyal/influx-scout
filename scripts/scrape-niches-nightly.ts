#!/usr/bin/env tsx
/**
 * Safe nightly scrape for all four niches — one browser session, rate limits, rotation.
 *
 * Usage:
 *   npm run scrape:niches              # default safe nightly run
 *   npm run scrape:niches -- --dry-run
 *   npm run scrape:niches:install      # install macOS launchd job (2 AM daily)
 */

import { mkdirSync, appendFileSync } from "fs";
import { resolve } from "path";
import { loadEnv } from "./lib/env";
import { discoverNiche } from "./lib/discover";
import { enrichChannels, mergeStats, type EnrichBatchStats } from "./lib/enrich-batch";
import {
  NICHE_PLAN,
  nightIndexFromDate,
  pickRotatingSearches,
} from "./lib/niche-plan";
import { TARGET_MARKET_LABEL, pickRotatingRegionCode } from "./lib/markets";
import {
  createScraperContext,
  hasAuthState,
  sleep,
} from "./lib/youtube-scraper";

interface NightlyConfig {
  limitPerSearch: number;
  searchesPerNiche: number;
  delayMs: number;
  jitterMs: number;
  pauseBetweenSearchesMs: number;
  pauseBetweenNichesMs: number;
  maxEnrichPerNight: number;
  maxLockedStreak: number;
  backlogLimit: number;
  useAuth: boolean;
  headless: boolean;
  pauseOnCaptcha: boolean;
  dryRun: boolean;
  skipBacklog: boolean;
}

interface NightlyArgs extends NightlyConfig {
  help: boolean;
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function defaultConfig(): NightlyConfig {
  return {
    limitPerSearch: envInt("NIGHTLY_LIMIT_PER_SEARCH", 25),
    searchesPerNiche: envInt("NIGHTLY_SEARCHES_PER_NICHE", 2),
    delayMs: envInt("NIGHTLY_DELAY_MS", 5500),
    jitterMs: envInt("NIGHTLY_JITTER_MS", 2000),
    pauseBetweenSearchesMs: envInt("NIGHTLY_PAUSE_SEARCH_MS", 45_000),
    pauseBetweenNichesMs: envInt("NIGHTLY_PAUSE_NICHE_MS", 90_000),
    maxEnrichPerNight: envInt("NIGHTLY_MAX_ENRICH", 100),
    maxLockedStreak: envInt("NIGHTLY_MAX_LOCKED_STREAK", 5),
    backlogLimit: envInt("NIGHTLY_BACKLOG_LIMIT", 30),
    useAuth: process.env.SCRAPER_USE_AUTH !== "false",
    headless: process.env.SCRAPER_HEADLESS !== "false",
    pauseOnCaptcha: false,
    dryRun: false,
    skipBacklog: false,
  };
}

function parseArgs(argv: string[]): NightlyArgs {
  const args: NightlyArgs = { ...defaultConfig(), help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--no-backlog") args.skipBacklog = true;
    else if (arg === "--auth") args.useAuth = true;
    else if (arg === "--no-auth") args.useAuth = false;
    else if (arg === "--headed") args.headless = false;
    else if (arg === "--pause-on-captcha") {
      args.pauseOnCaptcha = true;
      args.headless = false;
    } else if (arg === "--limit" && argv[i + 1]) {
      args.limitPerSearch = Math.min(50, Math.max(5, parseInt(argv[++i], 10) || 25));
    } else if (arg === "--max-enrich" && argv[i + 1]) {
      args.maxEnrichPerNight = Math.max(10, parseInt(argv[++i], 10) || 100);
    } else if (arg === "--help" || arg === "-h") args.help = true;
  }

  return args;
}

function printHelp() {
  console.log(`
Nightly niche scraper (safe defaults for unattended Mac runs)

  npm run scrape:niches
  npm run scrape:niches:install     macOS launchd — daily at 2:00 AM

Options:
  --dry-run              Show tonight's plan without scraping
  --no-backlog           Skip enrich-only pass at the end
  --limit <n>            Channels per search (default: 25, max: 50)
  --max-enrich <n>       Cap total enrichments per night (default: 100)
  --auth / --no-auth     YouTube login session (default: auth on)
  --pause-on-captcha     Interactive CAPTCHA solve (not for launchd)
  --headed               Show browser

Safety (tune in .env.local):
  NIGHTLY_LIMIT_PER_SEARCH=25
  NIGHTLY_SEARCHES_PER_NICHE=2    # 2 of 3 terms per niche; rotates nightly
  NIGHTLY_DELAY_MS=5500
  NIGHTLY_JITTER_MS=2000
  NIGHTLY_PAUSE_SEARCH_MS=45000
  NIGHTLY_PAUSE_NICHE_MS=90000
  NIGHTLY_MAX_ENRICH=100
  NIGHTLY_MAX_LOCKED_STREAK=5
  NIGHTLY_BACKLOG_LIMIT=30

Prerequisites:
  npm run scrape:login
  .env.local with Supabase + YOUTUBE_API_KEY
`);
}

function logLine(message: string, logPath: string) {
  const stamp = new Date().toISOString();
  const line = `[${stamp}] ${message}`;
  console.log(message);
  appendFileSync(logPath, `${line}\n`);
}

function formatMs(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const logsDir = resolve(__dirname, "logs");
  mkdirSync(logsDir, { recursive: true });
  const logPath = resolve(
    logsDir,
    `nightly-${new Date().toISOString().slice(0, 10)}.log`
  );

  const nightIndex = nightIndexFromDate();
  const plan = NICHE_PLAN.map((niche) => ({
    ...niche,
    tonightSearches: pickRotatingSearches(
      niche.searches,
      args.searchesPerNiche,
      nightIndex + niche.searches.length
    ),
  }));

  const searchCount = plan.reduce((n, p) => n + p.tonightSearches.length, 0);
  const apiEstimate = searchCount * (100 + args.limitPerSearch);

  logLine("Influx — nightly niche scrape", logPath);
  logLine(`  market: ${TARGET_MARKET_LABEL}`, logPath);
  logLine(`  night index: ${nightIndex}`, logPath);
  logLine(`  searches tonight: ${searchCount} (${args.searchesPerNiche} per niche)`, logPath);
  logLine(`  limit per search: ${args.limitPerSearch}`, logPath);
  logLine(`  max enrich: ${args.maxEnrichPerNight}`, logPath);
  logLine(`  delay: ${args.delayMs}ms + 0–${args.jitterMs}ms jitter`, logPath);
  logLine(`  auth: ${args.useAuth}${args.useAuth && !hasAuthState() ? " (missing — run npm run scrape:login)" : ""}`, logPath);
  logLine(`  API estimate: ~${apiEstimate} units (of 10,000/day)`, logPath);
  logLine("", logPath);

  for (const niche of plan) {
    logLine(`${niche.label}:`, logPath);
    niche.tonightSearches.forEach((term, i) => {
      const region = pickRotatingRegionCode(nightIndex + i);
      logLine(`  • "${term}" [${region}]`, logPath);
    });
  }
  logLine("", logPath);

  if (args.dryRun) {
    logLine("Dry run — no scraping performed.", logPath);
    return;
  }

  if (args.useAuth && !hasAuthState()) {
    logLine("ERROR: No YouTube auth. Run: npm run scrape:login", logPath);
    process.exit(1);
  }

  const totals: EnrichBatchStats = {
    processed: 0,
    enriched: 0,
    skipped: 0,
    failed: 0,
    locked: 0,
    stoppedEarly: false,
  };

  let enrichBudget = args.maxEnrichPerNight;
  const { browser, context } = await createScraperContext({
    headless: args.headless,
    useAuth: args.useAuth,
  });
  const page = await context.newPage();

  try {
    for (let n = 0; n < plan.length; n++) {
      const niche = plan[n];
      logLine(`━━ ${niche.label} ━━`, logPath);

      if (totals.stoppedEarly) break;

      for (let s = 0; s < niche.tonightSearches.length; s++) {
        if (totals.stoppedEarly || enrichBudget <= 0) break;

        const term = niche.tonightSearches[s];
        const regionCode = pickRotatingRegionCode(nightIndex + n * 3 + s);
        logLine(
          `Discover: "${term}" [${regionCode}] (limit ${args.limitPerSearch})`,
          logPath
        );

        const discovered = await discoverNiche(term, args.limitPerSearch, {
          limit: args.limitPerSearch,
          regionCode,
          targetMarketsOnly: true,
          regionSeed: nightIndex + n * 3 + s,
        });
        if (discovered.length === 0) {
          logLine("  No channels found — skipping.", logPath);
          continue;
        }

        logLine(`Enriching up to ${discovered.length} channel(s)…`, logPath);
        const { stats } = await enrichChannels(page, {
          limit: discovered.length,
          enrichOnly: false,
          channelIds: discovered.map((c) => c.id),
          delayMs: args.delayMs,
          jitterMs: args.jitterMs,
          pauseOnCaptcha: args.pauseOnCaptcha,
          maxLockedStreak: args.maxLockedStreak,
          remainingBudget: enrichBudget,
        });

        mergeStats(totals, stats);
        enrichBudget -= stats.processed;

        logLine(
          `  batch: +${stats.enriched} enriched, ${stats.locked} locked, ${stats.failed} failed (budget left: ${enrichBudget})`,
          logPath
        );

        const moreSearches = s < niche.tonightSearches.length - 1;
        if (moreSearches && !totals.stoppedEarly && enrichBudget > 0) {
          logLine(
            `  Pausing ${formatMs(args.pauseBetweenSearchesMs)} before next search…`,
            logPath
          );
          await sleep(args.pauseBetweenSearchesMs);
        }
      }

      const moreNiches = n < plan.length - 1;
      if (moreNiches && !totals.stoppedEarly && enrichBudget > 0) {
        logLine(
          `Pausing ${formatMs(args.pauseBetweenNichesMs)} before next niche…`,
          logPath
        );
        await sleep(args.pauseBetweenNichesMs);
      }
    }

    if (!args.skipBacklog && !totals.stoppedEarly && enrichBudget > 0) {
      const backlogCap = Math.min(args.backlogLimit, enrichBudget);
      logLine(`━━ Backlog enrich (missing email, limit ${backlogCap}) ━━`, logPath);

      const { stats } = await enrichChannels(page, {
        limit: backlogCap,
        enrichOnly: true,
        delayMs: args.delayMs,
        jitterMs: args.jitterMs,
        pauseOnCaptcha: args.pauseOnCaptcha,
        maxLockedStreak: args.maxLockedStreak,
        remainingBudget: enrichBudget,
      });

      mergeStats(totals, stats);
      enrichBudget -= stats.processed;
    }
  } finally {
    await browser.close();
  }

  logLine("", logPath);
  logLine("Nightly run complete.", logPath);
  logLine(`  processed: ${totals.processed}`, logPath);
  logLine(`  enriched:  ${totals.enriched}`, logPath);
  logLine(`  skipped:   ${totals.skipped}`, logPath);
  logLine(`  locked:    ${totals.locked}`, logPath);
  logLine(`  failed:    ${totals.failed}`, logPath);
  if (totals.stoppedEarly) {
    logLine(`  stopped:   ${totals.stopReason}`, logPath);
  }
  logLine(`  log file:  ${logPath}`, logPath);

  if (totals.locked >= 3) {
    logLine(
      "Tip: many CAPTCHA locks — re-run npm run scrape:login and retry tomorrow.",
      logPath
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
