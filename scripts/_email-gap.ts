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
  const { count: total } = await s
    .from("channels")
    .select("*", { count: "exact", head: true });
  const { count: withEmail } = await s
    .from("channels")
    .select("*", { count: "exact", head: true })
    .not("email", "is", null)
    .neq("email", "");
  const { count: withIg } = await s
    .from("channels")
    .select("*", { count: "exact", head: true })
    .not("instagram", "is", null)
    .neq("instagram", "");
  const { count: igNoEmail } = await s
    .from("channels")
    .select("*", { count: "exact", head: true })
    .not("instagram", "is", null)
    .neq("instagram", "")
    .is("email", null);
  const { count: withWeb } = await s
    .from("channels")
    .select("*", { count: "exact", head: true })
    .not("website", "is", null)
    .neq("website", "");
  const { count: webNoEmail } = await s
    .from("channels")
    .select("*", { count: "exact", head: true })
    .not("website", "is", null)
    .neq("website", "")
    .is("email", null);
  const { count: descMaybe } = await s
    .from("channels")
    .select("*", { count: "exact", head: true })
    .is("email", null)
    .not("description", "is", null);
  console.log({
    total,
    withEmail,
    missingEmail: (total || 0) - (withEmail || 0),
    withIg,
    igNoEmail,
    withWeb,
    webNoEmail,
    missingWithDescription: descMaybe,
  });
}
main();
