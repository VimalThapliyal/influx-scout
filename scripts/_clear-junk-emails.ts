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
  const junk = [
    "help@newyorker.com",
    "support@cookierun-kingdom.zendesk.com",
    "u003eguidelines@patreon.com",
    "guidelines@patreon.com",
  ];
  for (const email of junk) {
    const { data, error } = await s
      .from("channels")
      .update({ email: null, updated_at: new Date().toISOString() })
      .eq("email", email)
      .select("id, title");
    console.log(email, data?.length || 0, error?.message || "ok");
  }
}
main();
