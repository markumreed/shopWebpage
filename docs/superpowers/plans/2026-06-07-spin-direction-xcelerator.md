# Spin Direction + X-Celerator Gear System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pre-match left/right spin choice with spin-steal drain mechanics, an X-Celerator rail ring that triggers an Xtreme Dash, and a High/Standard gear choice that scales the dash — for both the player and the rival.

**Architecture:** Pure, unit-tested mechanics live in `js/physics.js` (spin-steal drain in `resolveCollision`, a new `tryXtremeDash` helper). All DOM/canvas/game-feel wiring lives in `js/arena.js`, with a new procedural sound in `js/sound.js`, markup in `index.html`, styles in `css/arena.css`, and element wiring in `js/main.js`. New tuning values are named constants.

**Tech Stack:** Vanilla ES modules, HTML5 canvas, Web Audio API, Node's built-in test runner (`node --test`).

---

## File Structure

- `js/physics.js` — **modify**: factor spin direction into `resolveCollision` drain; **add** pure `tryXtremeDash(bey, stadium, rail, gear)`.
- `tests/physics.test.js` — **modify**: add tests for spin-steal drain and `tryXtremeDash`.
- `js/sound.js` — **modify**: add `xtreme()` SFX.
- `index.html` — **modify**: add `#spin-dir` and `#gear` segmented toggles and a `#rival-setup` readout to `.arena-controls`.
- `css/arena.css` — **modify**: styles for segmented toggles and the rival readout.
- `js/arena.js` — **modify**: store/apply player `spinDir`+`gear`; randomize rival's each round; direction-aware rotation; draw the rail; per-frame dash with visuals + cooldown; wire/enable/disable controls; render the rival readout.
- `js/main.js` — **modify**: pass the three new element refs into `mountArena`.

---

## Task 1: Spin-steal drain in `resolveCollision` (pure)

**Files:**
- Modify: `js/physics.js` (the `resolveCollision` function, ~lines 34–84)
- Test: `tests/physics.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/physics.test.js` (after the existing `resolveCollision` tests, before the `import { aiSteer }` line at ~line 120):

```javascript
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test 2>&1 | grep -E "spin-steal|same spin|default to same-spin|# fail"`
Expected: the two new behavior tests fail (drain still a flat 5, so spins are 45 not 40/47.5). The "default to same-spin" test already passes (legacy path).

- [ ] **Step 3: Implement the spin-steal drain**

In `js/physics.js`, change the destructure at the top of `resolveCollision`:

```javascript
export function resolveCollision(a, b, params) {
  const {
    restitution, collisionSpinDrain, superDrain = 0,
    oppositeSpinMult = 1, sameSpinMult = 1,
  } = params;
```

Then replace the two "both lose spin on contact" lines:

```javascript
  // both lose spin on contact
  a2.spin = Math.max(0, a.spin - collisionSpinDrain);
  b2.spin = Math.max(0, b.spin - collisionSpinDrain);
```

with direction-aware drain (default dir = +1 so beys without the field behave as same-spin):

```javascript
  // both lose spin on contact; opposite spin directions "spin-steal" — they
  // drain harder than same-spin clashes. Beys without a `dir` default to +1.
  const sameDir = (a.dir ?? 1) === (b.dir ?? 1);
  const drain = collisionSpinDrain * (sameDir ? sameSpinMult : oppositeSpinMult);
  a2.spin = Math.max(0, a.spin - drain);
  b2.spin = Math.max(0, b.spin - drain);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test`
Expected: PASS — all prior 44 tests plus the 3 new ones (47 total). The legacy `collisionSpinDrain: 5` tests still drain exactly 5 because `sameSpinMult`/`oppositeSpinMult` default to 1.

- [ ] **Step 5: Commit**

```bash
git add js/physics.js tests/physics.test.js
git commit -m "feat: spin-steal drain — opposite spin directions drain harder"
```

---

## Task 2: `tryXtremeDash` pure helper

**Files:**
- Modify: `js/physics.js` (add new exported function)
- Test: `tests/physics.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/physics.test.js` (after the `decideOutcome` tests at the end of the file):

```javascript
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test 2>&1 | grep -E "tryXtremeDash|# fail"`
Expected: FAIL — `tryXtremeDash is not a function` / import error.

- [ ] **Step 3: Implement `tryXtremeDash`**

Append to `js/physics.js` (after `decideOutcome`):

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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test`
Expected: PASS — all prior tests plus the 6 new `tryXtremeDash` tests (53 total).

- [ ] **Step 5: Commit**

```bash
git add js/physics.js tests/physics.test.js
git commit -m "feat: tryXtremeDash — X-Celerator rail engagement physics"
```

---

## Task 3: `xtreme()` sound effect

**Files:**
- Modify: `js/sound.js`

- [ ] **Step 1: Add the SFX**

In `js/sound.js`, add after the `special()` function (~line 101):

```javascript
// Xtreme Dash — a fast upward rev with a whoosh as the bit-gear meshes.
export function xtreme() {
  blip("sawtooth", 220, 0.3, 0.26, { glideTo: 1200 });
  blip("square", 440, 0.22, 0.12, { glideTo: 1600, delay: 0.02 });
  noise(0.28, 0.14, 2600, 1.2);
}
```

- [ ] **Step 2: Verify it parses**

Run: `node --check js/sound.js`
Expected: no output (exit 0).

- [ ] **Step 3: Commit**

```bash
git add js/sound.js
git commit -m "feat: procedural xtreme dash sound effect"
```

---

## Task 4: Pre-match controls markup + styles

**Files:**
- Modify: `index.html` (the `.arena-controls` block, ~lines 174–190)
- Modify: `css/arena.css` (after the `.power-fill` rule, ~line 67)

- [ ] **Step 1: Add the controls to `index.html`**

In `index.html`, inside `<div class="arena-controls">`, insert these two control groups immediately AFTER the opening `<div class="arena-controls">` and BEFORE the existing `<label class="ctrl">Angle` line:

```html
      <div class="ctrl seg">
        <span class="seg-label">Spin</span>
        <div class="seg-btns" id="spin-dir" role="group" aria-label="Spin direction">
          <button type="button" class="seg-btn is-on" data-dir="1" aria-pressed="true">↻&nbsp;Right</button>
          <button type="button" class="seg-btn" data-dir="-1" aria-pressed="false">↺&nbsp;Left</button>
        </div>
      </div>
      <div class="ctrl seg">
        <span class="seg-label">Gear</span>
        <div class="seg-btns" id="gear" role="group" aria-label="X-Celerator gear">
          <button type="button" class="seg-btn" data-gear="high" aria-pressed="false">High</button>
          <button type="button" class="seg-btn is-on" data-gear="standard" aria-pressed="true">Standard</button>
        </div>
      </div>
```

Then, immediately AFTER the closing `</div>` of `.arena-controls` and BEFORE `<p id="arena-rules"`, add the rival readout:

```html
    <p id="rival-setup" class="rival-setup"></p>
```

- [ ] **Step 2: Add styles to `css/arena.css`**

In `css/arena.css`, add after the `.power-fill` line (~line 67):

```css
/* Pre-match segmented toggles (spin direction, X-Celerator gear) */
.ctrl.seg { gap: 6px; }
.seg-label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
.seg-btns { display: flex; border: 1px solid #2bf2ff; }
.seg-btn { background: #15122b; color: rgba(234,247,255,.8); border: 0;
  padding: 8px 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;
  font-size: 12px; cursor: pointer; }
.seg-btn + .seg-btn { border-left: 1px solid #2bf2ff; }
.seg-btn.is-on { background: #2bf2ff; color: #07060f; }
.seg-btn:disabled { cursor: default; opacity: .5; }

/* Rival's rolled spin + gear for the round */
.rival-setup { text-align: center; font-size: 12px; letter-spacing: 1px;
  text-transform: uppercase; color: #ff2bd6; margin: 0; min-height: 1em;
  text-shadow: 0 0 10px rgba(255,43,214,.5); }
```

- [ ] **Step 3: Verify the page still loads**

Run: `node --check js/main.js` (sanity that nothing else broke) and open `index.html` in a browser, press the red "DO NOT PRESS" button. Expected: the arena opens and shows two new toggles (Spin: Right/Left, Gear: High/Standard) with Right and Standard highlighted, plus an empty rival readout line. They do nothing yet — wired in Task 6.

- [ ] **Step 4: Commit**

```bash
git add index.html css/arena.css
git commit -m "feat: pre-match spin direction + gear toggles and rival readout markup"
```

---

## Task 5: Pass the new element refs through `main.js`

**Files:**
- Modify: `js/main.js` (the `mountArena({...})` call, ~lines 169–188)

- [ ] **Step 1: Add the three refs**

In `js/main.js`, inside the `mountArena({ ... })` options object, add these lines (e.g. after `muteEl: $("#arena-mute"),`):

```javascript
    spinDirEl: $("#spin-dir"),
    gearEl: $("#gear"),
    rivalSetupEl: $("#rival-setup"),
```

- [ ] **Step 2: Verify it parses**

Run: `node --check js/main.js`
Expected: no output (exit 0).

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "chore: pass spin/gear/rival-setup elements into mountArena"
```

---

## Task 6: Wire spin direction + gear into the arena

**Files:**
- Modify: `js/arena.js`

This task wires everything together. Work through the sub-edits in order.

- [ ] **Step 1: Import `tryXtremeDash` and add tuning constants**

In `js/arena.js`, update the physics import (line 3) to include `tryXtremeDash`:

```javascript
import { stepBey, resolveCollision, decideOutcome, distance, aiSteer, tryXtremeDash } from "./physics.js";
```

Update the `COLLISION` constant (line 8) to add the spin-steal multipliers:

```javascript
const COLLISION = { restitution: 1.05, collisionSpinDrain: 1.5, superDrain: 25, oppositeSpinMult: 2.2, sameSpinMult: 0.7 };
```

Add new constants after `STREAK_KEY` (~line 14):

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

- [ ] **Step 2: Destructure the new elements and add state**

In `mountArena`, add to the destructured `opts` (after `muteEl,`):

```javascript
    spinDirEl, gearEl, rivalSetupEl,
```

After the line `const stadium = { cx: W / 2, cy: H / 2, r: W / 2 - 16 };` add the absolute rail geometry:

```javascript
  const rail = {
    inner: stadium.r * RAIL.innerFrac,
    outer: stadium.r * RAIL.outerFrac,
    cooldown: RAIL.cooldown,
  };
```

Extend the `let` state declarations (the block near `let player, opponent, ...`) by adding a new line:

```javascript
  let playerDir = 1, playerGear = "standard", rivalDir = 1, rivalGear = "standard";
```

- [ ] **Step 3: Update `makeBey` to carry `dir` and `dashCd`**

Replace the `makeBey` function (~lines 16–23) with:

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

- [ ] **Step 4: Add setup-control helpers**

Add these functions inside `mountArena` (e.g. right after the `updateMeters` function):

```javascript
  // ---- pre-match setup controls (spin direction + gear) ----
  function dirLabel(dir) { return dir === 1 ? "↻ RIGHT" : "↺ LEFT"; }

  function renderRivalSetup() {
    rivalSetupEl.textContent =
      `RIVAL  ${dirLabel(rivalDir)} · ${rivalGear.toUpperCase()} GEAR`;
  }

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

- [ ] **Step 5: Randomize the rival + apply choices in `startRound`**

In `startRound`, replace the two `makeBey(...)` lines:

```javascript
    player = makeBey("You", stadium.cx - 120, stadium.cy, "#2bf2ff");
    opponent = makeBey("Rival", stadium.cx + 120, stadium.cy, "#ff2bd6");
```

with (roll the rival's setup first, then build both beys with their directions):

```javascript
    rivalDir = Math.random() < 0.5 ? 1 : -1;
    rivalGear = Math.random() < 0.5 ? "high" : "standard";
    player = makeBey("You", stadium.cx - 120, stadium.cy, "#2bf2ff", playerDir);
    opponent = makeBey("Rival", stadium.cx + 120, stadium.cy, "#ff2bd6", rivalDir);
```

Then, near the end of `startRound` (just before the final `draw();` call), add:

```javascript
    setSetupEnabled(true);
    syncSetupControls();
    renderRivalSetup();
```

- [ ] **Step 6: Lock the controls at launch**

In `launchPlayer`, after the line `phase = "spinning";`, add:

```javascript
    setSetupEnabled(false);
```

(The player's `dir` is already baked into the bey at `startRound` via `playerDir`; the gear is read live from `playerGear` in the loop.)

- [ ] **Step 7: Make rotation direction-aware in `spinVisuals`**

In `spinVisuals`, replace the rotation line:

```javascript
  b.rot += 0.25 + frac * 0.9;          // angular speed scales with spin
```

with:

```javascript
  b.rot += (b.dir ?? 1) * (0.25 + frac * 0.9); // direction-aware angular speed
```

- [ ] **Step 8: Integrate the dash into the main loop**

In `loop`, immediately AFTER these two lines:

```javascript
    player = stepBey(player, stadium, STADIUM_PARAMS);
    opponent = stepBey(opponent, stadium, STADIUM_PARAMS);
```

insert the cooldown tick + dash checks:

```javascript
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

- [ ] **Step 9: Add the dash visual/audio reaction**

Add this function inside `mountArena` (e.g. right after the `onImpact` function):

```javascript
  // Xtreme Dash reaction: trailing afterimage along the heading + callout + sfx.
  function onXtremeDash(b) {
    const speed = Math.hypot(b.vx, b.vy) || 1;
    const ux = b.vx / speed, uy = b.vy / speed;
    for (let i = 1; i <= 3; i++) spawnBurst(b.x - ux * i * 14, b.y - uy * i * 14, b.color);
    showCallout("XTREME DASH!");
    triggerShake("sm");
    sfx.xtreme();
  }
```

- [ ] **Step 10: Draw the rail ring**

In `draw`, AFTER the concentric guide-rings `for` loop and BEFORE the `// stadium rim` block, insert:

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
    ctx.restore();
    ctx.setLineDash([]);
```

- [ ] **Step 11: Initialize controls on mount**

At the very end of `mountArena`, just before `return { open, close };`, add the listeners and an initial sync:

```javascript
  // pre-match toggles — only editable while a round hasn't launched
  spinDirEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn || phase !== "ready") return;
    playerDir = Number(btn.dataset.dir);
    if (player) player.dir = playerDir; // reflect on the idle pre-launch bey
    syncSetupControls();
    draw();
  });
  gearEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn || phase !== "ready") return;
    playerGear = btn.dataset.gear;
    syncSetupControls();
  });
  syncSetupControls();
```

- [ ] **Step 12: Run the unit tests (regression check)**

Run: `node --test`
Expected: PASS — all 53 tests still pass (arena.js is not unit-tested, but physics/match must remain green).

- [ ] **Step 13: Verify parse**

Run: `node --check js/arena.js`
Expected: no output (exit 0).

- [ ] **Step 14: Playtest in the browser**

Open `index.html`, press the red button, and confirm:
- The **Spin** toggle flips between Right/Left; with Left selected the bey visibly rotates the other way.
- The **Gear** toggle flips between High/Standard.
- Both toggles are disabled (dimmed) once you launch, and re-enabled on the next round.
- The **rival readout** shows e.g. `RIVAL ↻ RIGHT · HIGH GEAR` and re-rolls each round.
- A bright dashed **rail ring** is visible on the floor.
- When a bey rides the rail at speed it produces an **XTREME DASH!** callout, a trailing burst, a small shake, and the dash sound; it does not fire continuously (cooldown).
- Opposite-spin matchups end faster (more spin-out) than same-spin ones.

- [ ] **Step 15: Commit**

```bash
git add js/arena.js
git commit -m "feat: wire spin direction, X-Celerator rail dash, and gear system into arena"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full test run**

Run: `node --test`
Expected: `# pass 53`, `# fail 0`.

- [ ] **Step 2: Parse all modules**

Run: `node --check js/physics.js && node --check js/arena.js && node --check js/sound.js && node --check js/main.js`
Expected: no output (exit 0 for all).

- [ ] **Step 3: Tuning pass (optional, after playtest)**

If the dash fires too often or too rarely, adjust `RAIL.cooldown`, `GEARS.*.engageSpeed`, or `GEARS.*.dashImpulse` in `js/arena.js`. If spin-steal feels too punishing, adjust `COLLISION.oppositeSpinMult` / `COLLISION.sameSpinMult`. Re-run `node --test` after any change and commit separately.

---

## Notes for the implementer

- **Why defaults of 1 on the spin multipliers and `dir`:** the existing 44 tests call `resolveCollision` with neither multiplier and beys with no `dir`. Defaulting both multipliers and `dir` to 1 keeps that legacy drain at exactly `collisionSpinDrain`, so nothing regresses.
- **State spread preserves new fields:** `stepBey` returns `{ ...bey, ... }`, so `dir` and `dashCd` survive each physics step without extra plumbing.
- **The dash reads gear live:** the player can change gear right up until launch; the loop looks up `GEARS[playerGear]` each frame, so the latest choice always applies.
- **No DOM tests:** matching the existing project convention, `arena.js` is verified by playtest (Task 6 Step 14), while all pure logic is unit-tested.
