// tests/points.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { shopPointsForFinish, canAfford, spend, loadPoints } from "../js/points.js";

test("shopPointsForFinish: a player Over finish awards its value (2)", () =>
  assert.equal(shopPointsForFinish("player", 2, false), 2));

test("shopPointsForFinish: an opponent finish awards the player 0", () =>
  assert.equal(shopPointsForFinish("opponent", 3, false), 0));

test("shopPointsForFinish: a player finish that clinches the match adds the +2 bonus", () =>
  assert.equal(shopPointsForFinish("player", 2, true), 4));

test("shopPointsForFinish: a player Xtreme that wins the match (3 + 2 bonus)", () =>
  assert.equal(shopPointsForFinish("player", 3, true), 5));

test("canAfford: exact balance is affordable", () => assert.equal(canAfford(3, 3), true));
test("canAfford: short balance is not affordable", () => assert.equal(canAfford(2, 3), false));
test("spend: deducts the cost when affordable", () => assert.equal(spend(5, 3), 2));
test("spend: no-op when short (never goes negative)", () => assert.equal(spend(2, 3), 2));
test("loadPoints: defaults to 0 when localStorage is unavailable", () => assert.equal(loadPoints(), 0));
