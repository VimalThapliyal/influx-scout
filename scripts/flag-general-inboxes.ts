#!/usr/bin/env tsx
/**
 * Flag stored emails that are not outreach contacts (customer service, privacy
 * officer, web shop…) as email_validation_status = 'risky'. Nothing is deleted;
 * the site stops counting them as leads. Dry run unless --apply.
 *
 *   npm run emails:flag-general            # report only
 *   npm run emails:flag-general -- --apply
 */
import { loadEnv } from "./lib/env";
loadEnv();

import { createClient } from "@supabase/supabase-js";
import { isNonOutreachAddress } from "./lib/email-validate";

async function main() {
  const apply = process.argv.includes("--apply");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const hits: { id: string; email: string; pass: boolean }[] = [];
  let scanned = 0;
  for (let last = ""; ; ) {
    const { data, error } = await db
      .from("channels")
      .select("id, email, quality_pass, email_validation_status")
      .not("email", "is", null)
      .gt("id", last)
      .order("id")
      .limit(1000);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    last = data[data.length - 1]!.id;
    scanned += data.length;
    for (const r of data) {
      if (r.email_validation_status !== "risky" && isNonOutreachAddress(r.email)) {
        hits.push({ id: r.id, email: r.email, pass: r.quality_pass === true });
      }
    }
  }
  const byLocal = new Map<string, number>();
  for (const h of hits) {
    const k = h.email.split("@")[0]!;
    byLocal.set(k, (byLocal.get(k) ?? 0) + 1);
  }
  console.log(`scanned ${scanned} emails · general inboxes: ${hits.length} (${hits.filter((h) => h.pass).length} on listed creators)`);
  console.log(Array.from(byLocal).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${k}=${v}`).join(" "));
  if (!apply) return console.log("dry run: nothing changed (use --apply)");

  for (let i = 0; i < hits.length; i += 200) {
    const { error } = await db
      .from("channels")
      .update({ email_validation_status: "risky", email_is_role: true })
      .in("id", hits.slice(i, i + 200).map((h) => h.id));
    if (error) throw new Error(error.message);
  }
  console.log(`flagged ${hits.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
