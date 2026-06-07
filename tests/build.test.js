// tests/build.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { combineStats, statsToPhysics, xDashToGear } from "../js/build.js";

const blade   = { attack: 40, defense: 10, stamina: 10 };
const ratchet = { attack: 10, defense: 15, stamina: 10 };
const bit     = { attack: 10, defense: 15, stamina: 10, xDash: 25, burstResistance: 55 };

test("combineStats sums the three parts and pulls xDash/burst from the bit", () => {
  const s = combineStats(blade, ratchet, bit);
  assert.equal(s.attack, 60);
  assert.equal(s.defense, 40);
  assert.equal(s.stamina, 30);
  assert.equal(s.xDash, 25);
  assert.equal(s.burstResistance, 55);
});

test("statsToPhysics is monotonic in each stat", () => {
  const base = { attack: 90, defense: 90, stamina: 90, xDash: 25, burstResistance: 55 };
  const more = (k, v) => statsToPhysics({ ...base, [k]: v });
  assert.ok(more("stamina", 150).spin0 > more("stamina", 30).spin0);
  assert.ok(more("stamina", 150).spinDecayMult < more("stamina", 30).spinDecayMult);
  assert.ok(more("defense", 150).mass > more("defense", 30).mass);
  assert.ok(more("defense", 150).defMult > more("defense", 30).defMult);
  assert.ok(more("attack", 150).atkMult > more("attack", 30).atkMult);
  assert.ok(more("attack", 150).launchMult > more("attack", 30).launchMult);
  assert.ok(more("burstResistance", 80).centeringMult > more("burstResistance", 30).centeringMult);
});

test("statsToPhysics clamps to the stated bounds at the extremes", () => {
  const lo = statsToPhysics({ attack: 0, defense: 0, stamina: 0, xDash: 5, burstResistance: 30 });
  const hi = statsToPhysics({ attack: 200, defense: 200, stamina: 200, xDash: 45, burstResistance: 80 });
  assert.equal(lo.spin0, 80);
  assert.equal(hi.spin0, 120);
  assert.equal(lo.mass, 0.7);
  assert.ok(Math.abs(hi.mass - 1.5) < 1e-9);
  assert.ok(Math.abs(lo.centeringMult - 1) < 1e-9);
  assert.ok(Math.abs(hi.centeringMult - 1.8) < 1e-9);
});

test("statsToPhysics attaches a gear derived from xDash", () => {
  const p = statsToPhysics({ attack: 90, defense: 90, stamina: 90, xDash: 45, burstResistance: 55 });
  assert.deepEqual(p.gear, xDashToGear(45));
});

test("xDashToGear is monotonic and bounded", () => {
  const lo = xDashToGear(5), hi = xDashToGear(45);
  assert.ok(hi.rideAccel > lo.rideAccel);
  assert.ok(hi.rideCap > lo.rideCap);
  assert.ok(hi.engageSpeed < lo.engageSpeed);
  assert.equal(lo.engageSpeed, 4.5);
  assert.equal(hi.engageSpeed, 3.0);
  assert.equal(lo.rideCap, 10);
  assert.equal(hi.rideCap, 14);
});
