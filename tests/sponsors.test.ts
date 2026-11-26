import { test } from "node:test";
import assert from "node:assert/strict";
import { detectSponsors } from "../src/lib/sponsors";

test("named sponsors are extracted", () => {
  assert.deepEqual(detectSponsors(["Thanks to AG1 for sponsoring today's video! Trump says"]).sponsors, ["AG1"]);
  assert.deepEqual(detectSponsors(["Thanks to Homebase for sponsoring this video! Managing your team"]).sponsors, ["Homebase"]);
  assert.deepEqual(detectSponsors(["disclaimers this video is sponsored by Nourish this video may contain affiliate links"]).sponsors, ["Nourish"]);
  assert.deepEqual(detectSponsors(["This episode is brought to you by Squarespace. Go to squarespace.com"]).sponsors, ["Squarespace"]);
  assert.deepEqual(detectSponsors(["Thanks to our friends at Factor Meals for sponsoring"]).sponsors, ["Factor Meals"]);
});

test("a disclosure without a brand still counts as sponsored", () => {
  const r = detectSponsors(["#ad I shoved a headset into a helmet"]);
  assert.equal(r.sponsored, true);
  assert.deepEqual(r.sponsors, []);
});

test("negations, affiliate codes and non-brands are ignored", () => {
  assert.equal(detectSponsors(["This video is not sponsored. I bought everything myself."]).sponsored, false);
  assert.equal(detectSponsors(["Use code SAVE10 for 10% off. Affiliate links below."]).sponsored, false);
  assert.deepEqual(detectSponsors(["This channel is sponsored by you, the viewers"]).sponsors, []);
  assert.equal(detectSponsors([null, undefined, ""]).sponsored, false);
});

test("the same brand across videos is listed once", () => {
  assert.deepEqual(detectSponsors(["Sponsored by NordVPN.", "Thanks to NordVPN for sponsoring"]).sponsors, ["NordVPN"]);
});
