#!/usr/bin/env tsx
/**
 * CLI contribute loop (same engine as Electron) via HTTP claim APIs.
 *
 *   INFLUX_WORKER_KEY=iw_… YOUTUBE_API_KEY=… npm run contribute:loop
 */

import { loadEnv } from "./lib/env";
loadEnv();

// Reuse Electron engine via createRequire for CommonJS module
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { ContributeEngine } = require("../contributor-app/engine/contribute.js");

async function main() {
  const loop = process.argv.includes("--loop");
  const apiUrl =
    process.env.INFLUX_API_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://influencer-platform-mu.vercel.app";
  const workerKey =
    process.env.INFLUX_WORKER_KEY || process.env.WORKER_SUBMIT_TOKEN || "";
  const youtubeKey = process.env.YOUTUBE_API_KEY || "";

  if (!workerKey) {
    console.error("Set INFLUX_WORKER_KEY=iw_…");
    process.exit(1);
  }

  const engine = new ContributeEngine({
    apiUrl,
    workerKey,
    youtubeKey,
    onLog: (m: string) => console.log(m),
    onStats: (s: Record<string, number>) => {
      if (s.cycles) {
        /* quiet */
      }
    },
  });

  process.on("SIGINT", () => {
    console.log("\nStopping…");
    engine.stop();
  });

  if (loop) {
    await engine.runLoop({ sleepSec: 25 });
  } else {
    await engine.runOneCycle();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
