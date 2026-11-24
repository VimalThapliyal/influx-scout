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

test('podcast and self-improvement niches', () => {
  assert.equal(classifyNiche({ title: 'The Daily Talk Podcast', description: 'new full episodes every week' }).primary_niche, 'podcast');
  assert.equal(
    classifyNiche({ title: 'Jay Shetty Podcast', description: 'Self improvement, mental health, mindset and relationship advice' }).primary_niche,
    'self-improvement'
  );
  // strong topic beats podcast format
  assert.equal(classifyNiche({ title: 'Gaming Podcast', description: "let's play gameplay esports" }).primary_niche, 'gaming');
});

test('music and sports niches', () => {
  assert.equal(classifyNiche({ title: 'Justin Bieber', description: 'DOTTED LINE (Official Music Video) world tour' }).primary_niche, 'music');
  assert.equal(classifyNiche({ title: 'Bo Nix (QB, Broncos)', description: 'NFL quarterback highlights' }).primary_niche, 'sports');
  assert.equal(classifyNiche({ title: 'GUESS THE F1 DRIVER', description: 'formula 1 racing' }).primary_niche, 'sports');
  // "music" no longer counts toward entertainment
  assert.equal(classifyNiche({ title: 'Chill Beats', description: 'music for studying' }).primary_niche, 'music');
});
