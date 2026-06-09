// tests/points.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { pointsForRound, canAfford, spend, loadPoints } from "../js/points.js";

test("pointsForRound: winning the round only = 1", () => {
  assert.equal(pointsForRound(true, false), 1);
});

test("pointsForRound: winning the round AND the match = 4", () => {
  assert.equal(pointsForRound(true, true), 4);
});

test("pointsForRound: losing the round = 0", () => {
  assert.equal(pointsForRound(false, false), 0);
});

test("pointsForRound: match flag without round win = 3 (bonus only)", () => {
  assert.equal(pointsForRound(false, true), 3);
});

test("canAfford: exact balance is affordable", () => {
  assert.equal(canAfford(3, 3), true);
});

test("canAfford: short balance is not affordable", () => {
  assert.equal(canAfford(2, 3), false);
});

test("spend: deducts the cost when affordable", () => {
  assert.equal(spend(5, 3), 2);
});

test("spend: no-op when short (never goes negative)", () => {
  assert.equal(spend(2, 3), 2);
});

test("loadPoints: defaults to 0 when localStorage is unavailable", () => {
  assert.equal(loadPoints(), 0);
});
