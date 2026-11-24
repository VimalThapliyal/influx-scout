#!/usr/bin/env tsx
/** Download a bounded byte range and keep the discovery cursor in private storage.
 * Checkpoint after each successful insert; duplicate IDs never replace seed history.
 * npm run census:stream -- --limit 60000
 * npm run census:stream -- --limit 100 --offset 0 --dry-run
 */
import { loadEnv } from './lib/env';
loadEnv();
import { createClient } from '@supabase/supabase-js';
import { fetchCensusIds, CENSUS_URLS } from './lib/census-source';

const argv = process.argv.slice(2);
function numberArg(name: string, fallback: number) {
  const i = argv.indexOf(name);
  if (i < 0) return fallback;
  const value = Number(argv[i + 1]);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${name}`);
  return value;
}
const BUCKET = 'discovery-state';
const KEY = 'tubecensus-cursor.json';

async function main() {
  const dry = argv.includes('--dry-run');
  const limit = numberArg('--limit', 60000);
  let offset = numberArg('--offset', -1);
  const urlIndex = argv.indexOf('--url');
  const urls = urlIndex < 0 ? CENSUS_URLS : [argv[urlIndex + 1]];
  if (!limit || limit > 150000) throw new Error('--limit must be 1..150000');
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  if (!dry) {
    const { data: bucket, error } = await db.storage.getBucket(BUCKET);
    if (!bucket) {
      if (error && !/not found/i.test(error.message)) throw error;
      const created = await db.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 4096 });
      if (created.error) throw created.error;
    }
    if (offset < 0) {
      const { data, error } = await db.storage.from(BUCKET).download(KEY);
      if (error && !/not found/i.test(error.message)) throw error;
      offset = data ? JSON.parse(await data.text()).nextOffset : 0;
    }
  }
  if (offset < 0) offset = 0;
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid saved discovery cursor');
  console.log(`[census:stream] fetching ${limit} IDs from line ${offset}`);
  const ids = await fetchCensusIds(offset, limit, urls);
  if (dry) {
    console.log(`DRY RUN: ${ids.length} valid IDs; no database or checkpoint writes`);
    return;
  }
  let inserted = 0;
  for (let i = 0; i < ids.length; i += 1000) {
    const batch = ids.slice(i, i + 1000).map(id => ({
      seed_key: `channel:${id}`, channel_id: id, id_format: 'channel',
      source: 'tubecensus-stream', status: 'new',
    }));
    const { data, error } = await db.from('channel_seed')
      .upsert(batch, { onConflict: 'seed_key', ignoreDuplicates: true }).select('seed_key');
    if (error) throw error;
    inserted += data?.length ?? 0;
    const saved = await db.storage.from(BUCKET).upload(KEY,
      JSON.stringify({ nextOffset: offset + i + batch.length, updated_at: new Date().toISOString() }),
      { upsert: true, contentType: 'application/json' });
    if (saved.error) throw saved.error;
  }
  console.log(`New seeds: ${inserted}; already saved: ${ids.length - inserted}; next offset: ${offset + ids.length}`);
}
main().catch(error => { console.error(error); process.exit(1); });
