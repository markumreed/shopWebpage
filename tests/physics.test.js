// tests/physics.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { distance, stepBey } from "../js/physics.js";

const STADIUM = { cx: 0, cy: 0, r: 100 };
const PARAMS = { dt: 1, friction: 0.1, spinDecay: 1, centering: 0.05 };

function bey(overrides = {}) {
  return {
    x: 0, y: 0, vx: 0, vy: 0,
    spin: 100, radius: 10, mass: 1, alive: true, name: "test",
    ...overrides
  };
}

test("distance computes Euclidean distance", () => {
  assert.equal(distance(0, 0, 3, 4), 5);
});

test("stepBey decreases spin by spinDecay*dt", () => {
  const next = stepBey(bey({ spin: 100 }), STADIUM, PARAMS);
  assert.equal(next.spin, 99);
});

test("stepBey marks a bey dead when spin reaches 0 (spin-out)", () => {
  const next = stepBey(bey({ spin: 1 }), STADIUM, PARAMS);
  assert.equal(next.spin, 0);
  assert.equal(next.alive, false);
});

test("stepBey marks a bey dead when it leaves the bowl (ring-out)", () => {
  // far outside, moving further out so centering can't save it this step
  const next = stepBey(bey({ x: 200, y: 0, vx: 50 }), STADIUM, PARAMS);
  assert.equal(next.alive, false);
});

test("stepBey does not mutate the input bey", () => {
  const b = bey();
  stepBey(b, STADIUM, PARAMS);
  assert.equal(b.spin, 100);
  assert.equal(b.alive, true);
});

test("stepBey leaves a dead bey unchanged", () => {
  const dead = bey({ alive: false, spin: 0 });
  const next = stepBey(dead, STADIUM, PARAMS);
  assert.deepEqual(next, dead);
});

import { resolveCollision } from "../js/physics.js";

const COLL = { restitution: 1, collisionSpinDrain: 5 };

test("resolveCollision leaves non-overlapping beys unchanged", () => {
  const a = bey({ x: -50, y: 0 });
  const b = bey({ x: 50, y: 0 });
  const [a2, b2] = resolveCollision(a, b, COLL);
  assert.deepEqual([a2, b2], [a, b]);
});

test("resolveCollision separates overlapping beys", () => {
  const a = bey({ x: -5, y: 0 }); // radius 10 each => overlapping (dist 10 < 20)
  const b = bey({ x: 5, y: 0 });
  const [a2, b2] = resolveCollision(a, b, COLL);
  assert.ok(distance(a2.x, a2.y, b2.x, b2.y) >= a.radius + b.radius - 1e-6);
});

test("resolveCollision reverses approach velocity along the normal", () => {
  const a = bey({ x: -5, y: 0, vx: 10 });  // moving right, toward b
  const b = bey({ x: 5, y: 0, vx: -10 });  // moving left, toward a
  const [a2, b2] = resolveCollision(a, b, COLL);
  assert.ok(a2.vx < 0, "a should be pushed left after impact");
  assert.ok(b2.vx > 0, "b should be pushed right after impact");
});

test("resolveCollision drains spin from both on contact", () => {
  const a = bey({ x: -5, y: 0, spin: 50 });
  const b = bey({ x: 5, y: 0, spin: 50 });
  const [a2, b2] = resolveCollision(a, b, COLL);
  assert.equal(a2.spin, 45);
  assert.equal(b2.spin, 45);
});

import { decideOutcome } from "../js/physics.js";

test("decideOutcome returns null while both are alive", () => {
  assert.equal(decideOutcome(bey({ alive: true }), bey({ alive: true })), null);
});

test("decideOutcome returns 'player' when only opponent is dead", () => {
  assert.equal(decideOutcome(bey({ alive: true }), bey({ alive: false })), "player");
});

test("decideOutcome returns 'opponent' when only player is dead", () => {
  assert.equal(decideOutcome(bey({ alive: false }), bey({ alive: true })), "opponent");
});

test("decideOutcome returns 'draw' when both are dead", () => {
  assert.equal(decideOutcome(bey({ alive: false }), bey({ alive: false })), "draw");
});
