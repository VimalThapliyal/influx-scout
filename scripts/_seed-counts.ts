#!/usr/bin/env tsx
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  for (const st of ["available", "claimed", "done", "failed"]) {
    const { count } = await s
      .from("seed_urls")
      .select("*", { count: "exact", head: true })
      .eq("status", st);
    console.log(st, count);
  }
}

main();
