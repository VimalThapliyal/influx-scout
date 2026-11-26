import { test } from "node:test";
import assert from "node:assert/strict";
import { passesMicroBar, scoreChannelQuality, type RecentVideoSnapshot } from "../src/lib/quality-gate";

function videos(views: number, likeRate: number): RecentVideoSnapshot[] {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `v${i}`,
    title: `Video ${i}`,
    view_count: views,
    like_count: Math.round(views * likeRate),
    comment_count: 0,
    published_at: new Date(Date.now() - (i + 1) * 3 * 86_400_000).toISOString(),
  }));
}
const score = (subs: number, views: number, eng: number) =>
  scoreChannelQuality({ videos: videos(views, eng), country: "US", subscriberCount: subs });

test("small creators pass on 1,500+ views with 3%+ engagement", () => {
  assert.equal(score(20_000, 2_000, 0.04).quality_pass, true);
  assert.equal(score(20_000, 1_500, 0.03).quality_pass, true);
});

test("small creators still need the engagement or the views", () => {
  assert.deepEqual(score(20_000, 2_000, 0.025).quality_fail_reasons, ["avg_views_low"]);
  assert.deepEqual(score(20_000, 1_200, 0.06).quality_fail_reasons, ["avg_views_low"]);
});

test("the small-creator bar needs a known country", () => {
  const noCountry = scoreChannelQuality({ videos: videos(2_000, 0.04), country: null, subscriberCount: 20_000 });
  assert.deepEqual(noCountry.quality_fail_reasons, ["avg_views_low"]);
});

test("the standard bar is unchanged", () => {
  // Small channel that already cleared 5,000 views at 2% keeps passing.
  assert.equal(score(20_000, 6_000, 0.021).quality_pass, true);
  // Larger channels do not get the lower floor.
  assert.deepEqual(score(80_000, 2_000, 0.05).quality_fail_reasons, ["avg_views_low"]);
  assert.equal(score(80_000, 6_000, 0.03).quality_pass, true);
  assert.equal(passesMicroBar(50_000, 3_000, 0.05), false);
  assert.equal(passesMicroBar(null, 3_000, 0.05), false);
});
