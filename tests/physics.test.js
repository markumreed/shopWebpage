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

test("resolveCollision: a bey with special drains extra spin from the other", () => {
  const a = bey({ x: -5, y: 0, spin: 50, special: true });
  const b = bey({ x: 5, y: 0, spin: 50 });
  const [a2, b2] = resolveCollision(a, b, { restitution: 1, collisionSpinDrain: 5, superDrain: 20 });
  assert.equal(a2.spin, 45);        // attacker loses only the normal drain
  assert.equal(b2.spin, 25);        // defender loses normal drain + superDrain
  assert.equal(a2.special, false);  // special is one-shot: flag is consumed
  assert.ok(!b2.special, "defender should not gain special flag");
});

test("resolveCollision: superDrain is ignored when no bey has special", () => {
  const a = bey({ x: -5, y: 0, spin: 50 });
  const b = bey({ x: 5, y: 0, spin: 50 });
  const [a2, b2] = resolveCollision(a, b, { restitution: 1, collisionSpinDrain: 5, superDrain: 20 });
  assert.equal(a2.spin, 45);
  assert.equal(b2.spin, 45);
});

test("resolveCollision: superDrain cannot push spin below 0", () => {
  const a = bey({ x: -5, y: 0, spin: 50, special: true });
  const b = bey({ x: 5, y: 0, spin: 3 });
  const [, b2] = resolveCollision(a, b, { restitution: 1, collisionSpinDrain: 5, superDrain: 20 });
  assert.equal(b2.spin, 0);
});

test("resolveCollision: both beys with special drain each other and both flags clear", () => {
  const a = bey({ x: -5, y: 0, spin: 50, special: true });
  const b = bey({ x: 5, y: 0, spin: 50, special: true });
  const [a2, b2] = resolveCollision(a, b, { restitution: 1, collisionSpinDrain: 5, superDrain: 20 });
  assert.equal(a2.spin, 25);        // normal drain + superDrain from b's special
  assert.equal(b2.spin, 25);        // normal drain + superDrain from a's special
  assert.equal(a2.special, false);
  assert.equal(b2.special, false);
});

test("resolveCollision: opposite spin directions drain more (spin-steal)", () => {
  const a = bey({ x: -5, y: 0, spin: 50, dir: 1 });
  const b = bey({ x: 5, y: 0, spin: 50, dir: -1 });
  const params = { restitution: 1, collisionSpinDrain: 5, oppositeSpinMult: 2, sameSpinMult: 0.5 };
  const [a2, b2] = resolveCollision(a, b, params);
  assert.equal(a2.spin, 40); // 5 * 2 = 10 drained
  assert.equal(b2.spin, 40);
});

test("resolveCollision: same spin directions drain less", () => {
  const a = bey({ x: -5, y: 0, spin: 50, dir: 1 });
  const b = bey({ x: 5, y: 0, spin: 50, dir: 1 });
  const params = { restitution: 1, collisionSpinDrain: 5, oppositeSpinMult: 2, sameSpinMult: 0.5 };
  const [a2, b2] = resolveCollision(a, b, params);
  assert.equal(a2.spin, 47.5); // 5 * 0.5 = 2.5 drained
  assert.equal(b2.spin, 47.5);
});

test("resolveCollision: beys without a dir field default to same-spin (mult 1)", () => {
  const a = bey({ x: -5, y: 0, spin: 50 });
  const b = bey({ x: 5, y: 0, spin: 50 });
  const [a2, b2] = resolveCollision(a, b, { restitution: 1, collisionSpinDrain: 5 });
  assert.equal(a2.spin, 45); // unchanged legacy behavior
  assert.equal(b2.spin, 45);
});

import { aiSteer } from "../js/physics.js";

test("aiSteer returns zero when either bey is dead", () => {
  const ai = bey({ x: 50, y: 0 });
  const p = bey({ x: -50, y: 0 });
  assert.deepEqual(aiSteer(ai, { ...p, alive: false }, STADIUM), { ax: 0, ay: 0 });
  assert.deepEqual(aiSteer({ ...ai, alive: false }, p, STADIUM), { ax: 0, ay: 0 });
});

test("aiSteer seeks the player when it holds a spin advantage", () => {
  const ai = bey({ x: 50, y: 0, spin: 90 });
  const p = bey({ x: -50, y: 0, spin: 50 });
  const { ax } = aiSteer(ai, p, STADIUM, 1);
  assert.ok(ax < 0, "AI should steer toward the player (negative x)");
});

test("aiSteer retreats toward center when far behind on spin", () => {
  const ai = bey({ x: 60, y: 0, spin: 10 });
  const p = bey({ x: -50, y: 0, spin: 90 });
  const { ax } = aiSteer(ai, p, STADIUM, 1);
  assert.ok(ax < 0, "AI should steer back toward center (negative x from +x)");
});

test("aiSteer pushes inward hard near the rim (edge fear)", () => {
  const ai = bey({ x: 95, y: 0, spin: 100 });
  const p = bey({ x: 96, y: 0, spin: 100 }); // player would lure AI out of the ring
  const { ax } = aiSteer(ai, p, STADIUM, 1);
  assert.ok(ax < 0, "AI near the +x rim should be pushed back toward center");
});

test("aiSteer scales with aggression", () => {
  const ai = bey({ x: 50, y: 0, spin: 90 });
  const p = bey({ x: -50, y: 0, spin: 50 });
  const soft = aiSteer(ai, p, STADIUM, 0.5);
  const hard = aiSteer(ai, p, STADIUM, 1);
  assert.ok(Math.abs(hard.ax) > Math.abs(soft.ax), "higher aggression steers harder");
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

import { tryXtremeDash } from "../js/physics.js";

const RAIL_T = { inner: 60, outer: 70, cooldown: 40 };
const GEAR_T = { dashImpulse: 8, engageSpeed: 3, spinCost: 4 };

test("tryXtremeDash fires inside the rail band when fast enough", () => {
  // on the band (dist 65 from center 0,0), moving +x at speed 5 >= 3
  const b = bey({ x: 65, y: 0, vx: 5, vy: 0, spin: 100, dashCd: 0 });
  const { bey: next, fired } = tryXtremeDash(b, STADIUM, RAIL_T, GEAR_T);
  assert.equal(fired, true);
  assert.equal(next.vx, 13);             // 5 + unit(1)*8
  assert.equal(next.spin, 96);           // 100 - spinCost 4
  assert.equal(next.dashCd, 40);         // cooldown set from rail
});

test("tryXtremeDash impulse follows a diagonal heading on both axes", () => {
  // moving at 4,3 => speed 5 >= engage 3; impulse 8 split along the unit heading
  const b = bey({ x: 65, y: 0, vx: 4, vy: 3, spin: 100, dashCd: 0 });
  const { bey: next, fired } = tryXtremeDash(b, STADIUM, RAIL_T, GEAR_T);
  assert.equal(fired, true);
  assert.equal(next.vx, 4 + (4 / 5) * 8); // 10.4
  assert.equal(next.vy, 3 + (3 / 5) * 8); // 7.8
});

test("tryXtremeDash does not fire below the engage speed", () => {
  const b = bey({ x: 65, y: 0, vx: 1, vy: 0, dashCd: 0 });
  const { fired } = tryXtremeDash(b, STADIUM, RAIL_T, GEAR_T);
  assert.equal(fired, false);
});

test("tryXtremeDash does not fire outside the rail band", () => {
  const inside = bey({ x: 10, y: 0, vx: 5, vy: 0, dashCd: 0 }); // dist 10 < inner 60
  const outside = bey({ x: 90, y: 0, vx: 5, vy: 0, dashCd: 0 }); // dist 90 > outer 70
  assert.equal(tryXtremeDash(inside, STADIUM, RAIL_T, GEAR_T).fired, false);
  assert.equal(tryXtremeDash(outside, STADIUM, RAIL_T, GEAR_T).fired, false);
});

test("tryXtremeDash does not fire while on cooldown", () => {
  const b = bey({ x: 65, y: 0, vx: 5, vy: 0, dashCd: 12 });
  assert.equal(tryXtremeDash(b, STADIUM, RAIL_T, GEAR_T).fired, false);
});

test("tryXtremeDash does not fire for a dead bey", () => {
  const b = bey({ x: 65, y: 0, vx: 5, vy: 0, alive: false, dashCd: 0 });
  assert.equal(tryXtremeDash(b, STADIUM, RAIL_T, GEAR_T).fired, false);
});

test("tryXtremeDash does not mutate the input bey", () => {
  const b = bey({ x: 65, y: 0, vx: 5, vy: 0, spin: 100, dashCd: 0 });
  tryXtremeDash(b, STADIUM, RAIL_T, GEAR_T);
  assert.equal(b.vx, 5);
  assert.equal(b.spin, 100);
  assert.equal(b.dashCd, 0);
});
