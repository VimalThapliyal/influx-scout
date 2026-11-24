#!/usr/bin/env tsx
/**
 * Create a contributor worker API key for extension / paste import.
 *
 * Usage:
 *   npm run worker:create -- --name alice
 *   npm run worker:create -- --name bob --label "Chrome extension"
 *
 * Requires: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
 * Run migration 005_contributor_workers.sql in Supabase first.
 */

import { randomBytes, createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/env";

const PREFIX = "iw_";

function parseArgs(argv: string[]) {
  let name = "contributor";
  let label: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--name" && argv[i + 1]) {
      name = argv[++i];
    } else if (argv[i] === "--label" && argv[i + 1]) {
      label = argv[++i];
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log(`
Create contributor worker key

  npm run worker:create -- --name alice
  npm run worker:create -- --name bob --label "Friend laptop"
`);
      process.exit(0);
    }
  }

  return { name, label };
}

async function main() {
  loadEnv();
  const { name, label } = parseArgs(process.argv.slice(2));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const rawKey = `${PREFIX}${randomBytes(24).toString("hex")}`;
  const hash = createHash("sha256").update(rawKey).digest("hex");

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("scrape_workers")
    .insert({
      name,
      label: label ?? name,
      api_key_hash: hash,
      active: true,
    })
    .select("id, name, label, created_at")
    .single();

  if (error) {
    if (error.message.includes("scrape_workers")) {
      console.error(
        "Table scrape_workers missing. Run supabase/migrations/005_contributor_workers.sql"
      );
    }
    throw new Error(error.message);
  }

  console.log("\nContributor worker created\n");
  console.log(`  Name:  ${data.name}`);
  console.log(`  Label: ${data.label}`);
  console.log(`  ID:    ${data.id}`);
  console.log("\n  API key (shown once — copy now):\n");
  console.log(`  ${rawKey}\n`);
  console.log("  Use in extension popup or Import page Authorization header.");
  console.log("  Revoke: set active = false in scrape_workers table.\n");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
