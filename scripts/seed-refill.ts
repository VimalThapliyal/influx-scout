#!/usr/bin/env tsx
/** Manual: npm run seed:refill */
import { loadEnv } from "./lib/env";
loadEnv();
import { refillSeedBankAuto, bankRemaining } from "./lib/auto-refresh-seeds";

async function main() {
  console.log(`Unused in bank before: ${bankRemaining()}`);
  const r = await refillSeedBankAuto({ maxValidate: 40 });
  console.log(r);
  console.log(`Unused in bank after: ${bankRemaining()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
