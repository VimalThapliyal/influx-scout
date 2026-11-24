#!/usr/bin/env tsx
import { loginAndSaveSession } from "./lib/auth";

loginAndSaveSession().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
