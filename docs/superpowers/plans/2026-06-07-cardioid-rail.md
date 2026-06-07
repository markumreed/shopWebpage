# Cardioid Rail (Catch / Ride / Release) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the instant-impulse circular ring dash with a cardioid-shaped rail that a bey catches onto, rides while accelerating, and releases off the cusp — slingshotting at the rival.

**Architecture:** Pure cardioid geometry and the catch/ride/release transitions live in `js/physics.js` (unit-tested). `js/arena.js` drives a per-bey "railed" state in its frame loop, aims the release at the live opponent, draws the cardioid, and reuses the existing dash juice. The old `tryXtremeDash` is kept until `arena.js` stops using it, then removed — so every commit stays coherent.

**Tech Stack:** Vanilla ES modules, HTML5 canvas, Node's built-in test runner (`node --test`).

---

## File Structure

- `js/physics.js` — **add** pure geometry (`cardioidPoint`, `cardioidTangent`, `nearestCardioidParam`, const `CARDIOID_MAX_R`) and rail transitions (`tryCatchRail`, `stepRail`); **later remove** `tryXtremeDash`.
- `tests/physics.test.js` — **add** geometry + catch/ride/release tests; **later remove** the `tryXtremeDash` tests.
- `js/arena.js` — **swap** the ring-band dash for the cardioid rail: imports, constants, `makeBey` fields, the loop's per-bey advance, and the rail draw.

`js/sound.js`, `js/main.js`, `index.html`, `css/arena.css` are unchanged.

---

## Task 1: Cardioid geometry (pure)

**Files:**
- Modify: `js/physics.js` (append exported functions + a constant)
- Test: `tests/physics.test.js`

- [ ] **Step 1: Write the failing tests**

Append to the END of `tests/physics.test.js`:

```javascript
import { cardioidPoint, cardioidTangent, nearestCardioidParam, CARDIOID_MAX_R } from "../js/physics.js";

// shared float comparison for the geometry tests
function approx(actual, expected, eps = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= eps, `expected ${actual} ≈ ${expected}`);
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test 2>&1 | grep -E "cardioid|# fail"`
Expected: FAIL — `cardioidPoint is not a function` / import error.

- [ ] **Step 3: Implement the geometry**

Append to `js/physics.js` (after `decideOutcome`, before the existing `tryXtremeDash`):

```javascript
// A cardioid r = 1 − cosθ, recentred so its bounding box centers on the origin,
// then scaled, rotated, and translated to sit in the stadium. The cusp (θ = 0)
// is the release point. geom = { cx, cy, scale, rot }.
const CARDIOID_BBOX_CX = -0.875;    // local bbox-center x (precomputed from the curve)
export const CARDIOID_MAX_R = 1.34; // upper bound on |point − center| in local units (the
                                    // true max is ~1.337 near θ≈100°); used for fit scaling

export function cardioidPoint(theta, geom) {
  const r = 1 - Math.cos(theta);
  const lx = r * Math.cos(theta) - CARDIOID_BBOX_CX; // recentre so the shape is centered
  const ly = r * Math.sin(theta);
  const c = Math.cos(geom.rot), s = Math.sin(geom.rot);
  return {
    x: geom.cx + (lx * c - ly * s) * geom.scale,
    y: geom.cy + (lx * s + ly * c) * geom.scale,
  };
}

// Unit tangent at theta (analytic derivative of the local parametric form,
// rotated to match geom.rot). Independent of scale. Degenerate at the cusp.
export function cardioidTangent(theta, geom) {
  const lx = Math.sin(theta) * (2 * Math.cos(theta) - 1);
  const ly = Math.cos(theta) - Math.cos(2 * theta);
  const c = Math.cos(geom.rot), s = Math.sin(geom.rot);
  const rx = lx * c - ly * s;
  const ry = lx * s + ly * c;
  const mag = Math.hypot(rx, ry);
  if (mag < 1e-9) return { x: 0, y: 0 }; // cusp: tangent is degenerate
  return { x: rx / mag, y: ry / mag };
}

// Closest sampled point on the cardioid to (x, y): returns its theta and distance.
export function nearestCardioidParam(x, y, geom, samples = 180) {
  let best = Infinity, bestTheta = 0;
  for (let i = 0; i < samples; i++) {
    const theta = (i / samples) * Math.PI * 2;
    const p = cardioidPoint(theta, geom);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < best) { best = d; bestTheta = theta; }
  }
  return { theta: bestTheta, dist: best };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test`
Expected: PASS — 60 tests (54 prior + 6 new), 0 fail.

- [ ] **Step 5: Commit**

```bash
git add js/physics.js tests/physics.test.js
git commit -m "feat: cardioid rail geometry — point, tangent, nearest-param"
```

---

## Task 2: Catch and ride/release transitions (pure)

**Files:**
- Modify: `js/physics.js` (append two exported functions)
- Test: `tests/physics.test.js`

- [ ] **Step 1: Write the failing tests**

Append to the END of `tests/physics.test.js`:

```javascript
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
  assert.equal(stepRail(b, RAIL_GEOM, RIDE_GEAR).released, true);
});

test("stepRail does not mutate the input bey", () => {
  const b = bey({ railed: true, railTheta: 1.0, railDir: 1, railSpeed: 6, spin: 100 });
  stepRail(b, RAIL_GEOM, RIDE_GEAR);
  assert.equal(b.railTheta, 1.0);
  assert.equal(b.railSpeed, 6);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test 2>&1 | grep -E "tryCatchRail|stepRail|# fail"`
Expected: FAIL — `tryCatchRail is not a function` / `stepRail is not a function`.

- [ ] **Step 3: Implement the transitions**

Append to `js/physics.js` (after `nearestCardioidParam`, before `tryXtremeDash`):

```javascript
// tryCatchRail — a free bey "catches" the cardioid rail when it passes close
// enough while moving fast enough. On catch it locks onto the curve at the
// nearest theta, riding in its spin direction. Pure — returns { bey, caught }.
// `geom` = { cx, cy, scale, rot, cooldown, catchDist, arcScale }.
// `gear` = { engageSpeed, rideAccel, rideCap, spinCost, rideSpinDrain, minRideSpeed }.
export function tryCatchRail(bey, geom, gear) {
  if (!bey.alive || bey.railed || (bey.dashCd ?? 0) > 0) return { bey, caught: false };

  const { theta, dist } = nearestCardioidParam(bey.x, bey.y, geom);
  if (dist > geom.catchDist) return { bey, caught: false };

  const speed = Math.hypot(bey.vx, bey.vy);
  if (speed < gear.engageSpeed) return { bey, caught: false };

  const next = {
    ...bey,
    railed: true,
    railTheta: theta,
    railDir: bey.dir ?? 1,
    railSpeed: Math.max(speed, gear.minRideSpeed),
  };
  return { bey: next, caught: true };
}

// stepRail — advance a railed bey one frame: accelerate, move along the curve,
// and release off the cusp (theta = 0 / 2π) in the ride direction. On release
// the bey leaves the rail with a cooldown and a spin cost; the caller aims its
// velocity. Pure — returns { bey, released }. Assumes bey.railed is true.
export function stepRail(bey, geom, gear) {
  const railSpeed = Math.min(gear.rideCap, (bey.railSpeed ?? 0) + gear.rideAccel);
  const dir = bey.railDir ?? 1;
  let nextTheta = (bey.railTheta ?? 0) + dir * (railSpeed / geom.arcScale);

  let released = false;
  if (dir > 0 && nextTheta >= Math.PI * 2) { released = true; nextTheta = 0; }
  else if (dir < 0 && nextTheta <= 0) { released = true; nextTheta = 0; }

  const p = cardioidPoint(nextTheta, geom);
  const t = cardioidTangent(nextTheta, geom);
  const next = {
    ...bey,
    x: p.x, y: p.y,
    vx: t.x * railSpeed, vy: t.y * railSpeed,
    railTheta: nextTheta,
    railSpeed,
    spin: Math.max(0, bey.spin - gear.rideSpinDrain),
  };
  if (released) {
    next.railed = false;
    next.dashCd = geom.cooldown;
    next.spin = Math.max(0, next.spin - gear.spinCost);
  }
  return { bey: next, released };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test`
Expected: PASS — 73 tests (60 + 13 new), 0 fail.

- [ ] **Step 5: Commit**

```bash
git add js/physics.js tests/physics.test.js
git commit -m "feat: rail catch + ride/release transitions (tryCatchRail, stepRail)"
```

---

## Task 3: Wire the cardioid rail into the arena

**Files:**
- Modify: `js/arena.js`

Apply the sub-edits in order. The file parses with `node --check js/arena.js` and the 73 tests stay green throughout (arena.js is not imported by tests).

- [ ] **Step 1: Update the physics import**

In `js/arena.js`, replace line 3:

```javascript
import { stepBey, resolveCollision, decideOutcome, distance, aiSteer, tryXtremeDash } from "./physics.js";
```

with:

```javascript
import { stepBey, resolveCollision, decideOutcome, distance, aiSteer, stepRail, tryCatchRail, cardioidPoint, CARDIOID_MAX_R } from "./physics.js";
```

- [ ] **Step 2: Replace the rail/gear constants**

Replace this block (currently after `const STREAK_KEY = "arena.streak";`):

```javascript
// X-Celerator rail band (as fractions of the stadium radius) + dash cooldown.
const RAIL = { innerFrac: 0.62, outerFrac: 0.70, cooldown: 40 };
// Gear system: high gear dashes hard but burns stamina and engages easily;
// standard is gentler and needs more speed to engage.
const GEARS = {
  high:     { dashImpulse: 7.5, engageSpeed: 3.5, spinCost: 4 },
  standard: { dashImpulse: 4.0, engageSpeed: 5.0, spinCost: 1.5 },
};
```

with:

```javascript
// X-Celerator cardioid rail: how much of the bowl it fills, plus tuning for
// catching and riding it.
const RAIL_FIT = 0.72;        // cardioid max radius as a fraction of bowl radius
const RAIL_COOLDOWN = 60;     // frames after a release before a bey can re-catch
const RAIL_CATCH_DIST = 18;   // how close (px) a bey must pass to catch the rail
const RAIL_ARC_SCALE = 90;    // larger → less theta advanced per unit ride speed
// Gear system: high gear catches easily, accelerates hard, costs more spin on
// release; standard needs more speed to catch but is gentler on stamina.
const GEARS = {
  high:     { engageSpeed: 3.0, rideAccel: 0.9, rideCap: 14, spinCost: 4,   rideSpinDrain: 0.15, minRideSpeed: 6 },
  standard: { engageSpeed: 4.5, rideAccel: 0.5, rideCap: 10, spinCost: 1.5, rideSpinDrain: 0.10, minRideSpeed: 5 },
};
```

- [ ] **Step 3: Add rail fields to `makeBey`**

Replace the `makeBey` function:

```javascript
function makeBey(name, x, y, color, dir = 1) {
  return {
    name, x, y, vx: 0, vy: 0, spin: START_SPIN, radius: 22, mass: 1,
    alive: true, color, special: false, dir, dashCd: 0,
    rot: 0,        // accumulated visual rotation (radians)
    wobble: 0,     // wobble phase for the low-spin death wobble
  };
}
```

with:

```javascript
function makeBey(name, x, y, color, dir = 1) {
  return {
    name, x, y, vx: 0, vy: 0, spin: START_SPIN, radius: 22, mass: 1,
    alive: true, color, special: false, dir, dashCd: 0,
    railed: false, railTheta: 0, railDir: 1, railSpeed: 0,
    rot: 0,        // accumulated visual rotation (radians)
    wobble: 0,     // wobble phase for the low-spin death wobble
  };
}
```

- [ ] **Step 4: Replace the `rail` geometry object**

Replace this block (currently right after `const stadium = { ... };`):

```javascript
  const rail = {
    inner: stadium.r * RAIL.innerFrac,
    outer: stadium.r * RAIL.outerFrac,
    cooldown: RAIL.cooldown,
  };
```

with:

```javascript
  const rail = {
    cx: stadium.cx, cy: stadium.cy,
    scale: (RAIL_FIT * stadium.r) / CARDIOID_MAX_R,
    rot: Math.PI / 2,            // cusp points downward
    cooldown: RAIL_COOLDOWN,
    catchDist: RAIL_CATCH_DIST,
    arcScale: RAIL_ARC_SCALE,
  };
```

- [ ] **Step 5: Add the `advanceRail` helper**

In `js/arena.js`, find the `onXtremeDash` function (it ends with `sfx.xtreme();` then `}`). Immediately AFTER it, add:

```javascript
  // Advance one bey for a frame. A railed bey rides the cardioid (and on release
  // slingshots toward the foe); a free bey moves under normal physics, ticks its
  // cooldown, and may catch the rail.
  function advanceRail(bey, foe, gearKey) {
    const gear = GEARS[gearKey];
    if (bey.railed) {
      const { bey: next, released } = stepRail(bey, rail, gear);
      if (released) {
        const ang = Math.atan2(foe.y - next.y, foe.x - next.x);
        next.vx = Math.cos(ang) * next.railSpeed;
        next.vy = Math.sin(ang) * next.railSpeed;
        onXtremeDash(next);
      }
      return next;
    }
    let next = stepBey(bey, stadium, STADIUM_PARAMS);
    if (next.dashCd > 0) next = { ...next, dashCd: next.dashCd - 1 };
    return tryCatchRail(next, rail, gear).bey;
  }
```

- [ ] **Step 6: Replace the loop's steer + step + dash block**

In `loop`, replace this block:

```javascript
    // AI agency: steer the rival each frame (seek when ahead, survive when behind)
    const steer = aiSteer(opponent, player, stadium, AI_AGGRESSION);
    opponent.vx += steer.ax;
    opponent.vy += steer.ay;

    player = stepBey(player, stadium, STADIUM_PARAMS);
    opponent = stepBey(opponent, stadium, STADIUM_PARAMS);

    // X-Celerator rail: tick dash cooldowns, then try to engage the Xtreme Dash
    if (player.dashCd > 0) player = { ...player, dashCd: player.dashCd - 1 };
    if (opponent.dashCd > 0) opponent = { ...opponent, dashCd: opponent.dashCd - 1 };
    const pDash = tryXtremeDash(player, stadium, rail, GEARS[playerGear]);
    player = pDash.bey;
    if (pDash.fired) onXtremeDash(player);
    const oDash = tryXtremeDash(opponent, stadium, rail, GEARS[rivalGear]);
    opponent = oDash.bey;
    if (oDash.fired) onXtremeDash(opponent);
```

with:

```javascript
    // AI agency: steer the rival each frame — but only while it's free, not
    // while it's locked onto the rail (the rail dictates its motion).
    if (!opponent.railed) {
      const steer = aiSteer(opponent, player, stadium, AI_AGGRESSION);
      opponent.vx += steer.ax;
      opponent.vy += steer.ay;
    }

    // X-Celerator cardioid rail: railed beys ride the curve and slingshot off the
    // cusp at the foe; free beys move under physics and may catch the rail.
    player = advanceRail(player, opponent, playerGear);
    opponent = advanceRail(opponent, player, rivalGear);
```

- [ ] **Step 7: Replace the rail draw with the cardioid**

In `draw`, replace this block:

```javascript
    // X-Celerator rail — a bright dashed gear-track band on the floor
    ctx.save();
    ctx.strokeStyle = "rgba(255,214,74,.5)";
    ctx.lineWidth = rail.outer - rail.inner;
    ctx.setLineDash([14, 10]);
    ctx.shadowColor = "rgba(255,214,74,.5)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(stadium.cx, stadium.cy, (rail.inner + rail.outer) / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
```

with:

```javascript
    // X-Celerator rail — a glowing cardioid track; beys catch it and slingshot
    // off the cusp at the foe.
    ctx.save();
    ctx.strokeStyle = "rgba(255,214,74,.55)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(255,214,74,.6)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    const RAIL_STEPS = 140;
    for (let i = 0; i <= RAIL_STEPS; i++) {
      const th = (i / RAIL_STEPS) * Math.PI * 2;
      const p = cardioidPoint(th, rail);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
```

- [ ] **Step 8: Verify parse + tests**

Run: `node --check js/arena.js` → exit 0, no output.
Run: `node --test` → 73 pass, 0 fail (unchanged; arena.js isn't imported by tests).

Also re-read the edited `loop`, `advanceRail`, and `draw` to confirm `advanceRail` is defined before `loop` calls it (function declarations hoist within `mountArena`, so order is fine), that `stepRail`/`tryCatchRail`/`cardioidPoint`/`CARDIOID_MAX_R` are imported, and that `rail`/`GEARS`/`playerGear`/`rivalGear` are in scope where used.

- [ ] **Step 9: Commit**

```bash
git add js/arena.js
git commit -m "feat: replace ring dash with cardioid catch/ride/release rail"
```

---

## Task 4: Remove the obsolete `tryXtremeDash`

**Files:**
- Modify: `js/physics.js` (delete the function)
- Modify: `tests/physics.test.js` (delete its tests)

`arena.js` no longer references `tryXtremeDash` after Task 3, so it and its tests can be removed cleanly.

- [ ] **Step 1: Delete the function**

In `js/physics.js`, delete the entire `tryXtremeDash` block — the comment beginning `// tryXtremeDash — the X-Celerator rail.` through the function's closing brace:

```javascript
// tryXtremeDash — the X-Celerator rail. When a bey is inside the rail band,
// moving above the gear's engage speed, and off cooldown, its bit-gear meshes
// with the rail and it gets an Xtreme Dash: an impulse along its current
// heading. Pure — returns { bey, fired } and never mutates the input.
// `rail`  = { inner, outer, cooldown } in absolute units from stadium center.
// `gear`  = { dashImpulse, engageSpeed, spinCost }.
export function tryXtremeDash(bey, stadium, rail, gear) {
  if (!bey.alive || (bey.dashCd ?? 0) > 0) return { bey, fired: false };

  const d = distance(bey.x, bey.y, stadium.cx, stadium.cy);
  if (d < rail.inner || d > rail.outer) return { bey, fired: false };

  const speed = Math.hypot(bey.vx, bey.vy);
  if (speed < gear.engageSpeed) return { bey, fired: false };

  const ux = bey.vx / speed;
  const uy = bey.vy / speed;
  const next = {
    ...bey,
    vx: bey.vx + ux * gear.dashImpulse,
    vy: bey.vy + uy * gear.dashImpulse,
    spin: Math.max(0, bey.spin - gear.spinCost),
    dashCd: rail.cooldown,
  };
  return { bey: next, fired: true };
}
```

- [ ] **Step 2: Delete its tests**

In `tests/physics.test.js`, delete the `tryXtremeDash` test section — the line `import { tryXtremeDash } from "../js/physics.js";`, the `RAIL_T` and `GEAR_T` constants, and all 7 `tryXtremeDash` tests (titles: "fires inside the rail band when fast enough", "impulse follows a diagonal heading on both axes", "does not fire below the engage speed", "does not fire outside the rail band", "does not fire while on cooldown", "does not fire for a dead bey", "does not mutate the input bey").

Note: leave the new `tryCatchRail`/`stepRail` tests (which use `RAIL_GEOM`/`RIDE_GEAR`) intact — only the `tryXtremeDash` block and its `RAIL_T`/`GEAR_T` go.

- [ ] **Step 3: Verify**

Run: `node --check js/physics.js` → exit 0.
Run: `node --test` → 66 pass (73 − 7 removed), 0 fail.
Run: `grep -n "tryXtremeDash" js/ tests/ -r` → no matches (confirm fully removed).

- [ ] **Step 4: Commit**

```bash
git add js/physics.js tests/physics.test.js
git commit -m "refactor: remove obsolete tryXtremeDash ring-dash mechanic"
```

---

## Task 5: Final verification

- [ ] **Step 1: Full test run**

Run: `node --test`
Expected: `# pass 66`, `# fail 0`.

- [ ] **Step 2: Parse all modules**

Run: `node --check js/physics.js && node --check js/arena.js && node --check js/sound.js && node --check js/main.js`
Expected: no output (exit 0 for all).

- [ ] **Step 3: Playtest in the browser**

Open `index.html`, press the red button, and confirm:
- A glowing **cardioid (rounded-heart) track** is drawn on the floor with its point (cusp) at the bottom.
- Launching toward the rail, your bey **catches** the curve, **rides** it (visibly following the loop and speeding up), then **flings off the cusp toward the rival**, with the "XTREME DASH!" callout, trail, shake, and rev sound.
- **Spin direction** changes which way you ride around the loop (right vs left).
- **High gear** catches more easily and accelerates harder than Standard.
- The rival also catches and rides the rail.
- After a release the bey doesn't instantly re-catch (cooldown).

- [ ] **Step 4: Tuning pass (optional, after playtest)**

If rides feel too long/short, adjust `RAIL_ARC_SCALE` (higher = whips around faster) or the gears' `rideAccel`/`rideCap`. If beys catch too eagerly or never, adjust `RAIL_CATCH_DIST` or the gears' `engageSpeed`. If the shape sits wrong, adjust `RAIL_FIT` (size) or `rail.rot` (orientation). Re-run `node --test` after any change and commit separately.

---

## Notes for the implementer

- **Why keep `tryXtremeDash` until Task 4:** removing it before `arena.js` stops importing it (Task 3) would leave an intermediate commit importing a missing export. Tasks 1–2 are purely additive; Task 3 switches `arena.js` over; Task 4 deletes the now-dead code. Every commit parses and keeps tests green.
- **The release aim lives in `arena.js`, not `stepRail`:** the pure `stepRail` doesn't know the opponent's position, so on release it leaves `railSpeed` on the bey and `advanceRail` sets the velocity toward the foe. This keeps the two beys decoupled in the pure layer.
- **Default rail fields on `makeBey`** (`railed:false`, etc.) mean existing physics behaves unchanged; the new pure functions also tolerate missing fields via `?? ` defaults, so tests that don't set them still work.
- **A railed bey skips `stepBey`** for that frame — its motion is the rail, by design. Normal spin decay pauses while riding; the small `rideSpinDrain` stands in for it. Rides are short and the cardioid stays inside the bowl, so a railed bey can't ring-out mid-ride.
