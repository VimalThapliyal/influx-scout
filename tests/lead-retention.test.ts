import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withYoutubeMetricsExpiry, upsertChannelWithMetricsExpiry } from '../src/lib/youtube-metrics';
import { fetchCensusIds } from '../scripts/lib/census-source';

test('refresh keeps saved contacts when API omits them, and still updates metrics', async () => {
  const stored: Record<string, unknown> = { id: 'UC1', email: 'saved@example.com', website: 'https://example.com', subscriber_count: 100, created_at: '2026-01-01' };
  const db = { from: () => ({ upsert: async (patch: Record<string, unknown>) => {
    Object.assign(stored, patch); return { data: null, error: null };
  } }) };
  await upsertChannelWithMetricsExpiry(db, withYoutubeMetricsExpiry({ id: 'UC1', email: null, website: '', subscriber_count: 200 }));
  assert.equal(stored.email, 'saved@example.com');
  assert.equal(stored.website, 'https://example.com');
  assert.equal(stored.subscriber_count, 200);
  assert.equal(stored.created_at, '2026-01-01');
  await upsertChannelWithMetricsExpiry(db, { id: 'UC1', email: 'new@example.com' });
  assert.equal(stored.email, 'new@example.com');
});

test('range discovery resumes exactly at requested record without skipping the boundary', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    assert.equal((init?.headers as Record<string, string>).Range, 'bytes=1500000-1500049');
    return new Response('UCaaaaaaaaaaaaaaaaaaaaaa\nUCbbbbbbbbbbbbbbbbbbbbbb\n', {
      status: 206, headers: { 'content-range': 'bytes 1500000-1500049/2500000' },
    });
  };
  try { assert.equal((await fetchCensusIds(60000, 2)).length, 2); }
  finally { globalThis.fetch = original; }
});
