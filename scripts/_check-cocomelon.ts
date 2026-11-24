#!/usr/bin/env tsx
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
  for (const h of ["@cocomelon", "@CoComelon"]) {
    const { data } = await s
      .from("channels")
      .select("id, handle, title, email")
      .eq("handle", h)
      .maybeSingle();
    console.log("exact", h, data);
  }
  const { data: like } = await s
    .from("channels")
    .select("id, handle, title, email")
    .ilike("handle", "%cocomelon%")
    .limit(5);
  console.log("ilike", like);
}
main();
