#!/usr/bin/env tsx
/**
 * TubeCensus seed importer — ZERO YouTube API quota.
 *
 * Streams a local TubeCensus (or any) file of channel identifiers, normalises
 * every /channel/, /user/, /c/ and /@handle token, deduplicates, and bulk-inserts
 * them into the `channel_seed` pool. Later, `npm run census:validate` promotes the
 * canonical UC ids into `channels` via cheap batched channels.list calls.
 *
 * Download TubeCensus from Zenodo first (https://zenodo.org/records/… — ~16 GB),
 * then point --file at any CSV/TSV/TXT (optionally .gz). The file can hold full
 * URLs, bare paths, bare UC ids, or @handles — one per line or inside a column.
 *
 *   npm run census:import -- --file ./data/tubecensus.csv
 *   npm run census:import -- --file ./data/ids.txt.gz --limit 500000
 *   npm run census:import -- --file ./data/tubecensus.csv --column channel_url
 *   npm run census:import -- --file ./data/tubecensus.csv --formats channel,handle
 *   npm run census:import -- --file ./data/tubecensus.csv --dry-run
 */
import { createReadStream, existsSync } from "fs";
import { createInterface } from "readline";
import { createGunzip } from "zlib";
import { resolve } from "path";
import { loadEnv } from "./lib/env";
loadEnv();

import { createClient } from "@supabase/supabase-js";
import {
  normaliseIdentifier,
  type SeedFormat,
  type SeedIdentifier,
} from "./lib/tubecensus";

const ALL_FORMATS: SeedFormat[] = ["channel", "handle", "user", "custom"];

interface Args {
  file: string;
  column: string | null;
  delimiter: string | null;
  limit: number;
  offset: number;
  batchSize: number;
  formats: Set<SeedFormat>;
  source: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  let file = "";
  let column: string | null = null;
  let delimiter: string | null = null;
  let limit = Infinity;
  let offset = 0;
  let batchSize = 1000;
  let formats = new Set<SeedFormat>(ALL_FORMATS);
  let source = "tubecensus";
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file" && argv[i + 1]) file = argv[++i]!;
    else if (a === "--column" && argv[i + 1]) column = argv[++i]!;
    else if (a === "--delimiter" && argv[i + 1]) delimiter = argv[++i]!;
    else if (a === "--limit" && argv[i + 1])
      limit = Math.max(1, parseInt(argv[++i]!, 10) || Infinity);
    else if (a === "--offset" && argv[i + 1])
      offset = Math.max(0, parseInt(argv[++i]!, 10) || 0);
    else if (a === "--batch-size" && argv[i + 1])
      batchSize = Math.max(100, Math.min(5000, parseInt(argv[++i]!, 10) || 1000));
    else if (a === "--source" && argv[i + 1]) source = argv[++i]!;
    else if (a === "--formats" && argv[i + 1]) {
      formats = new Set(
        argv[++i]!
          .split(",")
          .map((f) => f.trim().toLowerCase())
          .filter((f): f is SeedFormat =>
            (ALL_FORMATS as string[]).includes(f)
          )
      );
    } else if (a === "--dry-run") dryRun = true;
  }

  if (!file) {
    throw new Error(
      "Missing --file. Example: npm run census:import -- --file ./data/tubecensus.csv"
    );
  }
  return { file, column, delimiter, limit, offset, batchSize, formats, source, dryRun };
}

function guessDelimiter(headerLine: string): string {
  if (headerLine.includes("\t")) return "\t";
  const commas = (headerLine.match(/,/g) || []).length;
  const semis = (headerLine.match(/;/g) || []).length;
  if (semis > commas) return ";";
  if (commas > 0) return ",";
  return ""; // single column / plain lines
}

function splitLine(line: string, delimiter: string): string[] {
  if (!delimiter) return [line];
  // Lightweight split honouring simple double-quoting
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delimiter) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function looksLikeIdentifier(v: string): boolean {
  return /youtube\.com|youtu\.be|\/channel\/|\/user\/|\/c\/|\/@|^@|^UC[0-9A-Za-z_-]{22}$/i.test(
    v.trim()
  );
}

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function toRow(seed: SeedIdentifier, source: string) {
  return {
    seed_key: seed.seedKey,
    channel_id: seed.channelId,
    handle: seed.handle,
    username: seed.username,
    custom_url: seed.customUrl,
    id_format: seed.idFormat,
    source,
    status: "new" as const,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const path = resolve(process.cwd(), args.file);
  if (!existsSync(path)) throw new Error(`File not found: ${path}`);

  const supabase = args.dryRun ? null : makeSupabase();

  const isGz = /\.gz$/i.test(path);
  const raw = createReadStream(path);
  const stream = isGz ? raw.pipe(createGunzip()) : raw;
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let header: string[] | null = null;
  let delimiter = args.delimiter ?? "";
  let colIdx = -1;
  let lineNo = 0;
  let scanned = 0;
  let taken = 0;
  let inserted = 0;
  let deduped = 0;
  let skippedFormat = 0;
  let unrecognised = 0;
  const perFormat: Record<SeedFormat, number> = {
    channel: 0,
    handle: 0,
    user: 0,
    custom: 0,
  };

  const seen = new Set<string>();
  let batch: ReturnType<typeof toRow>[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    if (!args.dryRun && supabase) {
      const { error } = await supabase
        .from("channel_seed")
        .upsert(batch, { onConflict: "seed_key", ignoreDuplicates: true });
      if (error) throw new Error(`upsert failed: ${error.message}`);
    }
    inserted += batch.length;
    batch = [];
  };

  for await (const line of rl) {
    lineNo++;
    if (!line || !line.trim()) continue;

    // Detect header/delimiter + identifier column on first non-empty line
    if (header === null && colIdx === -1) {
      if (!delimiter) delimiter = guessDelimiter(line);
      const cols = splitLine(line, delimiter);
      if (args.column) {
        const idx = cols.findIndex(
          (c) => c.trim().toLowerCase() === args.column!.toLowerCase()
        );
        if (idx < 0)
          throw new Error(
            `--column "${args.column}" not found in header: ${cols.join(", ")}`
          );
        header = cols;
        colIdx = idx;
        continue;
      }
      // Auto-detect: if any header-looking column, and none of the cells look
      // like identifiers, treat this line as a header and find the id column.
      const anyId = cols.some(looksLikeIdentifier);
      if (!anyId) {
        header = cols;
        const named = cols.findIndex((c) =>
          /channel|url|id|handle|link|identifier/i.test(c)
        );
        colIdx = named >= 0 ? named : 0;
        continue;
      }
      // No header — data starts on line 1. Pick the column that looks like an id.
      colIdx = cols.findIndex(looksLikeIdentifier);
      if (colIdx < 0) colIdx = 0;
      header = [];
      // fall through to process this first data line
    }

    const cols = splitLine(line, delimiter);
    const cell = (cols[colIdx] ?? cols[0] ?? "").trim();
    if (!cell) continue;

    scanned++;
    if (scanned <= args.offset) continue;
    if (taken >= args.limit) break;

    const seed = normaliseIdentifier(cell);
    if (!seed) {
      unrecognised++;
      continue;
    }
    if (!args.formats.has(seed.idFormat)) {
      skippedFormat++;
      continue;
    }
    if (seen.has(seed.seedKey)) {
      deduped++;
      continue;
    }
    seen.add(seed.seedKey);
    perFormat[seed.idFormat]++;
    taken++;
    batch.push(toRow(seed, args.source));

    if (batch.length >= args.batchSize) {
      await flush();
      if (inserted % 50000 < args.batchSize) {
        console.log(
          `  …${inserted.toLocaleString()} seeds (${taken.toLocaleString()} unique / ${scanned.toLocaleString()} scanned)`
        );
      }
    }
  }
  await flush();

  console.log("\nTubeCensus import summary");
  console.log("-------------------------");
  console.log(`file           ${path}`);
  console.log(`lines read     ${lineNo.toLocaleString()}`);
  console.log(`cells scanned  ${scanned.toLocaleString()}`);
  console.log(`unique kept    ${taken.toLocaleString()}`);
  console.log(`  channel      ${perFormat.channel.toLocaleString()} (validatable @ 1 unit / 50)`);
  console.log(`  handle       ${perFormat.handle.toLocaleString()} (1 unit each)`);
  console.log(`  user         ${perFormat.user.toLocaleString()} (1 unit each)`);
  console.log(`  custom       ${perFormat.custom.toLocaleString()} (needs search.list — expensive)`);
  console.log(`dup skipped    ${deduped.toLocaleString()}`);
  console.log(`format skipped ${skippedFormat.toLocaleString()}`);
  console.log(`unrecognised   ${unrecognised.toLocaleString()}`);
  console.log(
    args.dryRun
      ? `\nDRY RUN — nothing written. Re-run without --dry-run to insert.`
      : `\nInserted/kept ${inserted.toLocaleString()} rows in channel_seed. Next: npm run census:validate`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
