#!/usr/bin/env tsx
/**
 * Backfill public emails + contact forms from creator websites (HTTP only).
 * Provenance + MX validation + form detection (scrape.txt §18–§20).
 * Never submits forms or bypasses CAPTCHA.
 *
 *   npm run enrich:emails -- --prefer-links --limit 100
 */

import { loadEnv } from "./lib/env";
loadEnv();

import { createClient } from "@supabase/supabase-js";
import {
  classifyEmailSourceType,
  enrichContactsFromDescription,
  extractUrlsFromText,
  findEmailFromInstagramProfile,
  findPublicEmailFromWebsite,
  type ContactFormInfo,
} from "./lib/link-email";
import { validatePublicEmail } from "./lib/email-validate";

interface CliArgs {
  limit: number;
  dryRun: boolean;
  offset: number;
  preferLinks: boolean;
  tryInstagram: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    limit: 150,
    dryRun: false,
    offset: 0,
    preferLinks: false,
    tryInstagram: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit" && argv[i + 1]) args.limit = Math.max(1, parseInt(argv[++i], 10) || 150);
    else if (a === "--offset" && argv[i + 1]) args.offset = Math.max(0, parseInt(argv[++i], 10) || 0);
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--prefer-links") args.preferLinks = true;
    else if (a === "--try-instagram") args.tryInstagram = true;
    else if (a === "--help" || a === "-h") {
      console.log(`
Backfill emails + contact forms from websites (HTTP, no CAPTCHA bypass)

  --limit <n>         Max channels without email (default 150)
  --offset <n>        Skip first n
  --prefer-links      Only channels with website or Instagram
  --try-instagram     Also try Instagram (off by default)
  --dry-run
`);
      process.exit(0);
    }
  }
  return args;
}

function applyContactForm(
  patch: Record<string, unknown>,
  form: ContactFormInfo | null | undefined
): boolean {
  if (!form?.found || !form.pageUrl) return false;
  const now = new Date().toISOString();
  patch.has_contact_form = true;
  patch.contact_form_url = form.pageUrl;
  patch.contact_form_purpose = form.purpose;
  patch.contact_form_has_captcha = form.hasCaptcha;
  patch.contact_form_checked_at = now;
  return true;
}

function stripOptionalColumns(patch: Record<string, unknown>) {
  const fallback = { ...patch };
  for (const k of [
    "email_source_url",
    "email_source_type",
    "email_extracted_at",
    "email_validation_status",
    "email_is_role",
    "email_validated_at",
    "has_contact_form",
    "contact_form_url",
    "contact_form_purpose",
    "contact_form_has_captcha",
    "contact_form_checked_at",
    "website_robots_allowed",
    "website_robots_checked_at",
  ]) {
    delete fallback[k];
  }
  return fallback;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  const supabase = createClient(url, key);

  console.log(
    `[enrich:emails] limit=${args.limit} preferLinks=${args.preferLinks} tryIg=${args.tryInstagram} dryRun=${args.dryRun}`
  );

  let query = supabase
    .from("channels")
    .select("id, title, description, website, email, instagram, twitter, tiktok")
    .is("email", null)
    .order("subscriber_count", { ascending: false, nullsFirst: false });

  if (args.preferLinks) {
    query = query.or("website.not.is.null,instagram.not.is.null");
  }

  const { data: rows, error } = await query.range(args.offset, args.offset + args.limit - 1);
  if (error) throw new Error(error.message);
  const channels = rows ?? [];
  console.log(`[enrich:emails] loaded ${channels.length} channels without email`);

  let foundEmail = 0;
  let foundForm = 0;
  let skipped = 0;
  let updatedSocial = 0;
  const sources: Record<string, number> = {};

  for (const ch of channels) {
    const desc = ch.description ?? "";
    const urls = [
      ...extractUrlsFromText(desc),
      ...(ch.website ? [ch.website] : []),
      ...(args.tryInstagram && ch.instagram ? [ch.instagram] : []),
    ];

    if (urls.length === 0 && !ch.website) {
      skipped++;
      continue;
    }

    try {
      const contacts = await enrichContactsFromDescription(desc, {
        existingEmail: null,
        existingWebsite: ch.website,
        fetchLinks: true,
        tryInstagram: args.tryInstagram,
        crawlWebsitePaths: true,
        maxUrls: 6,
      });

      let email = contacts.email;
      let source = contacts.emailSource;
      let sourceType = contacts.emailSourceType;
      let form = contacts.contactForm;
      let robots = contacts.robots;

      // Extra crawl only if enrich path skipped website somehow
      if ((!email || !form?.found) && ch.website && !contacts.urlsTried.length) {
        const fromSite = await findPublicEmailFromWebsite(ch.website, { maxPages: 8 });
        robots = fromSite.robots;
        if (!email && fromSite.email) {
          email = fromSite.email;
          source = fromSite.source;
          sourceType = classifyEmailSourceType(source);
        }
        if (!form?.found && fromSite.contactForm?.found) {
          form = fromSite.contactForm;
        }
      }

      if (!email && args.tryInstagram) {
        const igUrl = ch.instagram || contacts.instagram;
        if (igUrl) {
          const ig = await findEmailFromInstagramProfile(igUrl);
          if (ig.email) {
            email = ig.email;
            source = ig.source;
            sourceType = classifyEmailSourceType(source);
          }
        }
      }

      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      let changed = false;

      if (email) {
        const now = new Date().toISOString();
        const validation = await validatePublicEmail(email, {
          hasPublicSource: true,
          checkMx: true,
        });
        if (validation.status === "invalid" || !validation.normalized) {
          console.log(`  skip invalid ${ch.title}: ${email} (${validation.reason})`);
        } else {
          email = validation.normalized;
          patch.email = email;
          patch.email_status = "found";
          patch.email_source_url = source && source !== "description" ? source : null;
          patch.email_source_type = sourceType ?? classifyEmailSourceType(source);
          patch.email_extracted_at = now;
          patch.email_validation_status = validation.status;
          patch.email_is_role = validation.isRole;
          patch.email_validated_at = now;
          foundEmail++;
          changed = true;
          const key = `${patch.email_source_type}/${validation.status}`;
          sources[key] = (sources[key] || 0) + 1;
          console.log(
            `  email ${ch.title}: ${email} <- ${source} [${patch.email_source_type}] ${validation.status}`
          );
        }
      }

      if (applyContactForm(patch, form)) {
        foundForm++;
        changed = true;
        console.log(
          `  form ${ch.title}: ${form!.pageUrl} (${form!.purpose}${form!.hasCaptcha ? ", captcha" : ""})`
        );
      }

      if (robots) {
        patch.website_robots_allowed = robots.anyAllowed;
        patch.website_robots_checked_at = new Date().toISOString();
        changed = true;
        if (robots.blockedPages > 0) {
          console.log(
            `  robots ${ch.title}: allowed=${robots.allowedPages} blocked=${robots.blockedPages} ok=${robots.robotsOk}`
          );
        }
      }

      if (!ch.website && contacts.website) {
        patch.website = contacts.website;
        changed = true;
        updatedSocial++;
      }
      if (!ch.instagram && contacts.instagram) {
        patch.instagram = contacts.instagram;
        changed = true;
        updatedSocial++;
      }
      if (!ch.twitter && contacts.twitter) {
        patch.twitter = contacts.twitter;
        changed = true;
        updatedSocial++;
      }
      if (!ch.tiktok && contacts.tiktok) {
        patch.tiktok = contacts.tiktok;
        changed = true;
        updatedSocial++;
      }

      if (changed && !args.dryRun) {
        const { error: upErr } = await supabase.from("channels").update(patch).eq("id", ch.id);
        if (upErr) {
          if (
            /email_source|email_validation|email_is_role|contact_form|has_contact_form|website_robots|schema cache/i.test(
              upErr.message
            )
          ) {
            const { error: up2 } = await supabase
              .from("channels")
              .update(stripOptionalColumns(patch))
              .eq("id", ch.id);
            if (up2) {
              console.warn(`  update failed ${ch.id}:`, up2.message);
              if (patch.email) foundEmail--;
              if (patch.has_contact_form) foundForm--;
            } else {
              console.warn(`  updated without new columns — run migrations 011–013`);
            }
          } else {
            console.warn(`  update failed ${ch.id}:`, upErr.message);
            if (patch.email) foundEmail--;
            if (patch.has_contact_form) foundForm--;
          }
        }
      } else if (!changed) {
        skipped++;
      }
    } catch (err) {
      skipped++;
      console.warn(`  skip ${ch.title}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`
[enrich:emails] done
  emails found: ${foundEmail}
  contact forms found: ${foundForm}
  by email source: ${JSON.stringify(sources)}
  social fields filled: ${updatedSocial}
  skipped: ${skipped}
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
