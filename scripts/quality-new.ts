#!/usr/bin/env tsx
/**
 * Run 2 — add NEW creators, then quality-score them into the library.
 *
 * Flow (same quality gate as quality:db):
 *   1. Stream TubeCensus UC ids online → channel_seed   (0 YouTube quota)
 *   2. Validate seeds → upsert into channels             (cheap channels.list)
 *   3. Score unscored channels (includes the new ones)  (~1.1 units each)
 *
 *   npm run quality:new
 *   npm run quality:new -- --seed-limit 30000 --validate-units 1200 --score-units 5000
 *   npm run quality:new -- --skip-stream   # only validate existing seeds + score
 */
import { spawnSync } from "child_process";
import { resolve } from "path";

function parseArgs(argv: string[]) {
  let seedLimit = 60000;
  let validateLimit = 60000;
  let validateUnits = 1500;
  let scoreLimit = 4500;
  let scoreUnits = 5500;
  let skipStream = false;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--seed-limit" && argv[i + 1])
      seedLimit = Math.max(1000, parseInt(argv[++i]!, 10) || 60000);
    else if (a === "--validate-limit" && argv[i + 1])
      validateLimit = Math.max(100, parseInt(argv[++i]!, 10) || 60000);
    else if (a === "--validate-units" && argv[i + 1])
      validateUnits = Math.max(50, parseInt(argv[++i]!, 10) || 1500);
    else if (a === "--score-limit" && argv[i + 1])
      scoreLimit = Math.max(50, parseInt(argv[++i]!, 10) || 4500);
    else if (a === "--score-units" && argv[i + 1])
      scoreUnits = Math.max(50, parseInt(argv[++i]!, 10) || 5500);
    else if (a === "--skip-stream") skipStream = true;
    else if (a === "--dry-run") dryRun = true;
  }
  return {
    seedLimit,
    validateLimit,
    validateUnits,
    scoreLimit,
    scoreUnits,
    skipStream,
    dryRun,
  };
}

function run(label: string, script: string, args: string[]): boolean {
  console.log(`\n======= ${label} =======`);
  const r = spawnSync(
    "npx",
    ["tsx", resolve(process.cwd(), "scripts", script), ...args],
    { stdio: "inherit", env: process.env }
  );
  if (r.status !== 0) {
    console.error(`\n${label} failed (exit ${r.status ?? "?"}). Stopping.`);
    return false;
  }
  return true;
}

function main() {
  const a = parseArgs(process.argv.slice(2));

  console.log("quality:new — stream → validate → score");
  console.log(
    `  seeds=${a.seedLimit}  validate≤${a.validateUnits}u  score≤${a.scoreUnits}u`
  );

  if (!a.skipStream) {
    const streamArgs = [`--limit`, String(a.seedLimit)];
    if (a.dryRun) streamArgs.push("--dry-run");
    if (!run("1/3 Stream TubeCensus IDs", "stream-tubecensus.ts", streamArgs)) {
      process.exit(1);
    }
  } else {
    console.log("\n======= 1/3 Stream skipped =======");
  }

  const validateArgs = [
    "--limit",
    String(a.validateLimit),
    "--max-units",
    String(a.validateUnits),
    "--formats",
    "channel",
  ];
  if (a.dryRun) validateArgs.push("--dry-run");
  if (
    !run("2/3 Validate into channels", "validate-seed.ts", validateArgs)
  ) {
    process.exit(1);
  }

  const scoreArgs = [
    "--all-countries",
    "--limit",
    String(a.scoreLimit),
    "--max-units",
    String(a.scoreUnits),
  ];
  if (a.dryRun) scoreArgs.push("--dry-run");
  if (!run("3/3 Quality score", "score-quality.ts", scoreArgs)) {
    process.exit(1);
  }

  console.log("\nquality:new done.");
  console.log("  Passes → quality_pass=true in channels (app filter).");
  console.log("  Fails  → stay in DB with fail reasons (not deleted).");
}

main();
