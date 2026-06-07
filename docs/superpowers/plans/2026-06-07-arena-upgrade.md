# Arena Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the hidden Beyblade arena's win conditions clear and add round structure plus game-feel juice — live spin meters, a rules panel, win-reason banners, best-of-3 rounds, a scoreboard, a win streak, a burst-special mechanic, impact callouts, and scaled screen-shake.

**Architecture:** Preserve the existing pure/presentation split. New pure module `js/match.js` owns round/score/streak state (TDD'd). `js/physics.js` gains an optional special spin-drain (TDD'd). All DOM/canvas wiring goes in `js/arena.js`, with new markup in `index.html` and styles in `css/arena.css`. `js/main.js` passes the new DOM elements into `mountArena`.

**Tech Stack:** Vanilla ES modules, HTML5 canvas, CSS. Tests run with `node --test` (built-in test runner, `node:test` + `node:assert/strict`).

**Spec:** `docs/superpowers/specs/2026-06-07-arena-upgrade-design.md`

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `js/match.js` | Pure best-of-3 round/score/streak transitions | Create |
| `tests/match.test.js` | Unit tests for `match.js` | Create |
| `js/physics.js` | Pure physics; add optional `superDrain` to `resolveCollision` | Modify |
| `tests/physics.test.js` | Add special-drain cases | Modify |
| `index.html` | Arena markup: meters, scoreboard, rules, SPECIAL/Next Round, callout | Modify |
| `css/arena.css` | Style new elements + shake tiers | Modify |
| `js/arena.js` | Game loop, meters, round flow, special, callouts, shake, streak | Replace |
| `js/main.js` | Pass new DOM elements into `mountArena` | Modify |

---

## Task 1: Pure match-state module (`match.js`)

**Files:**
- Create: `js/match.js`
- Test: `tests/match.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/match.test.js`:

```js
// tests/match.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { newMatch, recordRound, WIN_TARGET } from "../js/match.js";

test("WIN_TARGET is 2 (best-of-3)", () => {
  assert.equal(WIN_TARGET, 2);
});

test("newMatch starts at round 1, 0-0, not over", () => {
  const m = newMatch();
  assert.equal(m.round, 1);
  assert.equal(m.you, 0);
  assert.equal(m.rival, 0);
  assert.equal(m.streak, 0);
  assert.equal(m.matchOver, false);
  assert.equal(m.matchWinner, null);
});

test("newMatch carries an incoming streak", () => {
  assert.equal(newMatch(3).streak, 3);
});

test("recordRound('player') scores you and advances the round", () => {
  const m = recordRound(newMatch(), "player");
  assert.equal(m.you, 1);
  assert.equal(m.rival, 0);
  assert.equal(m.round, 2);
  assert.equal(m.matchOver, false);
});

test("recordRound('draw') changes nothing and keeps the round", () => {
  const start = newMatch();
  const m = recordRound(start, "draw");
  assert.equal(m.you, 0);
  assert.equal(m.rival, 0);
  assert.equal(m.round, 1);
  assert.equal(m.matchOver, false);
});

test("reaching 2 player wins ends the match and increments streak", () => {
  let m = newMatch(1);
  m = recordRound(m, "player");
  m = recordRound(m, "player");
  assert.equal(m.you, 2);
  assert.equal(m.matchOver, true);
  assert.equal(m.matchWinner, "player");
  assert.equal(m.streak, 2);
});

test("reaching 2 rival wins ends the match and resets streak to 0", () => {
  let m = newMatch(5);
  m = recordRound(m, "opponent");
  m = recordRound(m, "opponent");
  assert.equal(m.rival, 2);
  assert.equal(m.matchOver, true);
  assert.equal(m.matchWinner, "opponent");
  assert.equal(m.streak, 0);
});

test("recordRound after match over returns state unchanged", () => {
  let m = newMatch();
  m = recordRound(m, "player");
  m = recordRound(m, "player"); // match over
  const after = recordRound(m, "player");
  assert.deepEqual(after, m);
});

test("recordRound does not mutate the input state", () => {
  const start = newMatch();
  recordRound(start, "player");
  assert.equal(start.you, 0);
  assert.equal(start.round, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/match.test.js`
Expected: FAIL — cannot find module `../js/match.js`.

- [ ] **Step 3: Write the implementation**

Create `js/match.js`:

```js
// js/match.js — pure best-of-3 round/score/streak state. No DOM, no canvas.

// First to this many round wins takes the match.
export const WIN_TARGET = 2;

// Fresh match state. `streak` carries the player's current match-win streak.
export function newMatch(streak = 0) {
  return { round: 1, you: 0, rival: 0, streak, matchOver: false, matchWinner: null };
}

// Apply a round outcome and return a NEW state (input is never mutated).
// outcome: "player" | "opponent" | "draw"
//   - "draw": no score change, same round replays.
//   - otherwise: the winner's tally increments and the round advances.
// When a side reaches WIN_TARGET the match ends: matchOver=true, matchWinner set,
// and the streak increments on a player match win or resets to 0 on a loss.
export function recordRound(state, outcome) {
  if (state.matchOver) return state;
  if (outcome === "draw") return { ...state };

  const you = state.you + (outcome === "player" ? 1 : 0);
  const rival = state.rival + (outcome === "opponent" ? 1 : 0);

  const matchOver = you >= WIN_TARGET || rival >= WIN_TARGET;
  const matchWinner = matchOver ? (you >= WIN_TARGET ? "player" : "opponent") : null;
  const streak = matchOver
    ? (matchWinner === "player" ? state.streak + 1 : 0)
    : state.streak;
  const round = matchOver ? state.round : state.round + 1;

  return { round, you, rival, streak, matchOver, matchWinner };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/match.test.js`
Expected: PASS — all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/match.js tests/match.test.js
git commit -m "feat: pure best-of-3 match state module"
```

---

## Task 2: Special spin-drain in `physics.js`

**Files:**
- Modify: `js/physics.js:34-79` (`resolveCollision`)
- Test: `tests/physics.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/physics.test.js` (after the existing `resolveCollision` tests, before the `decideOutcome` import block):

```js
test("resolveCollision: a bey with special drains extra spin from the other", () => {
  const a = bey({ x: -5, y: 0, spin: 50, special: true });
  const b = bey({ x: 5, y: 0, spin: 50 });
  const [a2, b2] = resolveCollision(a, b, { restitution: 1, collisionSpinDrain: 5, superDrain: 20 });
  assert.equal(a2.spin, 45);        // attacker loses only the normal drain
  assert.equal(b2.spin, 25);        // defender loses normal drain + superDrain
  assert.equal(a2.special, false);  // special is one-shot: flag is consumed
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/physics.test.js`
Expected: FAIL — new tests fail (no `superDrain` handling; `a2.special` is `true`, not `false`).

- [ ] **Step 3: Modify `resolveCollision`**

In `js/physics.js`, change the destructure on line 35 from:

```js
  const { restitution, collisionSpinDrain } = params;
```

to:

```js
  const { restitution, collisionSpinDrain, superDrain = 0 } = params;
```

Then replace the spin-drain block (currently lines 74-78):

```js
  // both lose spin on contact
  a2.spin = Math.max(0, a.spin - collisionSpinDrain);
  b2.spin = Math.max(0, b.spin - collisionSpinDrain);

  return [a2, b2];
```

with:

```js
  // both lose spin on contact
  a2.spin = Math.max(0, a.spin - collisionSpinDrain);
  b2.spin = Math.max(0, b.spin - collisionSpinDrain);

  // special attack: a bey with `special` set drains extra spin from the other,
  // then its flag clears (one-shot).
  if (a.special) { b2.spin = Math.max(0, b2.spin - superDrain); a2.special = false; }
  if (b.special) { a2.spin = Math.max(0, a2.spin - superDrain); b2.special = false; }

  return [a2, b2];
```

- [ ] **Step 4: Run the full test suite to verify everything passes**

Run: `node --test`
Expected: PASS — all physics tests (including the 3 new ones and the unchanged `collisionSpinDrain` test), match tests, and cart tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/physics.js tests/physics.test.js
git commit -m "feat: optional special spin-drain in resolveCollision"
```

---

## Task 3: Arena markup (`index.html`)

**Files:**
- Modify: `index.html:147-165` (the `#arena` overlay block)

- [ ] **Step 1: Replace the arena overlay markup**

In `index.html`, replace the entire arena overlay block (lines 146-165, from `<!-- ARENA OVERLAY ... -->` through the closing `</div>` of `#arena`) with:

```html
  <!-- ARENA OVERLAY (hidden until red button) -->
  <div id="arena" class="arena" hidden>
    <div class="arena-hud">
      <div class="arena-title">BEYBLADE <span>ARENA</span></div>
      <div class="arena-score">
        <span class="score-side you">YOU <span id="score-you" class="pips"></span></span>
        <span id="score-streak" class="score-streak">🔥 0</span>
        <span class="score-side rival"><span id="score-rival" class="pips"></span> RIVAL</span>
      </div>
      <button id="arena-exit" class="arena-exit">Exit to Shop</button>
    </div>

    <div class="arena-meters">
      <div class="meter you">
        <span class="meter-label">YOU</span>
        <div class="meter-track"><div id="meter-you" class="meter-fill"></div></div>
      </div>
      <div class="meter rival">
        <span class="meter-label">RIVAL</span>
        <div class="meter-track"><div id="meter-rival" class="meter-fill"></div></div>
      </div>
    </div>

    <canvas id="arena-canvas" class="arena-canvas" width="720" height="720"></canvas>

    <div class="arena-controls">
      <label class="ctrl">Angle
        <input id="angle" type="range" min="0" max="360" value="45" />
      </label>
      <div class="power-wrap">
        <div class="power-label">Power</div>
        <div class="power-track"><div id="power-fill" class="power-fill"></div></div>
      </div>
      <div class="power-wrap">
        <div class="power-label">Burst</div>
        <div class="power-track"><div id="burst-fill" class="burst-fill"></div></div>
      </div>
      <button id="launch" class="btn-launch">HOLD&nbsp;TO&nbsp;CHARGE</button>
      <button id="special" class="btn-special" disabled>SPECIAL</button>
      <button id="next-round" class="btn-primary" hidden>Next Round</button>
      <button id="rematch" class="btn-primary" hidden>Rematch</button>
    </div>

    <p id="arena-rules" class="arena-rules">
      Knock the rival out of the ring (<b>RING&nbsp;OUT</b>) or outspin them
      (<b>SPIN&nbsp;OUT</b>). First to <b>2</b> round wins takes the match.
    </p>

    <div id="arena-callout" class="arena-callout" hidden></div>
    <div id="arena-banner" class="arena-banner" hidden></div>
  </div>
```

- [ ] **Step 2: Verify the page still loads without script errors**

Run: `open index.html` (or your usual local-serve command), open the browser console.
Expected: page renders; no console errors. (The new buttons won't be wired until Task 5 — that's fine; clicking the red button may error until then. Don't fix here.)

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: arena markup for meters, scoreboard, rules, special"
```

---

## Task 4: Arena styling (`css/arena.css`)

**Files:**
- Modify: `css/arena.css` (replace the single `.shake` rule; append new rules)

- [ ] **Step 1: Replace the single shake rule with three tiers**

In `css/arena.css`, replace lines 8-15 (the `@keyframes screen-shake` block and the `.shake` rule) with:

```css
@keyframes shake-sm {
  0%,100% { transform: translate(0,0); }
  33% { transform: translate(-3px, 2px); }
  66% { transform: translate(3px, -2px); }
}
@keyframes shake-md {
  0%,100% { transform: translate(0,0); }
  20% { transform: translate(-8px, 6px); }
  40% { transform: translate(7px, -7px); }
  60% { transform: translate(-6px, -5px); }
  80% { transform: translate(6px, 7px); }
}
@keyframes shake-lg {
  0%,100% { transform: translate(0,0); }
  15% { transform: translate(-16px, 10px); }
  30% { transform: translate(14px, -14px); }
  45% { transform: translate(-13px, -10px); }
  60% { transform: translate(13px, 12px); }
  75% { transform: translate(-10px, 8px); }
  90% { transform: translate(9px, -9px); }
}
.shake-sm { animation: shake-sm .28s linear; }
.shake-md { animation: shake-md .45s linear; }
.shake-lg { animation: shake-lg .6s linear; }
```

- [ ] **Step 2: Append styling for the new elements**

Append to the end of `css/arena.css`:

```css
/* Scoreboard in the HUD */
.arena-score { display: flex; align-items: center; gap: 16px; font-weight: 800;
  text-transform: uppercase; letter-spacing: 1px; font-size: 14px; }
.score-side.you { color: #2bf2ff; }
.score-side.rival { color: #ff2bd6; }
.pips { letter-spacing: 2px; }
.score-streak { color: #ffd64a; text-shadow: 0 0 12px rgba(255,214,74,.7); }

/* Spin meters above the canvas */
.arena-meters { display: flex; gap: 18px; width: min(72vmin, 720px); }
.meter { flex: 1; display: flex; align-items: center; gap: 8px; }
.meter.rival { flex-direction: row-reverse; }
.meter-label { font-size: 11px; font-weight: 800; letter-spacing: 1px; }
.meter.you .meter-label { color: #2bf2ff; }
.meter.rival .meter-label { color: #ff2bd6; }
.meter-track { flex: 1; height: 12px; background: #15122b; border: 1px solid rgba(234,247,255,.3); overflow: hidden; }
.meter-fill { height: 100%; width: 100%; transition: width .08s linear; }
.meter.you .meter-fill { background: linear-gradient(90deg, #0a6, #2bf2ff); }
.meter.rival .meter-fill { background: linear-gradient(270deg, #a04, #ff2bd6); }

/* Burst meter reuses the power-track shell with its own fill color */
.burst-fill { width: 0%; height: 100%; background: linear-gradient(90deg, #ffd64a, #ff7a1a); transition: width .1s linear; }

/* SPECIAL button */
.btn-special { background: #1a1140; color: #ffd64a; border: 1.5px solid #ffd64a;
  padding: 14px 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;
  cursor: pointer; }
.btn-special:disabled { opacity: .4; cursor: default; }
.btn-special.ready { animation: special-pulse 1s ease-in-out infinite;
  box-shadow: 0 0 22px rgba(255,214,74,.8); }
@keyframes special-pulse {
  0%,100% { transform: scale(1); box-shadow: 0 0 16px rgba(255,214,74,.6); }
  50% { transform: scale(1.06); box-shadow: 0 0 30px rgba(255,214,74,1); }
}

/* Rules blurb */
.arena-rules { max-width: 540px; text-align: center; font-size: 13px; line-height: 1.5;
  color: rgba(234,247,255,.8); margin: 0; }
.arena-rules b { color: #ffd64a; }

/* Impact callout — brief floating text */
.arena-callout { position: absolute; top: 32%; left: 0; right: 0; text-align: center;
  pointer-events: none; font-family: var(--display, sans-serif); font-style: italic;
  text-transform: uppercase; font-size: clamp(28px, 6vw, 64px); font-weight: 900;
  color: #ffd64a; text-shadow: 0 0 18px #ff7a1a, 0 0 36px #ff2bd6;
  animation: callout-pop .35s ease-out; }
.arena-callout[hidden] { display: none; }
@keyframes callout-pop { from { transform: scale(.4) rotate(-4deg); opacity: 0; }
  to { transform: scale(1) rotate(-4deg); opacity: 1; } }
```

- [ ] **Step 3: Verify styles load**

Run: reload `index.html` in the browser.
Expected: meters render as empty/full bars above the canvas, scoreboard shows in the HUD, SPECIAL button appears disabled/dim, rules text reads below the controls. No layout overflow.

- [ ] **Step 4: Commit**

```bash
git add css/arena.css
git commit -m "feat: arena styles for meters, scoreboard, special, callouts, shake tiers"
```

---

## Task 5: Wire it all up (`arena.js` + `main.js`)

This task is presentation/integration code (DOM + canvas), verified manually like the rest of `arena.js` — there are no unit tests for this layer in the repo. It depends on Tasks 1-4.

**Files:**
- Replace: `js/arena.js`
- Modify: `js/main.js:169-178` (`mountArena` call)

- [ ] **Step 1: Replace `js/arena.js` entirely**

Replace the full contents of `js/arena.js` with:

```js
// arena.js — canvas battle. Pure physics comes from physics.js; round/score
// state comes from match.js. This file is all DOM/canvas wiring + game feel.
import { stepBey, resolveCollision, decideOutcome, distance } from "./physics.js";
import { newMatch, recordRound, WIN_TARGET } from "./match.js";

const STADIUM_PARAMS = { dt: 1, friction: 0.012, spinDecay: 0.08, centering: 0.0016 };
const COLLISION = { restitution: 1.05, collisionSpinDrain: 1.5, superDrain: 25 };
const START_SPIN = 100;
const BURST_GAIN = 22;        // burst-meter % gained per clash
const SPECIAL_DASH = 8;       // velocity impulse added on special activation
const STREAK_KEY = "arena.streak";

function makeBey(name, x, y, color) {
  return { name, x, y, vx: 0, vy: 0, spin: START_SPIN, radius: 22, mass: 1, alive: true, color, special: false };
}

export function mountArena(opts) {
  const {
    overlayEl, canvasEl, angleEl, powerFillEl, launchEl, rematchEl, bannerEl, onExit,
    meterYouEl, meterRivalEl, scoreYouEl, scoreRivalEl, streakEl,
    burstFillEl, specialEl, nextRoundEl, calloutEl,
  } = opts;
  const ctx = canvasEl.getContext("2d");
  const W = canvasEl.width, H = canvasEl.height;
  const stadium = { cx: W / 2, cy: H / 2, r: W / 2 - 16 };

  let player, opponent, phase, raf, charging, power, wasColliding, bursts;
  let bannerTimer, calloutTimer;
  let match, burstMeter, specialReady;

  // ---- streak persistence (tolerates unavailable/corrupt storage) ----
  function loadStreak() {
    try {
      const v = parseInt(localStorage.getItem(STREAK_KEY), 10);
      return Number.isFinite(v) && v >= 0 ? v : 0;
    } catch { return 0; }
  }
  function persistStreak(n) {
    try { localStorage.setItem(STREAK_KEY, String(n)); } catch { /* non-fatal */ }
  }

  // ---- scoreboard / meters ----
  function pips(n) {
    let s = "";
    for (let i = 0; i < WIN_TARGET; i++) s += i < n ? "●" : "○";
    return s;
  }
  function renderScore() {
    scoreYouEl.textContent = pips(match.you);
    scoreRivalEl.textContent = pips(match.rival);
    streakEl.textContent = "🔥 " + match.streak;
  }
  function updateMeters() {
    meterYouEl.style.width = (100 * Math.max(0, player.spin) / START_SPIN) + "%";
    meterRivalEl.style.width = (100 * Math.max(0, opponent.spin) / START_SPIN) + "%";
  }

  // ---- match / round lifecycle ----
  function startMatch() {
    match = newMatch(loadStreak());
    renderScore();
    startRound();
  }

  function startRound() {
    cancelAnimationFrame(raf);
    player = makeBey("You", stadium.cx - 120, stadium.cy, "#2bf2ff");
    opponent = makeBey("Rival", stadium.cx + 120, stadium.cy, "#ff2bd6");
    phase = "ready"; // ready -> spinning -> done
    charging = false;
    power = 0;
    wasColliding = false;
    bursts = [];
    burstMeter = 0;
    specialReady = false;
    clearTimeout(bannerTimer);
    clearTimeout(calloutTimer);
    powerFillEl.style.width = "0%";
    burstFillEl.style.width = "0%";
    launchEl.disabled = false;
    launchEl.textContent = "HOLD TO CHARGE";
    specialEl.disabled = true;
    specialEl.classList.remove("ready");
    rematchEl.hidden = true;
    nextRoundEl.hidden = true;
    bannerEl.hidden = true;
    calloutEl.hidden = true;
    updateMeters();
    draw();
  }

  // Show banner text, restarting the CSS pop animation each time.
  function showBanner(text) {
    bannerEl.hidden = true;
    void bannerEl.offsetWidth; // force reflow so banner-pop replays
    bannerEl.textContent = text;
    bannerEl.hidden = false;
  }

  function showCallout(text) {
    calloutEl.hidden = true;
    void calloutEl.offsetWidth; // replay callout-pop
    calloutEl.textContent = text;
    calloutEl.hidden = false;
    clearTimeout(calloutTimer);
    calloutTimer = setTimeout(() => { calloutEl.hidden = true; }, 700);
  }

  // ---- charge-launch input ----
  function startCharge() {
    if (phase !== "ready") return;
    charging = true;
    chargeTick();
  }
  function chargeTick() {
    if (!charging) return;
    power = Math.min(100, power + 2.5);
    powerFillEl.style.width = power + "%";
    if (power >= 100) return; // cap; release to launch
    raf = requestAnimationFrame(chargeTick);
  }
  function release() {
    if (!charging || phase !== "ready") return;
    charging = false;
    cancelAnimationFrame(raf);
    launchPlayer();
  }
  function cancelCharge() {
    if (!charging) return;
    charging = false;
    cancelAnimationFrame(raf);
  }

  function launchPlayer() {
    const angle = (Number(angleEl.value) * Math.PI) / 180;
    const speed = 2 + (power / 100) * 9;
    player.vx = Math.cos(angle) * speed;
    player.vy = Math.sin(angle) * speed;
    player.spin = START_SPIN * (0.6 + 0.4 * (power / 100));

    // AI launches with randomized angle/power, aimed roughly at player
    const aiAngle = Math.atan2(player.y - opponent.y, player.x - opponent.x) + (Math.random() - 0.5);
    const aiSpeed = 5 + Math.random() * 5;
    opponent.vx = Math.cos(aiAngle) * aiSpeed;
    opponent.vy = Math.sin(aiAngle) * aiSpeed;

    phase = "spinning";
    launchEl.disabled = true;
    bannerEl.hidden = true;
    loop();
  }

  // ---- burst special ----
  function fillBurst(amount) {
    if (specialReady) return;
    burstMeter = Math.min(100, burstMeter + amount);
    burstFillEl.style.width = burstMeter + "%";
    if (burstMeter >= 100) {
      specialReady = true;
      specialEl.disabled = false;
      specialEl.classList.add("ready");
    }
  }
  function activateSpecial() {
    if (!specialReady || phase !== "spinning") return;
    player.special = true; // consumed on next collision in resolveCollision
    const ang = Math.atan2(opponent.y - player.y, opponent.x - player.x);
    player.vx += Math.cos(ang) * SPECIAL_DASH;
    player.vy += Math.sin(ang) * SPECIAL_DASH;
    player.spin = Math.min(START_SPIN, player.spin + 10); // small spin kick
    specialReady = false;
    burstMeter = 0;
    burstFillEl.style.width = "0%";
    specialEl.disabled = true;
    specialEl.classList.remove("ready");
    showCallout("SPECIAL!");
  }

  // ---- impact reaction (callout + shake + burst gain) ----
  function onImpact(impact, x, y) {
    spawnBurst(x, y, "#ffffff");
    fillBurst(BURST_GAIN);
    let tier, text;
    if (impact >= 16) { tier = "lg"; text = "MEGA HIT!"; }
    else if (impact >= 9) { tier = "md"; text = "SMASH!"; }
    else { tier = "sm"; text = "CLASH!"; }
    showCallout(text);
    triggerShake(tier);
  }

  // ---- main loop ----
  function loop() {
    const pPrev = player.alive, oPrev = opponent.alive;
    player = stepBey(player, stadium, STADIUM_PARAMS);
    opponent = stepBey(opponent, stadium, STADIUM_PARAMS);

    // impact burst on the frame the beys first make contact
    const touching = distance(player.x, player.y, opponent.x, opponent.y) <= player.radius + opponent.radius;
    if (touching && !wasColliding) {
      const impact = Math.hypot(player.vx - opponent.vx, player.vy - opponent.vy);
      onImpact(impact, (player.x + opponent.x) / 2, (player.y + opponent.y) / 2);
    }
    wasColliding = touching;

    [player, opponent] = resolveCollision(player, opponent, COLLISION);
    stepBursts();
    draw();

    const outcome = decideOutcome(player, opponent);
    if (outcome) {
      // a bey that just died while still spinning was knocked out (ring-out)
      const ringout =
        (pPrev && !player.alive && player.spin > 0) ||
        (oPrev && !opponent.alive && opponent.spin > 0);
      return finishRound(outcome, ringout ? "ringout" : "spinout");
    }
    raf = requestAnimationFrame(loop);
  }

  function finishRound(outcome, reason) {
    phase = "done";
    cancelAnimationFrame(raf);
    launchEl.disabled = true;
    specialEl.disabled = true;
    specialEl.classList.remove("ready");

    match = recordRound(match, outcome);
    updateMeters();
    renderScore();

    if (outcome === "draw") {
      triggerShake("md");
      showBanner("DRAW");
      bannerTimer = setTimeout(() => {
        showBanner("REPLAY ROUND");
        nextRoundEl.textContent = "Replay Round";
        nextRoundEl.hidden = false;
      }, 800);
      return;
    }

    triggerShake(reason === "ringout" ? "lg" : "md");
    if (reason === "ringout") { spawnBurst(stadium.cx, stadium.cy, "#ff2bd6"); draw(); }
    showBanner(reason === "ringout" ? "RING OUT!" : "SPIN OUT!");

    bannerTimer = setTimeout(() => {
      if (match.matchOver) {
        const won = match.matchWinner === "player";
        persistStreak(match.streak);
        renderScore();
        showBanner(won ? "MATCH WON!" : "MATCH LOST");
        rematchEl.textContent = "New Match";
        rematchEl.hidden = false;
      } else {
        showBanner(outcome === "player" ? "ROUND WON" : "ROUND LOST");
        nextRoundEl.textContent = "Next Round";
        nextRoundEl.hidden = false;
      }
    }, 800);
  }

  // ---- impact bursts (transient expanding rings) ----
  function spawnBurst(x, y, color) {
    bursts.push({ x, y, r: 6, life: 1, color });
  }
  function stepBursts() {
    bursts.forEach((p) => { p.r += 6; p.life -= 0.08; });
    bursts = bursts.filter((p) => p.life > 0);
  }

  // ---- rendering ----
  function draw() {
    ctx.clearRect(0, 0, W, H);
    // stadium ring
    ctx.strokeStyle = "rgba(43,242,255,.5)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(stadium.cx, stadium.cy, stadium.r, 0, Math.PI * 2);
    ctx.stroke();
    drawBey(player);
    drawBey(opponent);
    drawBursts();
  }

  function drawBursts() {
    bursts.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawBey(b) {
    if (!b.alive) return;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(0, 0, b.radius * (0.5 + 0.5 * (b.spin / START_SPIN)), 0, Math.PI * 2);
    ctx.fill();
    // spin tick
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    const a = (b.x + b.y) * 0.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * b.radius, Math.sin(a) * b.radius);
    ctx.stroke();
    ctx.restore();
  }

  function triggerShake(tier = "md") {
    const cls = "shake-" + tier;
    overlayEl.classList.remove("shake-sm", "shake-md", "shake-lg");
    void overlayEl.offsetWidth; // restart animation
    overlayEl.classList.add(cls);
    setTimeout(() => overlayEl.classList.remove(cls), 600);
  }

  // ---- open/close ----
  function open() {
    cancelAnimationFrame(raf); // stop any ghost loop before re-initialising
    overlayEl.hidden = false;
    document.body.classList.add("battling");
    triggerShake("lg");
    startMatch();
    showBanner("BATTLE!");
    bannerTimer = setTimeout(() => { if (phase === "ready") bannerEl.hidden = true; }, 900);
  }
  function close() {
    cancelAnimationFrame(raf);
    clearTimeout(bannerTimer);
    clearTimeout(calloutTimer);
    overlayEl.hidden = true;
    document.body.classList.remove("battling");
    if (onExit) onExit();
  }

  // ---- listeners ----
  launchEl.addEventListener("mousedown", startCharge);
  launchEl.addEventListener("mouseup", release);
  launchEl.addEventListener("mouseleave", release);
  launchEl.addEventListener("touchstart", (e) => { e.preventDefault(); startCharge(); }, { passive: false });
  launchEl.addEventListener("touchend", (e) => { e.preventDefault(); release(); }, { passive: false });
  launchEl.addEventListener("touchcancel", cancelCharge, { passive: true });
  specialEl.addEventListener("click", activateSpecial);
  nextRoundEl.addEventListener("click", startRound);
  rematchEl.addEventListener("click", startMatch);

  return { open, close };
}
```

- [ ] **Step 2: Update the `mountArena` call in `main.js`**

In `js/main.js`, replace the `mountArena({ ... })` call (lines 169-178) with:

```js
  const arena = mountArena({
    overlayEl: $("#arena"),
    canvasEl: $("#arena-canvas"),
    angleEl: $("#angle"),
    powerFillEl: $("#power-fill"),
    launchEl: $("#launch"),
    rematchEl: $("#rematch"),
    bannerEl: $("#arena-banner"),
    meterYouEl: $("#meter-you"),
    meterRivalEl: $("#meter-rival"),
    scoreYouEl: $("#score-you"),
    scoreRivalEl: $("#score-rival"),
    streakEl: $("#score-streak"),
    burstFillEl: $("#burst-fill"),
    specialEl: $("#special"),
    nextRoundEl: $("#next-round"),
    calloutEl: $("#arena-callout"),
    onExit: () => {}
  });
```

- [ ] **Step 3: Run the test suite (guard against regressions)**

Run: `node --test`
Expected: PASS — all match, physics, and cart tests still pass.

- [ ] **Step 4: Manual playtest**

Reload `index.html` and click the red "do not press" button. Verify:
- Spin meters track both beys live and drop to empty on death.
- Rules text reads clearly under the controls.
- Round end shows the cause (`RING OUT!` / `SPIN OUT!`) then `ROUND WON` / `ROUND LOST`.
- Scoreboard pips fill; first side to 2 ends the match with `MATCH WON!` / `MATCH LOST`.
- Burst meter fills as you land clashes; SPECIAL enables and pulses when full; pressing it dashes your bey, heavily drains the rival on contact, and only works once per round.
- `Next Round` advances within a match; `New Match` (rematch) resets the score; a draw shows `REPLAY ROUND`.
- Callouts (`CLASH!`/`SMASH!`/`MEGA HIT!`) and shake intensity scale with impact.
- Win streak shows in the HUD, increments on a match win, resets on a loss, and survives a page reload.

- [ ] **Step 5: Commit**

```bash
git add js/arena.js js/main.js
git commit -m "feat: arena rounds, meters, burst special, callouts, streak"
```

---

## Self-Review Notes

- **Spec coverage:** clarity (meters → Task 3/5, rules → Task 3, win-reason → Task 5); structure (best-of-3 + scoreboard → Task 1/5, streak → Task 5); burst special (Task 2 physics + Task 5 wiring); juice (callouts + scaled shake → Task 4/5). All spec sections map to tasks.
- **Type consistency:** `recordRound`/`newMatch`/`WIN_TARGET` signatures match between Task 1 and Task 5. `resolveCollision` `params.superDrain` + per-bey `special` consistent between Task 2 and `COLLISION`/`activateSpecial` in Task 5. DOM ids in Task 3 match the `$()` selectors in Task 5 Step 2 and the `opts` destructure in Task 5 Step 1.
- **Placeholders:** none — every code step shows full code.
```
