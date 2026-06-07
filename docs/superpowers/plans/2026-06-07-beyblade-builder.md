# Beyblade Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pre-match Blade/Ratchet/Bit builder whose combined stats drive each bey's physics for the arena fight, with a randomly-built rival and part images in the HUD.

**Architecture:** A pure `js/build.js` combines part stats and maps them to a per-bey physics profile (unit-tested with synthetic fixtures). `js/physics.js` gains backward-compatible per-bey hooks (spin-decay/centering multipliers in `stepBey`; asymmetric attack/defense drain in `resolveCollision`). A vendored `js/parts.js` + `assets/parts/` holds a curated subset of beybrew's part data and images. `js/arena.js` builds the player bey from the picked parts and the rival from a random build, wires the in-arena picker, and shows part images in the HUD. The Bit's `xDash` stat replaces the old Gear toggle.

**Tech Stack:** Vanilla ES modules, HTML5 canvas, Node's built-in test runner (`node --test`).

---

## File Structure

- `js/build.js` — **new, pure**: `combineStats`, `statsToPhysics`, `xDashToGear`. Tested.
- `tests/build.test.js` — **new**: unit tests for the build model (synthetic fixtures).
- `js/physics.js` — **modify**: `stepBey` honors `spinDecayMult`/`centeringMult`; `resolveCollision` applies asymmetric `atkMult`/`defMult` drain. Backward-compatible defaults.
- `tests/physics.test.js` — **modify**: new behavior + default-preservation tests.
- `js/parts.js` — **new, vendored data**: `BLADES`, `RATCHETS`, `BITS` arrays.
- `assets/parts/*.png` + `assets/parts/SOURCE.md` — **new**: curated part images + attribution.
- `js/arena.js` — **modify**: build the player/rival beys from profiles, per-bey rail gear, picker wiring, HUD images, remove the Gear toggle.
- `index.html` — **modify**: replace the Gear toggle with Blade/Ratchet/Bit selects + a stats readout; add HUD image slots.
- `css/arena.css` — **modify**: picker, stats readout, and HUD thumbnail styles.
- `js/main.js` — **modify**: pass the new element refs; drop the gear ref.

---

## Task 1: Build model (pure)

**Files:**
- Create: `js/build.js`
- Test: `tests/build.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/build.test.js`:

```javascript
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
  // stamina: more stamina => more spin0, slower decay
  assert.ok(more("stamina", 150).spin0 > more("stamina", 30).spin0);
  assert.ok(more("stamina", 150).spinDecayMult < more("stamina", 30).spinDecayMult);
  // defense: more defense => more mass and defMult
  assert.ok(more("defense", 150).mass > more("defense", 30).mass);
  assert.ok(more("defense", 150).defMult > more("defense", 30).defMult);
  // attack: more attack => more atkMult and launchMult
  assert.ok(more("attack", 150).atkMult > more("attack", 30).atkMult);
  assert.ok(more("attack", 150).launchMult > more("attack", 30).launchMult);
  // burst resistance: more => more centering
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
  assert.ok(hi.engageSpeed < lo.engageSpeed); // higher xDash = easier catch
  assert.equal(lo.engageSpeed, 4.5);
  assert.equal(hi.engageSpeed, 3.0);
  assert.equal(lo.rideCap, 10);
  assert.equal(hi.rideCap, 14);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test 2>&1 | grep -E "combineStats|statsToPhysics|xDashToGear|# fail"`
Expected: FAIL — import error / not a function.

- [ ] **Step 3: Implement `js/build.js`**

Create `js/build.js`:

```javascript
// build.js — pure: combine part stats and map them to a per-bey physics
// profile. No DOM, no canvas. Parts follow beybrew's shape:
//   blade/ratchet: { attack, defense, stamina }
//   bit:           { attack, defense, stamina, xDash, burstResistance }

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const norm = (x, lo, hi) => clamp01((x - lo) / (hi - lo));

// reference ranges (first-pass, tunable): summed atk/def/sta, then bit-only stats
const SUM_LO = 30, SUM_HI = 150;
const XDASH_LO = 5, XDASH_HI = 45;
const BURST_LO = 30, BURST_HI = 80;

export function combineStats(blade, ratchet, bit) {
  return {
    attack:  blade.attack + ratchet.attack + bit.attack,
    defense: blade.defense + ratchet.defense + bit.defense,
    stamina: blade.stamina + ratchet.stamina + bit.stamina,
    xDash:   bit.xDash,
    burstResistance: bit.burstResistance,
  };
}

// Map the Bit's xDash to X-Celerator rail gear params (replacing the old static
// High/Standard table). Low xDash ≈ old "standard", high xDash ≈ old "high".
export function xDashToGear(xDash) {
  const t = norm(xDash, XDASH_LO, XDASH_HI);
  return {
    engageSpeed:   4.5 - 1.5 * t,   // 4.5 (hard to catch) .. 3.0 (easy)
    rideAccel:     0.5 + 0.4 * t,   // 0.5 .. 0.9
    rideCap:       10 + 4 * t,      // 10 .. 14
    spinCost:      1.5 + 2.5 * t,   // 1.5 .. 4
    rideSpinDrain: 0.10 + 0.05 * t, // 0.10 .. 0.15
    minRideSpeed:  5 + t,           // 5 .. 6
  };
}

// Map combined stats to the per-bey physics profile consumed by arena.js /
// physics.js. Bounds are centered so a mid build ≈ today's game feel.
export function statsToPhysics(stats) {
  const sN = norm(stats.stamina, SUM_LO, SUM_HI);
  const dN = norm(stats.defense, SUM_LO, SUM_HI);
  const aN = norm(stats.attack, SUM_LO, SUM_HI);
  const bN = norm(stats.burstResistance, BURST_LO, BURST_HI);
  return {
    spin0:         80 + 40 * sN,    // starting spin (80..120; ~100 mid)
    spinDecayMult: 1.2 - 0.4 * sN,  // scales global spin decay (1.2..0.8)
    mass:          0.7 + 0.8 * dN,  // knockback resistance (0.7..1.5)
    defMult:       0.7 + 0.6 * dN,  // divides spin lost when struck (0.7..1.3)
    atkMult:       0.7 + 0.6 * aN,  // scales spin drained from the foe (0.7..1.3)
    launchMult:    0.85 + 0.3 * aN, // scales launch speed (0.85..1.15)
    centeringMult: 1 + 0.8 * bN,    // ring-out survivability (1..1.8)
    gear:          xDashToGear(stats.xDash),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test`
Expected: PASS — 71 prior + 6 new = 77 tests, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add js/build.js tests/build.test.js
git commit -m "feat: pure build model — combine part stats into a physics profile"
```

---

## Task 2: Per-bey physics hooks

**Files:**
- Modify: `js/physics.js` (`stepBey`, `resolveCollision`)
- Test: `tests/physics.test.js`

- [ ] **Step 1: Write the failing tests**

Append to the END of `tests/physics.test.js`:

```javascript
test("stepBey scales spin decay by the bey's spinDecayMult", () => {
  const fast = stepBey(bey({ spin: 100, spinDecayMult: 2 }), STADIUM, PARAMS);
  const norm = stepBey(bey({ spin: 100 }), STADIUM, PARAMS);
  assert.equal(norm.spin, 99);   // default: loses spinDecay*dt = 1
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

test("resolveCollision: with no atk/def mults, drain stays symmetric (regression)", () => {
  const a = bey({ x: -5, y: 0, spin: 50 });
  const b = bey({ x: 5, y: 0, spin: 50 });
  const [a2, b2] = resolveCollision(a, b, { restitution: 1, collisionSpinDrain: 5 });
  assert.equal(a2.spin, 45);
  assert.equal(b2.spin, 45);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test 2>&1 | grep -E "spinDecayMult|centeringMult|asymmetric|# fail"`
Expected: FAIL — the `spinDecayMult`/`centeringMult`/asymmetric tests fail (current code ignores the new fields). The regression test already passes.

- [ ] **Step 3: Update `stepBey`**

In `js/physics.js`, replace the body of `stepBey` between the `const { dt, friction, spinDecay, centering } = params;` line and the `return` so it reads:

```javascript
export function stepBey(bey, stadium, params) {
  if (!bey.alive) return bey;
  const { dt, friction, spinDecay, centering } = params;
  const centeringMult = bey.centeringMult ?? 1;
  const spinDecayMult = bey.spinDecayMult ?? 1;

  // bowl centering force toward stadium center (scaled per-bey)
  const ax = (stadium.cx - bey.x) * centering * centeringMult;
  const ay = (stadium.cy - bey.y) * centering * centeringMult;

  let vx = (bey.vx + ax * dt) * (1 - friction * dt);
  let vy = (bey.vy + ay * dt) * (1 - friction * dt);

  const x = bey.x + vx * dt;
  const y = bey.y + vy * dt;

  let spin = bey.spin - spinDecay * spinDecayMult * dt;
  let alive = true;
  if (spin <= 0) {
    spin = 0;
    alive = false;
  }
  if (distance(x, y, stadium.cx, stadium.cy) > stadium.r) {
    alive = false;
  }

  return { ...bey, x, y, vx, vy, spin, alive };
}
```

- [ ] **Step 4: Update `resolveCollision` drain**

In `js/physics.js`, replace this block:

```javascript
  // both lose spin on contact; opposite spin directions "spin-steal" — they
  // drain harder than same-spin clashes. Beys without a `dir` default to +1.
  const sameDir = (a.dir ?? 1) === (b.dir ?? 1);
  const drain = collisionSpinDrain * (sameDir ? sameSpinMult : oppositeSpinMult);
  a2.spin = Math.max(0, a.spin - drain);
  b2.spin = Math.max(0, b.spin - drain);
```

with:

```javascript
  // both lose spin on contact; opposite spin directions "spin-steal" — they
  // drain harder than same-spin clashes. Beys without a `dir` default to +1.
  const sameDir = (a.dir ?? 1) === (b.dir ?? 1);
  const drain = collisionSpinDrain * (sameDir ? sameSpinMult : oppositeSpinMult);
  // each bey's loss scales with the OTHER's attack and its own defense
  // (mults default to 1, so a build-less bey drains exactly as before).
  const aLoss = drain * (b.atkMult ?? 1) / (a.defMult ?? 1);
  const bLoss = drain * (a.atkMult ?? 1) / (b.defMult ?? 1);
  a2.spin = Math.max(0, a.spin - aLoss);
  b2.spin = Math.max(0, b.spin - bLoss);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test`
Expected: PASS — 77 prior + 5 new = 82 tests, 0 fail. All pre-existing physics tests (drain symmetry, spin-steal, special) still pass because the new fields default to 1.

- [ ] **Step 6: Commit**

```bash
git add js/physics.js tests/physics.test.js
git commit -m "feat: per-bey physics hooks — spin-decay/centering mults, asymmetric drain"
```

---

## Task 3: Vendor parts data + images

**Files:**
- Create: `js/parts.js`, `assets/parts/*.png`, `assets/parts/SOURCE.md`

This task pulls a **curated subset** of beybrew's part data and images. It is a data-acquisition task (no TDD). beybrew is MIT-licensed code; its part images originate from the Beyblade X franchise — we credit the source and keep only the factual stat fields (not the prose descriptions).

- [ ] **Step 1: Fetch beybrew's part data**

```bash
mkdir -p assets/parts
curl -fsSL https://raw.githubusercontent.com/yujinyuz/beybrew/main/src/data/beyparts.json -o /tmp/beyparts.json || \
curl -fsSL https://raw.githubusercontent.com/yujinyuz/beybrew/master/src/data/beyparts.json -o /tmp/beyparts.json
```
Then inspect the top-level structure to find the arrays for blades, ratchets, and bits, and the exact stat + `image` field names:
```bash
node -e "const d=require('/tmp/beyparts.json'); console.log(Object.keys(d)); for (const k of Object.keys(d)) if (Array.isArray(d[k])) console.log(k, d[k].length, JSON.stringify(d[k][0]).slice(0,300));"
```
If the network is unavailable in this environment, STOP and report BLOCKED (the controller will provide the data); do not fabricate part stats.

- [ ] **Step 2: Select a curated subset and download its images**

Choose **6 blades, 6 ratchets, 6 bits**, spread across types (attack / defense / stamina / balance) so builds feel varied. For each chosen part, download its image (the `image` filename lives under beybrew's `public/images/`):
```bash
# repeat per chosen image filename (use the branch that worked above):
curl -fsSL "https://raw.githubusercontent.com/yujinyuz/beybrew/main/public/images/<IMAGE>" -o "assets/parts/<IMAGE>"
```
Verify each downloaded file is a real image (non-zero size, PNG header):
```bash
ls -l assets/parts/*.png && file assets/parts/*.png | head
```

- [ ] **Step 3: Write `js/parts.js`**

Generate `js/parts.js` from the chosen parts, keeping ONLY the stat fields (drop `description`, `source`, `type`, etc.). Shape:

```javascript
// parts.js — curated beyblade parts (data only, no DOM). Stats + images are a
// curated subset adapted from beybrew (see assets/parts/SOURCE.md). Each blade /
// ratchet carries { attack, defense, stamina }; each bit additionally carries
// { xDash, burstResistance }. `image` is a path under assets/parts/.
export const BLADES = [
  { id: "<slug>", name: "<Name>", image: "assets/parts/<Image>.png", attack: 0, defense: 0, stamina: 0 },
  // ... 6 total
];
export const RATCHETS = [
  { id: "<slug>", name: "<Name>", image: "assets/parts/<Image>.png", attack: 0, defense: 0, stamina: 0 },
  // ... 6 total
];
export const BITS = [
  { id: "<slug>", name: "<Name>", image: "assets/parts/<Image>.png", attack: 0, defense: 0, stamina: 0, xDash: 0, burstResistance: 0 },
  // ... 6 total
];
```
Fill each entry with the real numeric stats and image filename from the chosen parts. `id` is a kebab-case slug of the name. Ratchet names like `"3-60"` are fine as the `name`.

- [ ] **Step 4: Write `assets/parts/SOURCE.md`**

```markdown
# Part assets

Part stats and images are a curated subset adapted from **beybrew**
(https://github.com/yujinyuz/beybrew), which sources Beyblade X part data from
the game's master data. Beyblade X and all part designs are trademarks of their
respective owners (Takara Tomy / Hasbro). Used here for a non-commercial fan
project. Only factual stat fields are reproduced; descriptive text is not.
```

- [ ] **Step 5: Verify**

```bash
node --check js/parts.js
node -e "import('./js/parts.js').then(m => { console.log(m.BLADES.length, m.RATCHETS.length, m.BITS.length); console.log(m.BITS[0]); })"
```
Expected: lengths `6 6 6`; the sample BIT logs with numeric `attack/defense/stamina/xDash/burstResistance` and an `image` path. `node --test` still 82 pass (parts.js isn't imported by tests yet).

- [ ] **Step 6: Commit**

```bash
git add js/parts.js assets/parts
git commit -m "feat: vendor curated beyblade parts data + images"
```

---

## Task 4: Drive arena physics from builds (drop the gear toggle)

**Files:**
- Modify: `js/arena.js`, `js/main.js`, `index.html`

After this task the arena fights with a **default** player build and a **random** rival build; the Gear toggle is gone and the Bit's xDash drives the rail. The part *picker UI* comes in Task 5 — for now the player uses the first part of each array.

- [ ] **Step 1: Update arena imports + constants**

In `js/arena.js`, add build imports after the existing imports (lines 3–5):

```javascript
import { combineStats, statsToPhysics } from "./build.js";
import { BLADES, RATCHETS, BITS } from "./parts.js";
```

Replace the `GEARS` constant block (lines 22–27) with a single fallback gear:

```javascript
// Fallback rail gear when a bey has no build profile (real beys derive theirs
// from the Bit's xDash via statsToPhysics).
const STANDARD_GEAR = { engageSpeed: 4.5, rideAccel: 0.5, rideCap: 10, spinCost: 1.5, rideSpinDrain: 0.10, minRideSpeed: 5 };
```

- [ ] **Step 2: Rewrite `makeBey` to take a profile**

Replace the `makeBey` function:

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

with:

```javascript
function makeBey(name, x, y, color, dir = 1, profile = {}) {
  const {
    spin0 = START_SPIN, mass = 1, atkMult = 1, defMult = 1,
    launchMult = 1, spinDecayMult = 1, centeringMult = 1, gear = STANDARD_GEAR,
  } = profile;
  return {
    name, x, y, vx: 0, vy: 0, spin: spin0, spin0, radius: 22, mass,
    alive: true, color, special: false, dir, dashCd: 0,
    railed: false, railTheta: 0, railDir: 1, railSpeed: 0,
    atkMult, defMult, spinDecayMult, centeringMult, launchMult, gear,
    rot: 0,        // accumulated visual rotation (radians)
    wobble: 0,     // wobble phase for the low-spin death wobble
  };
}
```

- [ ] **Step 3: Replace gear/spin state with build state**

Replace this state line (currently line 59):

```javascript
  let playerDir = 1, playerGear = "standard", rivalDir = 1, rivalGear = "standard";
```

with:

```javascript
  let playerDir = 1, rivalDir = 1;
  let playerBuild = { blade: BLADES[0], ratchet: RATCHETS[0], bit: BITS[0] };
  let rivalBuild = { blade: BLADES[0], ratchet: RATCHETS[0], bit: BITS[0] };

  const buildProfile = (b) => statsToPhysics(combineStats(b.blade, b.ratchet, b.bit));
  const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randomBuild = () => ({ blade: randomPick(BLADES), ratchet: randomPick(RATCHETS), bit: randomPick(BITS) });
```

- [ ] **Step 4: Remove the gear toggle from the destructure**

In the `opts` destructure (line 44), change:

```javascript
    spinDirEl, gearEl, rivalSetupEl,
```

to:

```javascript
    spinDirEl, rivalSetupEl,
```

- [ ] **Step 5: Update the meter denominator to per-bey spin0**

Replace `updateMeters`:

```javascript
  function updateMeters() {
    meterYouEl.style.width = (100 * Math.max(0, player.spin) / START_SPIN) + "%";
    meterRivalEl.style.width = (100 * Math.max(0, opponent.spin) / START_SPIN) + "%";
  }
```

with:

```javascript
  function updateMeters() {
    meterYouEl.style.width = (100 * Math.max(0, player.spin) / player.spin0) + "%";
    meterRivalEl.style.width = (100 * Math.max(0, opponent.spin) / opponent.spin0) + "%";
  }
```

- [ ] **Step 6: Simplify the setup-control helpers (gear toggle gone)**

Replace `syncSetupControls` and `setSetupEnabled`:

```javascript
  // Reflect the player's current spinDir/gear in the toggle button states.
  function syncSetupControls() {
    spinDirEl.querySelectorAll(".seg-btn").forEach((b) => {
      const on = Number(b.dataset.dir) === playerDir;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    gearEl.querySelectorAll(".seg-btn").forEach((b) => {
      const on = b.dataset.gear === playerGear;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }

  function setSetupEnabled(on) {
    [...spinDirEl.querySelectorAll(".seg-btn"), ...gearEl.querySelectorAll(".seg-btn")]
      .forEach((b) => { b.disabled = !on; });
  }
```

with:

```javascript
  // Reflect the player's current spin direction in the toggle button states.
  function syncSetupControls() {
    spinDirEl.querySelectorAll(".seg-btn").forEach((b) => {
      const on = Number(b.dataset.dir) === playerDir;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }

  function setSetupEnabled(on) {
    spinDirEl.querySelectorAll(".seg-btn").forEach((b) => { b.disabled = !on; });
  }
```

- [ ] **Step 7: Build both beys in `startRound`**

Replace these lines in `startRound`:

```javascript
    rivalDir = Math.random() < 0.5 ? 1 : -1;
    rivalGear = Math.random() < 0.5 ? "high" : "standard";
    player = makeBey("You", stadium.cx - 120, stadium.cy, "#2bf2ff", playerDir);
    opponent = makeBey("Rival", stadium.cx + 120, stadium.cy, "#ff2bd6", rivalDir);
```

with:

```javascript
    rivalDir = Math.random() < 0.5 ? 1 : -1;
    rivalBuild = randomBuild();
    player = makeBey("You", stadium.cx - 120, stadium.cy, "#2bf2ff", playerDir, buildProfile(playerBuild));
    opponent = makeBey("Rival", stadium.cx + 120, stadium.cy, "#ff2bd6", rivalDir, buildProfile(rivalBuild));
```

- [ ] **Step 8: Update the rival readout to show its parts**

Replace `renderRivalSetup`:

```javascript
  function renderRivalSetup() {
    rivalSetupEl.textContent =
      `RIVAL  ${dirLabel(rivalDir)} · ${rivalGear.toUpperCase()} GEAR`;
  }
```

with:

```javascript
  function renderRivalSetup() {
    rivalSetupEl.textContent =
      `RIVAL  ${dirLabel(rivalDir)} · ${rivalBuild.blade.name} / ${rivalBuild.ratchet.name} / ${rivalBuild.bit.name}`;
  }
```

- [ ] **Step 9: Use per-bey launch multiplier and spin0**

In `launchPlayer`, replace:

```javascript
    const angle = (Number(angleEl.value) * Math.PI) / 180;
    const speed = 2 + (power / 100) * 9;
    player.vx = Math.cos(angle) * speed;
    player.vy = Math.sin(angle) * speed;
    player.spin = START_SPIN * (0.6 + 0.4 * (power / 100));
```

with:

```javascript
    const angle = (Number(angleEl.value) * Math.PI) / 180;
    const speed = (2 + (power / 100) * 9) * player.launchMult;
    player.vx = Math.cos(angle) * speed;
    player.vy = Math.sin(angle) * speed;
    player.spin = player.spin0 * (0.6 + 0.4 * (power / 100));
```

and replace the AI launch lines:

```javascript
    const aiSpeed = 6 + Math.random() * 3;
    opponent.vx = Math.cos(aiAngle) * aiSpeed;
    opponent.vy = Math.sin(aiAngle) * aiSpeed;
    opponent.spin = START_SPIN * AI_SPIN_BONUS;
```

with:

```javascript
    const aiSpeed = (6 + Math.random() * 3) * opponent.launchMult;
    opponent.vx = Math.cos(aiAngle) * aiSpeed;
    opponent.vy = Math.sin(aiAngle) * aiSpeed;
    opponent.spin = opponent.spin0;
```

- [ ] **Step 10: Update the special spin caps to per-bey spin0**

In `activateSpecial`, replace `player.spin = Math.min(START_SPIN, player.spin + 10);` with:

```javascript
    player.spin = Math.min(player.spin0, player.spin + 10); // small spin kick
```

In `activateAiSpecial`, replace `opponent.spin = Math.min(START_SPIN * AI_SPIN_BONUS, opponent.spin + 10);` with:

```javascript
    opponent.spin = Math.min(opponent.spin0, opponent.spin + 10);
```

- [ ] **Step 11: Use each bey's own gear in `advanceRail`**

Replace the `advanceRail` signature/lookup. Change:

```javascript
  function advanceRail(bey, foe, gearKey) {
    const gear = GEARS[gearKey];
```

to:

```javascript
  function advanceRail(bey, foe) {
    const gear = bey.gear;
```

And in `loop`, change the two calls:

```javascript
    player = advanceRail(player, oStart, playerGear);
    opponent = advanceRail(opponent, pStart, rivalGear);
```

to:

```javascript
    player = advanceRail(player, oStart);
    opponent = advanceRail(opponent, pStart);
```

- [ ] **Step 12: Remove the gear toggle listener**

Delete this listener block near the end of `mountArena`:

```javascript
  gearEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn || phase !== "ready") return;
    playerGear = btn.dataset.gear;
    syncSetupControls();
  });
```

- [ ] **Step 13: Remove the Gear toggle markup + drop the gear ref**

In `index.html`, delete the Gear control block:

```html
      <div class="ctrl seg">
        <span class="seg-label">Gear</span>
        <div class="seg-btns" id="gear" role="group" aria-label="X-Celerator gear">
          <button type="button" class="seg-btn" data-gear="high" aria-pressed="false">High</button>
          <button type="button" class="seg-btn is-on" data-gear="standard" aria-pressed="true">Standard</button>
        </div>
      </div>
```

In `js/main.js`, delete the `gearEl: $("#gear"),` line from the `mountArena({ ... })` options.

- [ ] **Step 14: Verify parse + tests + run**

Run: `node --check js/arena.js && node --check js/main.js` → exit 0.
Run: `node --test` → 82 pass, 0 fail.
Run: `grep -n "playerGear\|rivalGear\|GEARS\[\|gearEl\|#gear" js/arena.js js/main.js` → no matches.

Open `index.html`, press the red button, launch: the fight runs with a default build vs a random rival (rival parts shown in the readout), the rail still works (gear now from the Bit), and the Gear toggle is gone. Spin toggle still works.

- [ ] **Step 15: Commit**

```bash
git add js/arena.js js/main.js index.html
git commit -m "feat: drive arena beys from build profiles; replace gear toggle with bit xDash"
```

---

## Task 5: Pre-match part picker + HUD images

**Files:**
- Modify: `index.html`, `css/arena.css`, `js/main.js`, `js/arena.js`

- [ ] **Step 1: Add the picker markup + HUD image slots to `index.html`**

In `index.html`, where the Gear toggle used to be (immediately after the Spin `<div class="ctrl seg">` block, before the Angle label), insert the build picker:

```html
      <div class="ctrl build-picker">
        <span class="seg-label">Build</span>
        <div class="build-selects">
          <select id="sel-blade" class="part-select" aria-label="Blade"></select>
          <select id="sel-ratchet" class="part-select" aria-label="Ratchet"></select>
          <select id="sel-bit" class="part-select" aria-label="Bit"></select>
        </div>
        <p id="build-stats" class="build-stats"></p>
      </div>
```

Then add HUD image rows inside the two `.meter` blocks in `.arena-meters`. Change:

```html
      <div class="meter you">
        <span class="meter-label">YOU</span>
        <div class="meter-track"><div id="meter-you" class="meter-fill"></div></div>
      </div>
      <div class="meter rival">
        <span class="meter-label">RIVAL</span>
        <div class="meter-track"><div id="meter-rival" class="meter-fill"></div></div>
      </div>
```

to:

```html
      <div class="meter you">
        <span class="meter-label">YOU</span>
        <div class="meter-track"><div id="meter-you" class="meter-fill"></div></div>
        <div id="build-you" class="build-imgs" aria-hidden="true"></div>
      </div>
      <div class="meter rival">
        <span class="meter-label">RIVAL</span>
        <div class="meter-track"><div id="meter-rival" class="meter-fill"></div></div>
        <div id="build-rival" class="build-imgs" aria-hidden="true"></div>
      </div>
```

- [ ] **Step 2: Add styles to `css/arena.css`**

Append after the existing `.seg-*`/`.rival-setup` rules:

```css
/* Build picker */
.build-picker { gap: 6px; }
.build-selects { display: flex; gap: 6px; }
.part-select { background: #15122b; color: #eaf7ff; border: 1px solid #2bf2ff;
  font-size: 11px; padding: 5px 6px; text-transform: uppercase; letter-spacing: .5px; }
.build-stats { margin: 0; font-size: 11px; letter-spacing: 1px; color: #2bf2ff;
  text-transform: uppercase; min-height: 1em; }

/* Part thumbnails under each spin meter */
.build-imgs { display: flex; gap: 3px; }
.build-img { width: 26px; height: 26px; object-fit: contain;
  background: rgba(255,255,255,.06); border-radius: 4px; }
.meter.rival .build-imgs { flex-direction: row-reverse; }
```

- [ ] **Step 3: Pass the new refs through `main.js`**

In `js/main.js`, add to the `mountArena({ ... })` options:

```javascript
    bladeSelEl: $("#sel-blade"),
    ratchetSelEl: $("#sel-ratchet"),
    bitSelEl: $("#sel-bit"),
    buildStatsEl: $("#build-stats"),
    buildYouEl: $("#build-you"),
    buildRivalEl: $("#build-rival"),
```

- [ ] **Step 4: Destructure the new refs in `arena.js`**

In the `opts` destructure, change:

```javascript
    spinDirEl, rivalSetupEl,
```

to:

```javascript
    spinDirEl, rivalSetupEl,
    bladeSelEl, ratchetSelEl, bitSelEl, buildStatsEl, buildYouEl, buildRivalEl,
```

- [ ] **Step 5: Add the picker + HUD render helpers**

In `js/arena.js`, add these functions right after `setSetupEnabled` (and before `startMatch`):

```javascript
  // ---- build picker + HUD part images ----
  function fillSelect(sel, arr) {
    sel.innerHTML = "";
    arr.forEach((p, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = p.name;
      sel.appendChild(o);
    });
  }

  function renderBuildImages(container, build) {
    container.innerHTML = "";
    [build.blade, build.ratchet, build.bit].forEach((p) => {
      const img = document.createElement("img");
      img.className = "build-img";
      img.src = p.image;
      img.alt = p.name;
      img.title = p.name;
      img.onerror = () => { img.style.visibility = "hidden"; }; // tolerate missing assets
      container.appendChild(img);
    });
  }

  function renderPlayerBuild() {
    const s = combineStats(playerBuild.blade, playerBuild.ratchet, playerBuild.bit);
    buildStatsEl.textContent =
      `ATK ${s.attack} · DEF ${s.defense} · STA ${s.stamina} · X ${s.xDash} · BR ${s.burstResistance}`;
    renderBuildImages(buildYouEl, playerBuild);
  }

  // Rebuild the idle player bey so a part change takes effect before launch.
  function applyPlayerBuild() {
    if (phase !== "ready") return;
    player = makeBey("You", stadium.cx - 120, stadium.cy, "#2bf2ff", playerDir, buildProfile(playerBuild));
    renderPlayerBuild();
    draw();
  }
```

- [ ] **Step 6: Render builds in `startRound`**

In `startRound`, the line added in Task 4 Step 8 (`renderRivalSetup();`) already runs; add the HUD/stat renders next to it. Change the existing block:

```javascript
    setSetupEnabled(true);
    syncSetupControls();
    renderRivalSetup();
    draw();
```

to:

```javascript
    setSetupEnabled(true);
    syncSetupControls();
    renderRivalSetup();
    renderPlayerBuild();
    renderBuildImages(buildRivalEl, rivalBuild);
    draw();
```

- [ ] **Step 7: Disable the selects with the other setup controls**

Update `setSetupEnabled` to also toggle the selects:

```javascript
  function setSetupEnabled(on) {
    spinDirEl.querySelectorAll(".seg-btn").forEach((b) => { b.disabled = !on; });
  }
```

becomes:

```javascript
  function setSetupEnabled(on) {
    spinDirEl.querySelectorAll(".seg-btn").forEach((b) => { b.disabled = !on; });
    [bladeSelEl, ratchetSelEl, bitSelEl].forEach((s) => { s.disabled = !on; });
  }
```

- [ ] **Step 8: Wire the selects + initial population**

At the end of `mountArena`, just before `syncSetupControls();` and `return { open, close };`, add:

```javascript
  // populate the part dropdowns once and wire change handlers
  fillSelect(bladeSelEl, BLADES);
  fillSelect(ratchetSelEl, RATCHETS);
  fillSelect(bitSelEl, BITS);
  bladeSelEl.addEventListener("change", () => {
    if (phase !== "ready") return;
    playerBuild = { ...playerBuild, blade: BLADES[Number(bladeSelEl.value)] };
    applyPlayerBuild();
  });
  ratchetSelEl.addEventListener("change", () => {
    if (phase !== "ready") return;
    playerBuild = { ...playerBuild, ratchet: RATCHETS[Number(ratchetSelEl.value)] };
    applyPlayerBuild();
  });
  bitSelEl.addEventListener("change", () => {
    if (phase !== "ready") return;
    playerBuild = { ...playerBuild, bit: BITS[Number(bitSelEl.value)] };
    applyPlayerBuild();
  });
```

- [ ] **Step 9: Verify parse + tests + playtest**

Run: `node --check js/arena.js && node --check js/main.js` → exit 0.
Run: `node --test` → 82 pass, 0 fail.

Open `index.html`, press the red button, and confirm:
- Three dropdowns (Blade / Ratchet / Bit) appear with part names; a stats line shows ATK/DEF/STA/X/BR and updates when you change a part.
- The part **images** show under your spin meter (you) and the rival's meter, updating each round / on change. Missing images simply don't show (no broken-image icon).
- Changing a part before launch changes how the bey fights (e.g. a high-stamina bit lasts longer; high-attack drains the rival faster); the dropdowns disable on launch and re-enable next round.
- The rival's parts appear in the rival readout and vary each match.

- [ ] **Step 10: Commit**

```bash
git add index.html css/arena.css js/main.js js/arena.js
git commit -m "feat: in-arena Blade/Ratchet/Bit picker with stats readout and HUD part images"
```

---

## Task 6: Final verification

- [ ] **Step 1: Full test run**

Run: `node --test`
Expected: `# pass 82`, `# fail 0`.

- [ ] **Step 2: Parse all modules**

Run: `node --check js/build.js && node --check js/parts.js && node --check js/physics.js && node --check js/arena.js && node --check js/sound.js && node --check js/main.js`
Expected: no output (exit 0).

- [ ] **Step 3: No stale gear references**

Run: `grep -rn "playerGear\|rivalGear\|GEARS\[\|data-gear\|#gear\b" js/ index.html`
Expected: no matches.

- [ ] **Step 4: Playtest the whole loop**

Open `index.html`, press the red button, and run a full best-of-3: pick a build, launch, watch the rail/clashes reflect the build, confirm the rival re-rolls each match, and that an average build still feels close to the previous game.

- [ ] **Step 5: Tuning pass (optional, after playtest)**

If some build is degenerate (e.g. max-stamina stalls forever, or max-attack one-shots), adjust the bounds in `js/build.js` (`SUM_LO/SUM_HI`, the lerp coefficients) and re-run `node --test`; commit separately.

---

## Notes for the implementer

- **Backward-compatible physics:** the new bey fields (`atkMult`, `defMult`, `spinDecayMult`, `centeringMult`) all default to 1 in the pure functions, so the existing physics tests pass unchanged and a build-less bey behaves exactly as before.
- **build.js is tested with synthetic fixtures**, not the vendored data, so Task 1 doesn't depend on Task 3.
- **Missing images are non-fatal:** the HUD `<img>` uses an `onerror` handler that hides the image, so the feature works even if some part assets fail to download.
- **Per-bey gear:** the rail gear now lives on each bey (`bey.gear`, from the Bit's xDash); `advanceRail` reads it directly, so there's no global gear table anymore.
- **spin0 vs START_SPIN:** beys can start above the old 100 (up to 120), so the spin meters divide by each bey's own `spin0`. `START_SPIN` remains only as the makeBey fallback and the spin-hum reference.
