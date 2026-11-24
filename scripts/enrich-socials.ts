#!/usr/bin/env tsx
/**
 * About-page enricher — social links + public email from YouTube /about.
 * Native equivalent of youtube-scrapy-scraper (research), using Playwright.
 * Zero YouTube Data API quota.
 *
 * Skips channels already scraped (about_checked_at + local progress file)
 * so re-runs advance to the next batch instead of replaying MrBeast forever.
 *
 *   npm run enrich:socials
 *   npm run enrich:socials -- --limit 40 --country US
 *   npm run enrich:socials -- --mark-seen --limit 40 --country US   # stamp current queue done, no scrape
 *   npm run enrich:socials -- --retry --limit 10                    # re-scrape already checked
 *   npm run enrich:socials -- --then-emails --limit 30
 */
import { spawnSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { resolve } from "path";
import { loadEnv } from "./lib/env";
loadEnv();

import { createClient } from "@supabase/supabase-js";
import {
  aboutUrl,
  createScraperContext,
  hasAuthState,
  scrapeChannelAbout,
  sleep,
} from "./lib/youtube-scraper";
import {
  getScraperSupabase,
  upsertEnrichment,
  type ChannelRow,
} from "./lib/supabase";

const PROGRESS_PATH = resolve(process.cwd(), "data/about-scrape-progress.json");

interface CliArgs {
  limit: number;
  offset: number;
  dryRun: boolean;
  headless: boolean;
  useAuth: boolean;
  pauseOnCaptcha: boolean;
  delayMs: number;
  thenEmails: boolean;
  country: string | null;
  minSubs: number;
  missingOnly: boolean;
  /** Re-scrape channels that already have about_checked_at */
  retry: boolean;
  /** Stamp current queue as checked without scraping (catch-up after old runs) */
  markSeen: boolean;
}

interface ProgressFile {
  checked_ids: string[];
  updated_at?: string;
}

function loadLocalProgress(): Set<string> {
  if (!existsSync(PROGRESS_PATH)) return new Set();
  try {
    const raw = JSON.parse(readFileSync(PROGRESS_PATH, "utf8")) as ProgressFile;
    return new Set(raw.checked_ids ?? []);
  } catch {
    return new Set();
  }
}

function saveLocalProgress(ids: Set<string>) {
  mkdirSync(resolve(PROGRESS_PATH, ".."), { recursive: true });
  writeFileSync(
    PROGRESS_PATH,
    JSON.stringify(
      {
        updated_at: new Date().toISOString(),
        count: ids.size,
        checked_ids: Array.from(ids),
      },
      null,
      2
    )
  );
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    limit: 40,
    offset: 0,
    dryRun: false,
    headless: true,
    useAuth: false,
    pauseOnCaptcha: false,
    delayMs: Number(process.env.SCRAPER_DELAY_MS ?? 4000),
    thenEmails: false,
    country: null,
    minSubs: 0,
    missingOnly: true,
    retry: false,
    markSeen: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit" && argv[i + 1]) {
      args.limit = Math.max(1, parseInt(argv[++i]!, 10) || 40);
    } else if (a === "--offset" && argv[i + 1]) {
      args.offset = Math.max(0, parseInt(argv[++i]!, 10) || 0);
    } else if (a === "--delay" && argv[i + 1]) {
      args.delayMs = Math.max(1000, parseInt(argv[++i]!, 10) || 4000);
    } else if (a === "--min-subs" && argv[i + 1]) {
      args.minSubs = Math.max(0, parseInt(argv[++i]!, 10) || 0);
    } else if (a === "--country" && argv[i + 1]) {
      args.country = argv[++i]!.toUpperCase();
    } else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--headed") args.headless = false;
    else if (a === "--headless") args.headless = true;
    else if (a === "--auth") args.useAuth = true;
    else if (a === "--pause-on-captcha") {
      args.pauseOnCaptcha = true;
      args.headless = false;
    } else if (a === "--then-emails") args.thenEmails = true;
    else if (a === "--all") args.missingOnly = false;
    else if (a === "--retry") args.retry = true;
    else if (a === "--mark-seen") args.markSeen = true;
    else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (process.env.SCRAPER_HEADLESS === "false") args.headless = false;
  if (process.env.SCRAPER_USE_AUTH === "true") args.useAuth = true;
  return args;
}

function printHelp() {
  console.log(`
About-page socials + email enricher (0 YouTube API quota)

  npm run enrich:socials -- --limit 40 --country US
  npm run enrich:socials -- --mark-seen --limit 40 --country US
  npm run enrich:socials -- --limit 30 --auth --then-emails

Options:
  --limit <n>          Max channels (default 40)
  --offset <n>         Skip first n of the *unchecked* queue
  --country US         Filter by country code
  --min-subs <n>       Minimum subscribers
  --missing-only       Prefer gaps in website/ig/twitter/email (default)
  --all                Ignore social/email gap filter
  --retry              Include channels already About-scraped
  --mark-seen          Stamp this queue as done WITHOUT scraping (skip already-done batch)
  --auth               Use saved YouTube login (npm run scrape:login)
  --pause-on-captcha   Headed + pause for CAPTCHA
  --then-emails        Chain enrich:emails after
  --delay <ms>         Pause between channels (default 4000)
  --dry-run

Requires migration 018_about_checked_at.sql (falls back to data/about-scrape-progress.json).
`);
}

async function fetchTargets(
  args: CliArgs,
  localSeen: Set<string>
): Promise<{ channels: ChannelRow[]; usedDbColumn: boolean }> {
  const supabase = getScraperSupabase();
  const selectCols =
    "id, handle, title, description, email, website, instagram, twitter, tiktok, data_source, email_status, subscriber_count, country, about_checked_at";

  // Over-fetch then filter local progress (in case DB column not applied yet)
  const fetchN = Math.min(500, Math.max(args.limit * 5, args.limit + args.offset + 50));

  let query = supabase
    .from("channels")
    .select(selectCols)
    .order("subscriber_count", { ascending: false, nullsFirst: false })
    .limit(fetchN);

  if (args.missingOnly) {
    query = query.or(
      "website.is.null,instagram.is.null,twitter.is.null,email.is.null"
    );
  }
  if (args.country) query = query.eq("country", args.country);
  if (args.minSubs > 0) query = query.gte("subscriber_count", args.minSubs);

  let usedDbColumn = true;
  if (!args.retry) {
    query = query.is("about_checked_at", null);
  }

  let { data, error } = await query;

  if (error && /about_checked_at/i.test(error.message)) {
    usedDbColumn = false;
    console.warn(
      "  about_checked_at column missing — run migration 018. Using local progress file only."
    );
    let fallback = supabase
      .from("channels")
      .select(
        "id, handle, title, description, email, website, instagram, twitter, tiktok, data_source, email_status, subscriber_count, country"
      )
      .order("subscriber_count", { ascending: false, nullsFirst: false })
      .limit(fetchN);
    if (args.missingOnly) {
      fallback = fallback.or(
        "website.is.null,instagram.is.null,twitter.is.null,email.is.null"
      );
    }
    if (args.country) fallback = fallback.eq("country", args.country);
    if (args.minSubs > 0) fallback = fallback.gte("subscriber_count", args.minSubs);
    ({ data, error } = await fallback);
  }

  if (error) throw new Error(error.message);

  let rows = (data ?? []) as Array<ChannelRow & { about_checked_at?: string | null }>;

  if (!args.retry) {
    rows = rows.filter((r) => {
      if (localSeen.has(r.id)) return false;
      if (usedDbColumn && r.about_checked_at) return false;
      return true;
    });
  }

  const sliced = rows.slice(args.offset, args.offset + args.limit);
  return { channels: sliced, usedDbColumn };
}

async function markAboutChecked(
  channelId: string,
  usedDbColumn: boolean,
  localSeen: Set<string>
) {
  localSeen.add(channelId);
  saveLocalProgress(localSeen);

  if (!usedDbColumn) return;

  const supabase = getScraperSupabase();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("channels")
    .update({ about_checked_at: now })
    .eq("id", channelId);
  if (error && /about_checked_at/i.test(error.message)) {
    // column disappeared mid-run — local file still covers us
  } else if (error) {
    console.warn(`  mark checked ${channelId}:`, error.message);
  }
}

async function applyAboutProvenance(channelId: string, aboutPageUrl: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const now = new Date().toISOString();
  const patch = {
    email_source_url: aboutPageUrl,
    email_source_type: "youtube_about",
    email_extracted_at: now,
  };
  const { error } = await supabase.from("channels").update(patch).eq("id", channelId);
  if (error && /email_source|youtube_about|check/i.test(error.message)) {
    await supabase
      .from("channels")
      .update({
        email_source_url: aboutPageUrl,
        email_source_type: "other",
        email_extracted_at: now,
      })
      .eq("id", channelId);
  } else if (error) {
    console.warn(`  provenance ${channelId}:`, error.message);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const localSeen = loadLocalProgress();
  console.log(
    `[enrich:socials] limit=${args.limit} missingOnly=${args.missingOnly} country=${args.country ?? "any"} retry=${args.retry} markSeen=${args.markSeen} localSeen=${localSeen.size} dryRun=${args.dryRun}`
  );
  if (args.useAuth && !hasAuthState()) {
    console.warn("  No auth session — run: npm run scrape:login");
  }

  const { channels, usedDbColumn } = await fetchTargets(args, localSeen);
  console.log(
    `Targets: ${channels.length}${usedDbColumn ? "" : " (local progress only)"}`
  );
  if (channels.length === 0) {
    console.log(
      "No unchecked channels left. Use --retry to re-scrape, or raise --limit / drop --country."
    );
    return;
  }

  if (args.dryRun) {
    for (const ch of channels.slice(0, 20)) {
      console.log(
        `  ${ch.title}  ${ch.handle ?? ch.id}  email=${ch.email ? "yes" : "no"} web=${ch.website ? "yes" : "no"} ig=${ch.instagram ? "yes" : "no"}`
      );
    }
    return;
  }

  // Catch-up: stamp the same top batch you already scraped, then next run is new
  if (args.markSeen) {
    for (const ch of channels) {
      await markAboutChecked(ch.id, usedDbColumn, localSeen);
      console.log(`  marked seen: ${ch.title} (${ch.handle ?? ch.id})`);
    }
    console.log(
      `\nMarked ${channels.length} channels as About-checked. Re-run without --mark-seen for the next batch.`
    );
    return;
  }

  const { browser, context } = await createScraperContext({
    headless: args.headless,
    useAuth: args.useAuth,
  });
  const page = await context.newPage();

  let enriched = 0;
  let emailsFound = 0;
  let socialsFound = 0;
  let failed = 0;
  let locked = 0;

  try {
    for (let i = 0; i < channels.length; i++) {
      const channel = channels[i]!;
      const label = channel.handle ?? channel.id;
      process.stdout.write(
        `  [${i + 1}/${channels.length}] ${channel.title} (${label}) … `
      );

      try {
        const result = await scrapeChannelAbout(page, channel, {
          pauseOnCaptcha: args.pauseOnCaptcha,
        });
        const hadEmail = Boolean(channel.email);
        const { updated, fields } = await upsertEnrichment(
          channel.id,
          channel,
          result
        );

        if (result.email_status === "locked") locked++;

        if (updated) {
          enriched++;
          if (fields.includes("email") && result.email && !hadEmail) {
            emailsFound++;
            await applyAboutProvenance(channel.id, aboutUrl(channel));
          }
          if (
            fields.some((f) =>
              ["website", "instagram", "twitter", "tiktok"].includes(f)
            )
          ) {
            socialsFound++;
          }
          console.log(`✓ ${fields.join(", ") || result.email_status}`);
        } else {
          console.log(`– ${result.email_status}`);
        }
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`✗ ${msg}`);
      }

      // Always advance past this channel (even if no new fields / scrape failed)
      await markAboutChecked(channel.id, usedDbColumn, localSeen);

      if (i < channels.length - 1) {
        await sleep(args.delayMs + Math.floor(Math.random() * 800));
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  console.log(
    `\nDone. enriched=${enriched} emails=${emailsFound} socials=${socialsFound} locked=${locked} failed=${failed}`
  );
  console.log(
    `Progress: ${localSeen.size} channels marked About-checked (next run skips them).`
  );

  if (args.thenEmails) {
    console.log("\n── chaining enrich:emails (prefer-links)");
    spawnSync(
      "npm",
      ["run", "enrich:emails", "--", "--prefer-links", "--limit", "80"],
      { stdio: "inherit", cwd: process.cwd() }
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
