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
