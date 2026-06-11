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

import { cardioidPoint, cardioidTangent, nearestCardioidParam, CARDIOID_MAX_R } from "../js/physics.js";

// shared float comparison for the geometry tests
function approx(actual, expected, eps = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= eps, `got ${actual}, expected ≈ ${expected}`);
}

const GEOM_UNIT = { cx: 0, cy: 0, scale: 1, rot: 0 };

test("cardioidPoint puts the cusp (theta=0) at +0.875*scale from center (rot=0)", () => {
  const p = cardioidPoint(0, GEOM_UNIT);
  approx(p.x, 0.875);
  approx(p.y, 0);
});

test("cardioidPoint puts the far rounded end (theta=PI) opposite the cusp", () => {
  const p = cardioidPoint(Math.PI, GEOM_UNIT);
  approx(p.x, -1.125);
  approx(p.y, 0);
});

test("cardioidPoint stays within CARDIOID_MAX_R of center", () => {
  for (let i = 0; i < 360; i++) {
    const p = cardioidPoint((i / 360) * Math.PI * 2, GEOM_UNIT);
    assert.ok(Math.hypot(p.x, p.y) <= CARDIOID_MAX_R + 1e-6, `point at i=${i} escaped`);
  }
});

test("cardioidTangent returns a unit vector with the expected direction at PI/2", () => {
  const t = cardioidTangent(Math.PI / 2, GEOM_UNIT);
  approx(Math.hypot(t.x, t.y), 1, 1e-9);
  approx(t.x, -Math.SQRT1_2, 1e-9);
  approx(t.y, Math.SQRT1_2, 1e-9);
});

test("cardioidTangent returns a zero vector at the degenerate cusp (theta=0)", () => {
  const t = cardioidTangent(0, GEOM_UNIT);
  assert.equal(t.x, 0);
  assert.equal(t.y, 0);
});

test("cardioidPoint applies scale", () => {
  const p = cardioidPoint(0, { cx: 0, cy: 0, scale: 2, rot: 0 });
  approx(p.x, 0.875 * 2);
  approx(p.y, 0);
});

test("cardioidPoint applies rotation: cusp rotates 90 degrees onto the +y axis", () => {
  const p = cardioidPoint(0, { cx: 0, cy: 0, scale: 1, rot: Math.PI / 2 });
  approx(p.x, 0, 1e-9);
  approx(p.y, 0.875, 1e-9);
});

test("cardioidPoint applies translation", () => {
  const p = cardioidPoint(0, { cx: 10, cy: 20, scale: 1, rot: 0 });
  approx(p.x, 10.875);
  approx(p.y, 20);
});

test("nearestCardioidParam finds ~0 distance for a point on the curve", () => {
  const onCurve = cardioidPoint(1.0, GEOM_UNIT);
  const { theta, dist } = nearestCardioidParam(onCurve.x, onCurve.y, GEOM_UNIT);
  assert.ok(dist < 0.06, `dist ${dist} should be small`);
  assert.ok(Math.abs(theta - 1.0) < 0.05, `theta ${theta} should be ~1.0`);
});

test("nearestCardioidParam returns a large distance for a far point", () => {
  const { dist } = nearestCardioidParam(100, 100, GEOM_UNIT);
  assert.ok(dist > 1, `dist ${dist} should be large`);
});

import { tryCatchRail, stepRail } from "../js/physics.js";

const RAIL_GEOM = { cx: 0, cy: 0, scale: 50, rot: 0, cooldown: 60, catchDist: 18, arcScale: 90 };
const RIDE_GEAR = { engageSpeed: 3, rideAccel: 1, rideCap: 14, spinCost: 4, rideSpinDrain: 0.1, minRideSpeed: 6 };

test("tryCatchRail catches a fast bey sitting on the curve", () => {
  const on = cardioidPoint(1.0, RAIL_GEOM);
  const b = bey({ x: on.x, y: on.y, vx: 5, vy: 0, dir: 1, dashCd: 0 });
  const { bey: next, caught } = tryCatchRail(b, RAIL_GEOM, RIDE_GEAR);
  assert.equal(caught, true);
  assert.equal(next.railed, true);
  assert.equal(next.railDir, 1);
  assert.equal(next.railSpeed, 6); // speed 5 floored up to minRideSpeed 6
  assert.ok(Math.abs(next.railTheta - 1.0) < 0.05);
});

test("tryCatchRail does not catch when too far from the curve", () => {
  const b = bey({ x: 1000, y: 1000, vx: 5, vy: 0, dashCd: 0 });
  assert.equal(tryCatchRail(b, RAIL_GEOM, RIDE_GEAR).caught, false);
});

test("tryCatchRail does not catch below the engage speed", () => {
  const on = cardioidPoint(1.0, RAIL_GEOM);
  const b = bey({ x: on.x, y: on.y, vx: 1, vy: 0, dashCd: 0 });
  assert.equal(tryCatchRail(b, RAIL_GEOM, RIDE_GEAR).caught, false);
});

test("tryCatchRail does not catch a dead bey", () => {
  const on = cardioidPoint(1.0, RAIL_GEOM);
  const b = bey({ x: on.x, y: on.y, vx: 5, vy: 0, alive: false, dashCd: 0 });
  assert.equal(tryCatchRail(b, RAIL_GEOM, RIDE_GEAR).caught, false);
});

test("tryCatchRail does not catch a bey already on the rail", () => {
  const on = cardioidPoint(1.0, RAIL_GEOM);
  const b = bey({ x: on.x, y: on.y, vx: 5, vy: 0, railed: true, dashCd: 0 });
  assert.equal(tryCatchRail(b, RAIL_GEOM, RIDE_GEAR).caught, false);
});

test("tryCatchRail does not catch while on cooldown", () => {
  const on = cardioidPoint(1.0, RAIL_GEOM);
  const b = bey({ x: on.x, y: on.y, vx: 5, vy: 0, dashCd: 10 });
  assert.equal(tryCatchRail(b, RAIL_GEOM, RIDE_GEAR).caught, false);
});

test("tryCatchRail sets railDir from the bey's spin direction", () => {
  const on = cardioidPoint(1.0, RAIL_GEOM);
  const b = bey({ x: on.x, y: on.y, vx: 5, vy: 0, dir: -1, dashCd: 0 });
  assert.equal(tryCatchRail(b, RAIL_GEOM, RIDE_GEAR).bey.railDir, -1);
});

test("tryCatchRail does not mutate the input bey", () => {
  const on = cardioidPoint(1.0, RAIL_GEOM);
  const b = bey({ x: on.x, y: on.y, vx: 5, vy: 0, dir: 1, dashCd: 0 });
  tryCatchRail(b, RAIL_GEOM, RIDE_GEAR);
  assert.equal(b.railed, undefined);
});

test("stepRail advances theta in railDir and ramps ride speed", () => {
  const b = bey({ railed: true, railTheta: 1.0, railDir: 1, railSpeed: 6, spin: 100 });
  const { bey: next, released } = stepRail(b, RAIL_GEOM, RIDE_GEAR);
  assert.equal(released, false);
  assert.equal(next.railSpeed, 7);                 // 6 + rideAccel 1
  assert.ok(next.railTheta > 1.0);                 // advanced forward
  assert.ok(Math.abs(next.railTheta - (1.0 + 7 / 90)) < 1e-9);
  const p = cardioidPoint(next.railTheta, RAIL_GEOM);
  assert.ok(Math.abs(next.x - p.x) < 1e-9 && Math.abs(next.y - p.y) < 1e-9);
});

test("stepRail advances theta in the negative direction for railDir -1", () => {
  const b = bey({ railed: true, railTheta: 3.0, railDir: -1, railSpeed: 6, spin: 100 });
  const { bey: next, released } = stepRail(b, RAIL_GEOM, RIDE_GEAR);
  assert.equal(released, false);
  assert.ok(next.railTheta < 3.0);
  assert.ok(Math.abs(next.railTheta - (3.0 - 7 / 90)) < 1e-9);
});

test("stepRail clamps ride speed to the gear cap", () => {
  const b = bey({ railed: true, railTheta: 1.0, railDir: 1, railSpeed: 13.5, spin: 100 });
  assert.equal(stepRail(b, RAIL_GEOM, RIDE_GEAR).bey.railSpeed, 14);
});

test("stepRail releases at the cusp (railDir +1) with cooldown and spin cost", () => {
  const b = bey({ railed: true, railTheta: Math.PI * 2 - 0.01, railDir: 1, railSpeed: 6, spin: 100 });
  const { bey: next, released } = stepRail(b, RAIL_GEOM, RIDE_GEAR);
  assert.equal(released, true);
  assert.equal(next.railed, false);
  assert.equal(next.dashCd, 60);
  // spin loses the ride trickle (0.1) then the release cost (4)
  assert.ok(Math.abs(next.spin - 95.9) < 1e-9);
});

test("stepRail releases when railDir -1 crosses theta 0", () => {
  const b = bey({ railed: true, railTheta: 0.01, railDir: -1, railSpeed: 6, spin: 100 });
  const { bey: next, released } = stepRail(b, RAIL_GEOM, RIDE_GEAR);
  assert.equal(released, true);
  assert.equal(next.railed, false);
  assert.equal(next.dashCd, 60);
  assert.ok(Math.abs(next.spin - 95.9) < 1e-9);
});

test("stepRail does not mutate the input bey", () => {
  const b = bey({ railed: true, railTheta: 1.0, railDir: 1, railSpeed: 6, spin: 100 });
  stepRail(b, RAIL_GEOM, RIDE_GEAR);
  assert.equal(b.railTheta, 1.0);
  assert.equal(b.railSpeed, 6);
});

test("stepBey scales spin decay by the bey's spinDecayMult", () => {
  const fast = stepBey(bey({ spin: 100, spinDecayMult: 2 }), STADIUM, PARAMS);
  const defaultBey = stepBey(bey({ spin: 100 }), STADIUM, PARAMS);
  assert.equal(defaultBey.spin, 99);   // default: loses spinDecay*dt = 1
  assert.equal(fast.spin, 98);   // 2x decay
});

test("stepBey scales the centering force by the bey's centeringMult", () => {
  // off-center bey: stronger centering pulls velocity inward harder (more negative)
  const strong = stepBey(bey({ x: 50, y: 0, centeringMult: 2 }), STADIUM, PARAMS);
  const normal = stepBey(bey({ x: 50, y: 0 }), STADIUM, PARAMS);
  assert.ok(strong.vx < normal.vx, "stronger centering => more inward vx");
});

test("resolveCollision: drain is asymmetric by attacker atkMult and defender defMult", () => {
  // a hits hard (atkMult 2), b has no defense bonus => b loses double
  const a = bey({ x: -5, y: 0, spin: 50, atkMult: 2 });
  const b = bey({ x: 5, y: 0, spin: 50 });
  const [a2, b2] = resolveCollision(a, b, { restitution: 1, collisionSpinDrain: 5 });
  assert.equal(a2.spin, 45); // a loses base drain (b.atkMult defaults 1)
  assert.equal(b2.spin, 40); // b loses base*2 (a.atkMult 2)
});

test("resolveCollision: a defender's defMult reduces the spin it loses", () => {
  const a = bey({ x: -5, y: 0, spin: 50 });
  const b = bey({ x: 5, y: 0, spin: 50, defMult: 2 });
  const [, b2] = resolveCollision(a, b, { restitution: 1, collisionSpinDrain: 5 });
  assert.equal(b2.spin, 47.5); // base 5 / defMult 2 = 2.5 lost
});

test("resolveCollision: attacker atkMult and defender defMult cancel when equal", () => {
  const a = bey({ x: -5, y: 0, spin: 50, atkMult: 2 });
  const b = bey({ x: 5, y: 0, spin: 50, defMult: 2 });
  const [, b2] = resolveCollision(a, b, { restitution: 1, collisionSpinDrain: 5 });
  assert.equal(b2.spin, 45); // 5 * atkMult 2 / defMult 2 = 5 — net same as default
});

test("resolveCollision: with no atk/def mults, drain stays symmetric (regression)", () => {
  const a = bey({ x: -5, y: 0, spin: 50 });
  const b = bey({ x: 5, y: 0, spin: 50 });
  const [a2, b2] = resolveCollision(a, b, { restitution: 1, collisionSpinDrain: 5 });
  assert.equal(a2.spin, 45);
  assert.equal(b2.spin, 45);
});

test("stepBey: higher moment of inertia loses less spin", () => {
  const light = stepBey(bey({ spin: 100, inertia: 1 }), STADIUM, PARAMS);
  const heavy = stepBey(bey({ spin: 100, inertia: 2 }), STADIUM, PARAMS);
  assert.equal(light.spin, 99);     // 100 - 1*1/1
  assert.equal(heavy.spin, 99.5);   // 100 - 1*1/2
});

test("stepBey: a low-spin bey precesses — weaker inward pull + wobble advances", () => {
  const P = { ...PARAMS, wobbleSpin: 50 };
  const high = stepBey(bey({ x: 40, spin: 100 }), STADIUM, P); // >= wobbleSpin: no precession
  const low  = stepBey(bey({ x: 40, spin: 10  }), STADIUM, P); // < wobbleSpin: precesses
  assert.ok(low.vx > high.vx, "precessing bey is pulled toward center less hard");
  assert.notEqual(low.wobble, 0, "wobble phase advanced while precessing");
  assert.equal(high.wobble, 0, "no wobble advance above the threshold");
});

test("stepBey: no precession when wobbleSpin is unset (existing behavior)", () => {
  const withParam = stepBey(bey({ x: 40, spin: 60 }), STADIUM, { ...PARAMS, wobbleSpin: 50 });
  const without   = stepBey(bey({ x: 40, spin: 60 }), STADIUM, PARAMS);
  assert.equal(withParam.vx, without.vx); // spin 60 >= 50 -> identical
});
