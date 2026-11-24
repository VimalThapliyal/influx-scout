import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyNiche } from '../src/lib/classify';

test('niche phrases match whole words, not substrings', () => {
  // "cat" inside education/vacation/location, "pet" inside competition, "tech" inside technique
  const r = classifyNiche({ title: 'Study Hub', description: 'education vacation location competition technique' });
  assert.notEqual(r.primary_niche, 'pets');
  assert.notEqual(r.primary_niche, 'tech');
});

test('plurals and real mentions still match', () => {
  assert.equal(classifyNiche({ title: 'Cats of Brooklyn', description: 'daily cat videos' }).primary_niche, 'pets');
  assert.equal(classifyNiche({ title: 'Home Workout Daily', description: '' }).primary_niche, 'fitness');
  assert.equal(classifyNiche({ title: "Let's Play Minecraft", description: '' }).primary_niche, 'gaming');
});
