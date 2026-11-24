import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'crypto';
import { sessionGrantsAccess, verifyStripeSignature } from '../src/lib/stripe';

const SECRET = 'whsec_test';
const body = '{"type":"checkout.session.completed"}';
const sign = (t: number, payload = body, secret = SECRET) =>
  `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')}`;

test('accepts a correctly signed, fresh webhook', () => {
  const now = 1_800_000_000;
  assert.equal(verifyStripeSignature(body, sign(now), SECRET, now), true);
});

test('rejects forged, tampered, stale, or missing signatures', () => {
  const now = 1_800_000_000;
  assert.equal(verifyStripeSignature(body, sign(now, body, 'whsec_wrong'), SECRET, now), false);
  assert.equal(verifyStripeSignature(body + ' ', sign(now), SECRET, now), false);
  assert.equal(verifyStripeSignature(body, sign(now - 3600), SECRET, now), false);
  assert.equal(verifyStripeSignature(body, null, SECRET, now), false);
  assert.equal(verifyStripeSignature(body, 't=1,v1=zz', SECRET, now), false);
});

test('session grants access only when paid, complete, and owned by the user', () => {
  const paid = { id: 'cs_1', status: 'complete', payment_status: 'paid', client_reference_id: 'u1' };
  assert.equal(sessionGrantsAccess(paid, 'u1'), true);
  assert.equal(sessionGrantsAccess(paid, 'u2'), false);
  assert.equal(sessionGrantsAccess({ ...paid, payment_status: 'unpaid' }, 'u1'), false);
  assert.equal(sessionGrantsAccess({ ...paid, status: 'open' }, 'u1'), false);
});
