#!/usr/bin/env tsx
/**
 * List channels that still need a manual YouTube captcha email
 * (no email in DB — YouTube business email is usually captcha-gated).
 *
 *   npm run emails:captcha-queue
 *   npm run emails:captcha-queue -- --limit 200 --csv
 *   npm run emails:captcha-queue -- --no-links   # only rows with no website/IG
 */
import { writeFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

function parseArgs(argv: string[]) {
  const args = {
    limit: 500,
    csv: false,
    noLinks: false,
    minSubs: 0,
    out: "" as string,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit" && argv[i + 1]) args.limit = Math.max(1, parseInt(argv[++i], 10) || 500);
    else if (a === "--csv") args.csv = true;
    else if (a === "--no-links") args.noLinks = true;
    else if (a === "--min-subs" && argv[i + 1])
      args.minSubs = Math.max(0, parseInt(argv[++i], 10) || 0);
    else if (a === "--out" && argv[i + 1]) args.out = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  // Paginate — Supabase caps rows per request
  const pageSize = 1000;
  const all: Array<{
    id: string;
    title: string | null;
    handle: string | null;
    subscriber_count: number | null;
    country: string | null;
    website: string | null;
    instagram: string | null;
  }> = [];

  for (let from = 0; from < 20000; from += pageSize) {
    let q = s
      .from("channels")
      .select(
        "id, title, handle, subscriber_count, country, website, instagram"
      )
      .is("email", null)
      .order("subscriber_count", { ascending: false, nullsFirst: false })
      .range(from, from + pageSize - 1);

    if (args.minSubs > 0) {
      q = q.gte("subscriber_count", args.minSubs);
    }

    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }

  let rows = all;
  if (args.noLinks) {
    rows = rows.filter(
      (r) =>
        (!r.website || r.website === "") &&
        (!r.instagram || r.instagram === "")
    );
  }

  const totalMissing = all.length;
  const sliced = rows.slice(0, args.limit);

  console.log(
    `[captcha-queue] channels with no email: ${totalMissing}` +
      (args.noLinks
        ? ` · no website/IG: ${rows.length}`
        : "") +
      ` · showing ${sliced.length}`
  );
  console.log(
    "(Note: YouTube does not expose a captcha flag — this is the manual About → View email queue.)\n"
  );

  const lines = [
    "rank,title,handle,subscribers,country,has_website,has_instagram,youtube_about_url",
  ];

  sliced.forEach((r, i) => {
    const about = r.handle
      ? `https://www.youtube.com/${r.handle}/about`
      : `https://www.youtube.com/channel/${r.id}/about`;
    const hasWeb = r.website ? "yes" : "no";
    const hasIg = r.instagram ? "yes" : "no";
    console.log(
      `${String(i + 1).padStart(3)}  ${(r.title || "?").slice(0, 40).padEnd(40)}  ${(r.handle || "").padEnd(22)}  ${String(r.subscriber_count ?? "—").padStart(10)}  ${about}`
    );
    const csvSafe = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    lines.push(
      [
        i + 1,
        csvSafe(r.title || ""),
        csvSafe(r.handle || ""),
        r.subscriber_count ?? "",
        csvSafe(r.country || ""),
        hasWeb,
        hasIg,
        csvSafe(about),
      ].join(",")
    );
  });

  if (args.csv || args.out) {
    const outPath =
      args.out ||
      resolve(process.cwd(), "data/captcha-email-queue.csv");
    writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
    console.log(`\nWrote ${outPath}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
