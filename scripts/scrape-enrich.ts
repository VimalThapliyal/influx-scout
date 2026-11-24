#!/usr/bin/env tsx
/**
 * Local Playwright enricher — discover niches, scrape About pages, upsert to Supabase.
 *
 * Usage:
 *   npm run scrape:install              # first time only
 *   npm run scrape:login                # save YouTube login for CAPTCHA-gated emails
 *   npm run scrape                      # enrich channels missing email (default 20)
 *   npm run scrape -- --niche fitness --limit 25 --auth --pause-on-captcha --headed
 */

import { loadEnv } from "./lib/env";
import { discoverNiche } from "./lib/discover";
import { fetchChannelsToEnrich, upsertEnrichment } from "./lib/supabase";
import {
  createScraperContext,
  hasAuthState,
  scrapeChannelAbout,
  sleep,
} from "./lib/youtube-scraper";

interface CliArgs {
  limit: number;
  enrichOnly: boolean;
  channelId?: string;
  niche?: string;
  headless: boolean;
  delayMs: number;
  useAuth: boolean;
  pauseOnCaptcha: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    limit: 20,
    enrichOnly: true,
    headless: true,
    delayMs: Number(process.env.SCRAPER_DELAY_MS ?? 4000),
    useAuth: false,
    pauseOnCaptcha: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--limit" && argv[i + 1]) {
      args.limit = Math.max(1, parseInt(argv[++i], 10) || 20);
    } else if (arg === "--channel-id" && argv[i + 1]) {
      args.channelId = argv[++i];
    } else if (arg === "--niche" && argv[i + 1]) {
      args.niche = argv[++i];
    } else if (arg === "--delay" && argv[i + 1]) {
      args.delayMs = Math.max(1000, parseInt(argv[++i], 10) || 4000);
    } else if (arg === "--all") {
      args.enrichOnly = false;
    } else if (arg === "--headed") {
      args.headless = false;
    } else if (arg === "--headless") {
      args.headless = true;
    } else if (arg === "--auth") {
      args.useAuth = true;
    } else if (arg === "--pause-on-captcha") {
      args.pauseOnCaptcha = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (process.env.SCRAPER_HEADLESS === "false") args.headless = false;
  if (process.env.SCRAPER_USE_AUTH === "true") args.useAuth = true;
  if (args.pauseOnCaptcha) args.headless = false;

  return args;
}

function printHelp() {
  console.log(`
Local YouTube scraper → Supabase

Commands:
  npm run scrape:login     Save YouTube login session (run once)

Options:
  --niche <keyword>       Discover channels via YouTube API, then enrich
  --limit <n>             Max channels (default: 20)
  --channel-id <id>       Scrape a single channel
  --all                   Re-scrape channels that already have email
  --auth                  Use saved YouTube login (scripts/.auth/youtube-state.json)
  --pause-on-captcha      Show browser; pause for you to solve CAPTCHA (implies --headed)
  --delay <ms>            Pause between channels (default: 4000)
  --headed / --headless   Browser visibility

Examples:
  npm run scrape -- --niche "fitness" --limit 25 --auth --pause-on-captcha
  npm run scrape -- --limit 50 --auth
  npm run scrape -- --channel-id UCxxxx --pause-on-captcha

Env (.env.local):
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  YOUTUBE_API_KEY          (required for --niche)
`);
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));

  console.log("Influx — local scraper");
  console.log(`  limit: ${args.limit}`);
  console.log(`  enrich-only: ${args.enrichOnly}`);
  console.log(`  delay: ${args.delayMs}ms`);
  console.log(`  headless: ${args.headless}`);
  console.log(`  auth: ${args.useAuth}${args.useAuth && !hasAuthState() ? " (no session — run npm run scrape:login)" : ""}`);
  console.log(`  pause-on-captcha: ${args.pauseOnCaptcha}`);
  if (args.niche) console.log(`  niche: ${args.niche}`);
  if (args.channelId) console.log(`  channel: ${args.channelId}`);
  console.log("");

  let discoveredIds: string[] | undefined;

  if (args.niche) {
    const discovered = await discoverNiche(args.niche, args.limit, {
      limit: args.limit,
      targetMarketsOnly: true,
    });
    discoveredIds = discovered.map((c) => c.id);
    if (discoveredIds.length === 0) return;
  }

  const channels = await fetchChannelsToEnrich({
    limit: args.limit,
    enrichOnly: args.niche ? false : args.enrichOnly,
    channelId: args.channelId,
    channelIds: discoveredIds,
  });

  if (channels.length === 0) {
    console.log(
      args.niche
        ? "All discovered channels already have emails. Use --all to re-scrape."
        : "No channels to enrich. Use --niche or run Discover in the app first."
    );
    return;
  }

  console.log(`Enriching ${channels.length} channel(s)…\n`);

  const { browser, context } = await createScraperContext({
    headless: args.headless,
    useAuth: args.useAuth,
  });
  const page = await context.newPage();

  let enriched = 0;
  let skipped = 0;
  let failed = 0;
  let locked = 0;

  for (let i = 0; i < channels.length; i++) {
    const channel = channels[i];
    const label = channel.handle ?? channel.id;
    process.stdout.write(`[${i + 1}/${channels.length}] ${channel.title} (${label}) … `);

    try {
      const result = await scrapeChannelAbout(page, channel, {
        pauseOnCaptcha: args.pauseOnCaptcha,
      });
      const { updated, fields } = await upsertEnrichment(channel.id, channel, result);

      if (result.email_status === "locked") locked++;

      if (updated) {
        enriched++;
        const status =
          result.email_status === "found"
            ? result.email ?? "found"
            : result.email_status;
        console.log(`✓ ${fields.join(", ")} — ${status}`);
      } else {
        skipped++;
        console.log(`– ${result.email_status}`);
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : "unknown error";
      console.log(`✗ ${msg}`);
    }

    if (i < channels.length - 1) await sleep(args.delayMs);
  }

  await browser.close();

  console.log("\nDone.");
  console.log(`  enriched: ${enriched}`);
  console.log(`  skipped:  ${skipped}`);
  console.log(`  locked:   ${locked} (CAPTCHA — retry with --pause-on-captcha)`);
  console.log(`  failed:   ${failed}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
