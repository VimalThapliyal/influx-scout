#!/usr/bin/env tsx
/**
 * Save public emails that are already sitting in channel descriptions we
 * stored, but were never extracted (validate-seed / score-quality don't
 * extract emails). Zero YouTube quota: DB read + DNS MX check only.
 *
 * Only fills rows where email IS NULL. Dry run unless --apply.
 *
 *   npm run emails:from-descriptions                 # dry run, quality-pass only
 *   npm run emails:from-descriptions -- --apply
 *   npm run emails:from-descriptions -- --all        # include non-passing channels
 */

import { loadEnv } from "./lib/env";
loadEnv();

import { createClient } from "@supabase/supabase-js";
import { extractEmailsFromText } from "./lib/link-email";
import { validatePublicEmail } from "./lib/email-validate";

const PAGE = 1000;
const MX_CONCURRENCY = 20;

interface Args {
  apply: boolean;
  all: boolean;
}

function parseArgs(argv: string[]): Args {
  return { apply: argv.includes("--apply"), all: argv.includes("--all") };
}

interface Row {
  id: string;
  title: string | null;
  description: string | null;
}

interface Found {
  id: string;
  patch: Record<string, unknown>;
  label: string;
}

/** Pick the first candidate that passes validation, preferring non-role addresses. */
async function bestEmail(candidates: string[]) {
  const results = [];
  for (const email of candidates.slice(0, 3)) {
    const v = await validatePublicEmail(email, { hasPublicSource: true, checkMx: true });
    if (v.status !== "invalid" && v.normalized) results.push(v);
  }
  return results.find((v) => !v.isRole) ?? results[0] ?? null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  console.log(`[emails:from-descriptions] apply=${args.apply} scope=${args.all ? "all" : "quality_pass"}`);

  // Collect first, then write: updating while paging a `email IS NULL` filter would shift pages.
  const found: Found[] = [];
  let scanned = 0;
  let invalid = 0;
  const byStatus: Record<string, number> = {};

  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from("channels")
      .select("id, title, description")
      .is("email", null)
      .not("description", "is", null)
      .order("id")
      .range(from, from + PAGE - 1);
    if (!args.all) q = q.eq("quality_pass", true);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Row[];
    if (rows.length === 0) break;
    scanned += rows.length;

    const withCandidates = rows
      .map((r) => ({ row: r, emails: extractEmailsFromText(r.description ?? "") }))
      .filter((x) => x.emails.length > 0);

    for (let i = 0; i < withCandidates.length; i += MX_CONCURRENCY) {
      const chunk = withCandidates.slice(i, i + MX_CONCURRENCY);
      const validated = await Promise.all(chunk.map((x) => bestEmail(x.emails)));
      chunk.forEach((x, j) => {
        const v = validated[j];
        if (!v || !v.normalized) {
          invalid++;
          return;
        }
        const now = new Date().toISOString();
        byStatus[v.status] = (byStatus[v.status] ?? 0) + 1;
        found.push({
          id: x.row.id,
          label: `${x.row.title ?? x.row.id}: ${v.normalized} [${v.status}${v.isRole ? ", role" : ""}]`,
          patch: {
            email: v.normalized,
            email_status: "found",
            email_source_type: "description",
            email_source_url: null,
            email_extracted_at: now,
            email_validation_status: v.status,
            email_is_role: v.isRole,
            email_validated_at: now,
            updated_at: now,
          },
        });
      });
    }
    process.stdout.write(`\r  scanned ${scanned}, found ${found.length}`);
  }
  console.log();

  let written = 0;
  if (args.apply) {
    for (const f of found) {
      // Re-check email IS NULL so we never overwrite a contact saved meanwhile.
      const { error, count } = await supabase
        .from("channels")
        .update(f.patch, { count: "exact" })
        .eq("id", f.id)
        .is("email", null);
      if (error) console.warn(`  write failed ${f.id}: ${error.message}`);
      else written += count ?? 0;
    }
  } else {
    found.slice(0, 10).forEach((f) => console.log(`  would save  ${f.label}`));
  }

  console.log(
    `[emails:from-descriptions] scanned=${scanned} found=${found.length} rejected=${invalid} ` +
      `written=${written} byStatus=${JSON.stringify(byStatus)}` +
      (args.apply ? "" : "  (dry run — re-run with --apply to save)")
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
