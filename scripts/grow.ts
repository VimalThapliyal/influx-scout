#!/usr/bin/env tsx
/**
 * Fastest YouTube channel collection loop (CreatorScout / Influx).
 *
 * Pipeline (each cycle):
 *   1) Refresh unused seed-list batch from seed-bank.json
 *   2) Scrape list pages → light-save to channel_pending (0 YouTube quota)
 *   3) Optional: contribute one cycle (claim DB seed_urls → light-save)
 *   4) Cleanup junk pending
 *   5) Enrich pending via YouTube API until queue empty OR quota floor hit
 *   6) Classify niches + backfill public emails (cheap / zero YT quota)
 *
 * Usage:
 *   npm run grow                 # one full cycle
 *   npm run grow:loop            # forever until Ctrl+C or quota sleep
 *   npm run grow:fast            # loop + aggressive defaults
 *   npm run grow -- --import-only
 *   npm run grow -- --enrich-only
 *   npm run grow -- --quota-floor 300
 *   npm run grow -- --key iw_…
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { spawnSync } from "child_process";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/env";
import {
  seedsNeedRefresh,
  loadSeedHistory,
  setSeedsNeedRefresh,
  saveSeedHistory,
  filterUnusedSeedEntries,
} from "./lib/seed-history";
import { autoRefreshSeedLists, refillSeedBankAuto } from "./lib/auto-refresh-seeds";

loadEnv();

function currentSeedListsAllUsed(seedPath: string): boolean {
  try {
    const seed = JSON.parse(readFileSync(seedPath, "utf8")) as SeedFile;
    const lists = seed.lists || [];
    if (lists.length === 0) return true;
    return filterUnusedSeedEntries(lists).unused.length === 0;
  } catch {
    return true;
  }
}

interface CliArgs {
  enrichLimit: number;
  maxRounds: number;
  importOnly: boolean;
  enrichOnly: boolean;
  promptOnly: boolean;
  skipCleanup: boolean;
  skipContribute: boolean;
  skipClassify: boolean;
  workerKey?: string;
  dryRun: boolean;
  loop: boolean;
  loopSleepSec: number;
  quotaSleepSec: number;
  /** Stop enriching when remaining quota units fall to/below this. */
  quotaFloor: number;
  /** Re-use oldest seed URLs when bank is empty. Default: unique-only. */
  allowRecycle: boolean;
  classifyLimit: number;
}

interface QuotaStatus {
  remaining: number;
  google_quota_exhausted?: boolean;
  reset_note?: string;
  resets_in?: string;
  resets_at_ist?: string;
  resets_in_minutes?: number;
  used?: number;
  limit?: number;
  pacific_date?: string;
}

interface SeedFile {
  lists?: Array<{ niche: string; title: string; url: string }>;
  updated_at?: string;
}

let stopping = false;

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    enrichLimit: 200,
    maxRounds: 100,
    importOnly: false,
    enrichOnly: false,
    promptOnly: false,
    skipCleanup: false,
    skipContribute: false,
    skipClassify: false,
    dryRun: false,
    loop: false,
    loopSleepSec: 30,
    quotaSleepSec: 900,
    quotaFloor: 200,
    allowRecycle: false,
    classifyLimit: 500,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--enrich-limit" && argv[i + 1]) {
      args.enrichLimit = Math.max(1, parseInt(argv[++i], 10) || 200);
    } else if (a === "--max-rounds" && argv[i + 1]) {
      args.maxRounds = Math.max(1, parseInt(argv[++i], 10) || 100);
    } else if (a === "--loop-sleep" && argv[i + 1]) {
      args.loopSleepSec = Math.max(5, parseInt(argv[++i], 10) || 30);
    } else if (a === "--quota-sleep" && argv[i + 1]) {
      args.quotaSleepSec = Math.max(60, parseInt(argv[++i], 10) || 900);
    } else if ((a === "--quota-floor" || a === "--min-remaining") && argv[i + 1]) {
      args.quotaFloor = Math.max(0, parseInt(argv[++i], 10) || 200);
    } else if (a === "--classify-limit" && argv[i + 1]) {
      args.classifyLimit = Math.max(0, parseInt(argv[++i], 10) || 500);
    } else if (a === "--import-only") args.importOnly = true;
    else if (a === "--enrich-only") args.enrichOnly = true;
    else if (a === "--prompt") args.promptOnly = true;
    else if (a === "--skip-cleanup") args.skipCleanup = true;
    else if (a === "--skip-contribute") args.skipContribute = true;
    else if (a === "--skip-classify") args.skipClassify = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--loop") args.loop = true;
    else if (a === "--allow-recycle") args.allowRecycle = true;
    else if (a === "--fast") {
      args.loop = true;
      args.enrichLimit = 250;
      args.loopSleepSec = 20;
      args.quotaFloor = 150;
      args.classifyLimit = 800;
    } else if ((a === "--key" || a === "--worker-key") && argv[i + 1]) {
      args.workerKey = argv[++i];
    } else if (a === "--help" || a === "-h") {
      console.log(`
Influx grow — fastest channel collection

  npm run grow                 # one cycle: seeds → scrape → enrich
  npm run grow:loop            # infinite until Ctrl+C
  npm run grow:fast            # aggressive loop defaults
  npm run grow -- --import-only
  npm run grow -- --enrich-only
  npm run grow -- --quota-floor 300
  npm run grow -- --key iw_…

Pipeline:
  seed-bank → scrape list pages (0 quota) → pending → YouTube enrich → classify

Options:
  --loop / --fast
  --loop-sleep <sec>     pause between cycles (default 30)
  --quota-sleep <sec>    pause when YouTube quota dead (default 900)
  --quota-floor <n>      stop enrich when remaining ≤ n (default 200)
  --enrich-limit <n>     pending rows per enrich round (default 200)
  --classify-limit <n>   channels to classify per cycle (default 500)
  --skip-contribute      skip DB seed_urls claim scrape
  --skip-classify
  --allow-recycle        re-use oldest seed URLs when bank empty
`);
      process.exit(0);
    }
  }
  return args;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => {
    const timer = setTimeout(resolveSleep, ms);
    const onStop = () => {
      clearTimeout(timer);
      resolveSleep();
    };
    if (stopping) {
      clearTimeout(timer);
      resolveSleep();
      return;
    }
    process.once("SIGINT", onStop);
  });
}

function runNpmScript(script: string, scriptArgs: string[] = []): number {
  const npmArgs = ["run", script, "--", ...scriptArgs];
  console.log(`\n▶ npm ${npmArgs.join(" ")}`);
  const result = spawnSync("npm", npmArgs, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  return result.status ?? 1;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function countPending(): Promise<number | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { count, error } = await supabase
    .from("channel_pending")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) {
    console.warn("Could not count pending:", error.message);
    return null;
  }
  return count ?? 0;
}

async function countAvailableSeeds(): Promise<number | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { count, error } = await supabase
    .from("seed_urls")
    .select("id", { count: "exact", head: true })
    .eq("status", "available");
  if (error) return null;
  return count ?? 0;
}

async function fetchQuota(): Promise<QuotaStatus | null> {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://influencer-platform-mu.vercel.app";
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/health`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { quota?: QuotaStatus };
    return data.quota ?? null;
  } catch {
    return null;
  }
}

function buildSeedRefreshPrompt(seedPath: string): string {
  const raw = readFileSync(seedPath, "utf8");
  const seed = JSON.parse(raw) as SeedFile;
  const existing = (seed.lists || []).map((l) => l.url).filter(Boolean);
  const history = loadSeedHistory().used_urls;

  return `Find 25–40 NEW YouTube roundup URLs (JSON seed-lists). Skip:\n${[
    ...existing,
    ...history,
  ]
    .slice(0, 80)
    .join("\n")}`;
}

function writePromptFile(prompt: string): string {
  const out = resolve(process.cwd(), "data/seed-refresh-prompt.txt");
  writeFileSync(out, prompt, "utf8");
  return out;
}

function quotaAvailable(q: QuotaStatus | null, floor: number): boolean {
  if (!q) return true;
  if (q.google_quota_exhausted === true) return false;
  if (typeof q.remaining === "number" && q.remaining <= floor) return false;
  return true;
}

async function youtubeQuotaAlive(): Promise<boolean> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return false;
  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/channels");
    url.searchParams.set("part", "id");
    url.searchParams.set("id", "UCX6OQ3DkcsbYNE6H8uQQuVA");
    url.searchParams.set("key", key);
    const res = await fetch(url.toString());
    if (res.status === 200) return true;
    const body = await res.text();
    return !/quotaExceeded|dailyLimitExceeded/i.test(body);
  } catch {
    return false;
  }
}

async function resolveCanEnrich(
  importOnly: boolean,
  quotaFloor: number
): Promise<boolean> {
  if (importOnly) return false;
  const quota = await fetchQuota();
  if (quota) {
    console.log("Quota:", {
      remaining: quota.remaining,
      floor: quotaFloor,
      exhausted: quota.google_quota_exhausted,
      resets_in: quota.resets_in,
      resets_at_ist: quota.resets_at_ist,
    });
  }
  let canEnrich = quotaAvailable(quota, quotaFloor);
  if (!canEnrich) {
    const alive = await youtubeQuotaAlive();
    if (alive && (!quota || (quota.remaining ?? 0) > quotaFloor)) {
      console.log(
        "⚠ /api/health says exhausted, but live YouTube probe OK — enriching anyway."
      );
      canEnrich = true;
    } else if (alive && quota && (quota.remaining ?? 0) <= quotaFloor) {
      console.log(
        `⏸ Quota remaining (${quota.remaining}) ≤ floor (${quotaFloor}) — holding enrich.`
      );
    }
  }
  return canEnrich;
}

async function runContributeOnce(args: CliArgs): Promise<void> {
  const workerKey =
    args.workerKey ||
    process.env.INFLUX_WORKER_KEY ||
    process.env.WORKER_SUBMIT_TOKEN ||
    "";
  if (args.skipContribute || !workerKey) {
    if (!workerKey) {
      console.log(
        "\n(skip contribute — set INFLUX_WORKER_KEY to also drain DB seed_urls)"
      );
    }
    return;
  }
  if (args.dryRun) {
    console.log("\n[dry-run] would run: npm run contribute (one cycle)");
    return;
  }
  const seeds = await countAvailableSeeds();
  console.log(
    `\n── Contribute (DB seeds available≈${seeds ?? "?"})`
  );
  runNpmScript("contribute");
}

async function runOneCycle(args: CliArgs): Promise<"ok" | "quota" | "fail"> {
  const seedPath = resolve(process.cwd(), "data/seed-lists.json");

  console.log(`
┌─ Pipeline
│  1. import:lists     scrape roundup pages → pending (0 YT quota)
│  2. contribute       claim DB seed_urls → pending (0 YT quota)
│  3. cleanup:pending  drop junk / dupes
│  4. enrich:pending   YouTube channels.list until quota floor
│  5. classify + emails + About socials
└─`);

  // --- 1) Import local seed-lists ---
  if (!args.enrichOnly) {
    if (args.dryRun) {
      console.log("\n[dry-run] would run: npm run import:lists");
    } else {
      const code = runNpmScript(
        "import:lists",
        args.workerKey ? ["--key", args.workerKey] : []
      );
      if (code !== 0) {
        console.error("\nimport:lists failed.");
        return "fail";
      }
    }

    // --- 2) DB seed claim scrape ---
    await runContributeOnce(args);
  }

  // --- 3) Cleanup ---
  if (!args.skipCleanup && !args.dryRun) {
    runNpmScript("cleanup:pending");
  }

  let pending = await countPending();
  console.log(`\nPending after scrape/cleanup: ${pending ?? "?"}`);

  const canEnrich = await resolveCanEnrich(args.importOnly, args.quotaFloor);

  if (args.importOnly || !canEnrich) {
    if (!args.dryRun) {
      console.log("\n── enrich:emails (public links, 0 YouTube quota)");
      runNpmScript("enrich:emails", ["--limit", "80"]);
      console.log("\n── enrich:socials (About page socials + email, 0 quota)");
      runNpmScript("enrich:socials", ["--limit", "25"]);
      if (!args.skipClassify && args.classifyLimit > 0) {
        runNpmScript("classify:channels", [
          "--limit",
          String(args.classifyLimit),
        ]);
      }
    }
    if (!args.loop) {
      const path = writePromptFile(buildSeedRefreshPrompt(seedPath));
      console.log(`
──────────────────────────────────────────
YouTube quota empty / enrich skipped (floor=${args.quotaFloor}).
  Prompt: ${path}
  Or: npm run grow:loop  (auto-waits + refreshes seeds)
`);
    }
    setSeedsNeedRefresh("quota empty or import-only");
    return "quota";
  }

  if (args.dryRun) return "ok";

  // --- 4) Enrich until pending empty or quota floor ---
  let round = 0;
  while (!stopping && round < args.maxRounds) {
    pending = await countPending();
    if (pending === 0) {
      console.log("\n✓ Pending queue empty.");
      break;
    }

    const quota = await fetchQuota();
    if (quota && !quotaAvailable(quota, args.quotaFloor)) {
      console.log(
        `\n⛔ Quota floor hit (remaining=${quota.remaining}, floor=${args.quotaFloor}). Stopping enrich.`
      );
      return "quota";
    }

    round++;
    console.log(
      `\n── Enrich round ${round}/${args.maxRounds} (pending≈${pending}, limit=${args.enrichLimit})`
    );

    const code = runNpmScript("enrich:pending", [
      "--limit",
      String(args.enrichLimit),
    ]);
    pending = await countPending();

    if (code !== 0) {
      console.warn("enrich:pending exited non-zero.");
      break;
    }

    const alive = await youtubeQuotaAlive();
    if (!alive) {
      console.log("\n⛔ YouTube quota exhausted mid-run.");
      return "quota";
    }

    if (pending === 0) break;
  }

  // --- 5) Post-enrich cheap steps ---
  if (!stopping && !args.dryRun) {
    console.log("\n── enrich:emails (public links, 0 YouTube quota)");
    runNpmScript("enrich:emails", ["--limit", "80"]);
    console.log("\n── enrich:socials (About page socials + email, 0 quota)");
    runNpmScript("enrich:socials", ["--limit", "25"]);
    if (!args.skipClassify && args.classifyLimit > 0) {
      console.log("\n── classify:channels (niche + country confidence)");
      runNpmScript("classify:channels", [
        "--limit",
        String(args.classifyLimit),
      ]);
    }
  }

  pending = await countPending();
  console.log(`
──────────────────────────────────────────
Cycle finished.
  pending left: ${pending ?? "?"}
  enrich rounds: ${round}
`);
  return "ok";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const seedPath = resolve(process.cwd(), "data/seed-lists.json");

  if (args.workerKey) {
    process.env.INFLUX_WORKER_KEY = args.workerKey;
  }

  process.on("SIGINT", () => {
    if (stopping) process.exit(0);
    stopping = true;
    console.log("\n\n⏹  Ctrl+C — stopping after current step…");
  });

  console.log(`
╔══════════════════════════════════════════════════╗
║  Influx grow — fastest channel collection
║  ${args.loop ? "MODE: infinite loop (Ctrl+C to stop)" : "MODE: single cycle"}
║  enrich-limit=${args.enrichLimit}  quota-floor=${args.quotaFloor}
╚══════════════════════════════════════════════════╝
`);

  const history = loadSeedHistory();
  saveSeedHistory(history);
  if (history.used_urls.length > 0) {
    console.log(
      `Seed history: ${history.used_urls.length} unique roundup URLs already used`
    );
  }

  if (args.promptOnly) {
    const path = writePromptFile(buildSeedRefreshPrompt(seedPath));
    console.log(readFileSync(path, "utf8"));
    console.log(`\nSaved to ${path}`);
    return;
  }

  let cycle = 0;
  do {
    if (stopping) break;
    cycle++;
    console.log(`\n████ GROW CYCLE ${cycle} ${new Date().toLocaleString()} ████`);

    const needFreshSeeds =
      seedsNeedRefresh() ||
      cycle > 1 ||
      currentSeedListsAllUsed(seedPath);

    if (!args.enrichOnly && needFreshSeeds) {
      console.log("\n🔄 Loading next unused seed batch from seed-bank.json…");
      try {
        let result = autoRefreshSeedLists({ limit: 20 });
        if (result.added === 0) {
          console.log(
            "\n🌱 Seed bank empty — auto-refilling with NEW (never-used) roundup URLs…"
          );
          const refill = await refillSeedBankAuto({
            maxValidate: 35,
            allowRecycle: args.allowRecycle,
          });
          if (refill.added === 0 && refill.recycled === 0) {
            console.log(
              "   No new unique URLs available — sleeping 60s then retry (Ctrl+C to stop)."
            );
            console.log(
              "   Tip: add URLs to data/seed-bank.json, or run with --allow-recycle"
            );
            await sleep(60_000);
            continue;
          }
          result = autoRefreshSeedLists({ limit: 20 });
        }
        console.log(
          `   batch: ${result.added} unique URLs (${result.remaining} unused left in bank)`
        );
        if (result.added === 0) {
          console.log("   Still empty after refill — sleeping…");
          await sleep(args.quotaSleepSec * 1000);
          continue;
        }
      } catch (err) {
        console.warn(
          "   seed refresh failed:",
          err instanceof Error ? err.message : err
        );
      }
    }

    const status = await runOneCycle(args);

    if (!args.loop) {
      if (status === "fail") process.exit(1);
      break;
    }

    if (stopping) break;

    if (status === "quota") {
      console.log(
        `\n⏳ Quota floor / empty — sleeping ${args.quotaSleepSec}s (Ctrl+C to stop). Will keep importing seeds on wake.`
      );
      await sleep(args.quotaSleepSec * 1000);
      continue;
    }

    if (status === "fail") {
      console.log(`\n⏳ Import failed — retry in ${args.loopSleepSec}s…`);
      await sleep(args.loopSleepSec * 1000);
      continue;
    }

    console.log(
      `\n⏳ Next cycle in ${args.loopSleepSec}s (Ctrl+C to stop)…`
    );
    await sleep(args.loopSleepSec * 1000);
  } while (args.loop && !stopping);

  console.log("\nGrow stopped.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
