# Beyblade Realism + Sushi Eating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the arena the real Beyblade X point system, make the physics feel physically grounded (spin dynamics), and let players eat ordered sushi from a tray with a Minecraft-style hold-to-eat.

**Architecture:** Three independent phases over the existing vanilla-ES-module app. **Phase A (scoring)** rewrites the pure `match.js` to a points-by-finish model and wires the arena to classify finishes + award ★. **Phase B (physics)** adds pure spin-dynamics to `physics.js` (inertia, precession, spin-steal, scrape-launch, burst) and tunes the arena. **Phase C (eating)** adds a pure `tray.js` inventory and a hold-to-eat UI. Pure logic is unit-tested with `node --test`; DOM/canvas is playtested.

**Tech Stack:** Vanilla ES modules, `node --test`, Canvas 2D, Web Audio, CSS with the 16-bit JRPG tokens already in `theme.css`.

**Spec:** `docs/superpowers/specs/2026-06-11-beyblade-realism-and-eating-design.md`

---

## File Structure

- **New:** `js/tray.js` (owned-food inventory), `tests/tray.test.js`.
- **Rewritten:** `js/match.js` + `tests/match.test.js` (points model).
- **Modified:** `js/points.js` + `tests/points.test.js` (`shopPointsForFinish`),
  `js/physics.js` + `tests/physics.test.js` (spin dynamics, additive),
  `js/arena.js` (finish classification, ★ award, points HUD, physics params),
  `js/i18n.js` (finish names + tray/eat strings), `js/sound.js` (`crunch`),
  `js/main.js` (order→tray, tray drawer, hold-to-eat), `index.html` (Tray button +
  drawer), `css/theme.css` (tray + eating visuals).

Build order: **Phase A (Tasks 1–4) → Phase B (Tasks 5–7) → Phase C (Tasks 8–13) → playtest (Task 14)**. Each phase is independently shippable.

---

## PHASE A — Beyblade X scoring

### Task 1: Rewrite `match.js` to the points model

**Files:**
- Modify: `js/match.js` (full rewrite)
- Test: `tests/match.test.js` (full rewrite)

- [ ] **Step 1: Replace the test file**

Overwrite `tests/match.test.js` with:

```js
// tests/match.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { newMatch, recordRound, POINT_TARGET, FINISH_POINTS } from "../js/match.js";

test("POINT_TARGET is 4", () => assert.equal(POINT_TARGET, 4));

test("FINISH_POINTS: spin 1, over 2, burst 2, xtreme 3", () => {
  assert.deepEqual(FINISH_POINTS, { spin: 1, over: 2, burst: 2, xtreme: 3 });
});

test("newMatch starts 0-0, round 1, not over", () => {
  const m = newMatch();
  assert.equal(m.round, 1); assert.equal(m.you, 0); assert.equal(m.rival, 0);
  assert.equal(m.streak, 0); assert.equal(m.matchOver, false); assert.equal(m.matchWinner, null);
});

test("newMatch carries an incoming streak", () => assert.equal(newMatch(3).streak, 3));

test("a Spin finish scores 1 for the player and advances the round", () => {
  const m = recordRound(newMatch(), "player", "spin");
  assert.equal(m.you, 1); assert.equal(m.rival, 0); assert.equal(m.round, 2); assert.equal(m.matchOver, false);
});

test("an Over finish scores 2", () => assert.equal(recordRound(newMatch(), "player", "over").you, 2));
test("a Burst finish scores 2", () => assert.equal(recordRound(newMatch(), "opponent", "burst").rival, 2));
test("an Xtreme finish scores 3", () => assert.equal(recordRound(newMatch(), "player", "xtreme").you, 3));

test("draw changes nothing and keeps the round", () => {
  const m = recordRound(newMatch(), "draw");
  assert.equal(m.you, 0); assert.equal(m.rival, 0); assert.equal(m.round, 1); assert.equal(m.matchOver, false);
});

test("reaching 4 points ends the match and increments streak", () => {
  let m = newMatch(1);
  m = recordRound(m, "player", "over");   // 2
  m = recordRound(m, "player", "over");   // 4 -> over
  assert.equal(m.you, 4); assert.equal(m.matchOver, true);
  assert.equal(m.matchWinner, "player"); assert.equal(m.streak, 2);
});

test("an Xtreme can overshoot the target and still win (2 + 3 = 5)", () => {
  let m = newMatch(0);
  m = recordRound(m, "player", "over");    // 2
  m = recordRound(m, "player", "xtreme");  // 5 -> over
  assert.equal(m.you, 5); assert.equal(m.matchOver, true); assert.equal(m.matchWinner, "player");
});

test("rival reaching 4 ends the match and resets streak", () => {
  let m = newMatch(5);
  m = recordRound(m, "opponent", "xtreme"); // 3
  m = recordRound(m, "opponent", "spin");   // 4 -> over
  assert.equal(m.rival, 4); assert.equal(m.matchOver, true);
  assert.equal(m.matchWinner, "opponent"); assert.equal(m.streak, 0);
});

test("recordRound after match over returns state unchanged", () => {
  let m = newMatch();
  m = recordRound(m, "player", "over");
  m = recordRound(m, "player", "over"); // 4 -> over
  assert.deepEqual(recordRound(m, "player", "spin"), m);
});

test("recordRound does not mutate the input state", () => {
  const start = newMatch();
  recordRound(start, "player", "over");
  assert.equal(start.you, 0); assert.equal(start.round, 1);
});

test("a mixed-finish path to 4: spin + burst + spin", () => {
  let m = newMatch(0);
  m = recordRound(m, "player", "spin");   // 1
  m = recordRound(m, "player", "burst");  // 3
  m = recordRound(m, "player", "spin");   // 4 -> over
  assert.equal(m.you, 4); assert.equal(m.matchOver, true); assert.equal(m.round, 3);
});
```

- [ ] **Step 2: Run the test, watch it fail**

Run: `node --test tests/match.test.js`
Expected: FAIL — `POINT_TARGET`/`FINISH_POINTS` are not exported (old file exports `WIN_TARGET`).

- [ ] **Step 3: Rewrite `js/match.js`**

Overwrite `js/match.js` with:

```js
// js/match.js — pure Beyblade X scoring: points by finish type, first to 4. No DOM.

// First to this many points takes the match.
export const POINT_TARGET = 4;

// Points awarded by finish type (Beyblade X).
export const FINISH_POINTS = { spin: 1, over: 2, burst: 2, xtreme: 3 };

// Fresh match state. `you`/`rival` are POINT totals; `streak` carries the
// player's current match-win streak.
export function newMatch(streak = 0) {
  return { round: 1, you: 0, rival: 0, streak, matchOver: false, matchWinner: null };
}

// Apply a finished round and return a NEW state (input never mutated).
//   outcome: "player" | "opponent" | "draw"
//   finish:  a FINISH_POINTS key ("spin"|"over"|"burst"|"xtreme"); ignored on draw.
// draw → no score change, same round replays. Otherwise the winner gains
// FINISH_POINTS[finish]; reaching POINT_TARGET ends the match (streak +1 on a
// player match win, reset to 0 on a loss).
export function recordRound(state, outcome, finish) {
  if (state.matchOver) return state;
  if (outcome === "draw") return { ...state };

  const pts = FINISH_POINTS[finish] ?? 0;
  const you = state.you + (outcome === "player" ? pts : 0);
  const rival = state.rival + (outcome === "opponent" ? pts : 0);

  const matchOver = you >= POINT_TARGET || rival >= POINT_TARGET;
  const matchWinner = matchOver ? (you >= POINT_TARGET ? "player" : "opponent") : null;
  const streak = matchOver
    ? (matchWinner === "player" ? state.streak + 1 : 0)
    : state.streak;
  const round = matchOver ? state.round : state.round + 1;

  return { round, you, rival, streak, matchOver, matchWinner };
}
```

- [ ] **Step 4: Run the test, watch it pass**

Run: `node --test tests/match.test.js`
Expected: PASS (all match tests green).

- [ ] **Step 5: Commit**

```bash
git add js/match.js tests/match.test.js
git commit -m "feat: Beyblade X points scoring (finish types, first to 4)"
```

---

### Task 2: `shopPointsForFinish` in `points.js`

**Files:**
- Modify: `js/points.js` (replace `pointsForRound`)
- Test: `tests/points.test.js` (replace the `pointsForRound` cases)

- [ ] **Step 1: Replace the test file**

Overwrite `tests/points.test.js` with:

```js
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
```

- [ ] **Step 2: Run the test, watch it fail**

Run: `node --test tests/points.test.js`
Expected: FAIL — `shopPointsForFinish` is not exported.

- [ ] **Step 3: Replace `pointsForRound` in `js/points.js`**

Find this block in `js/points.js`:

```js
// pointsForRound — points awarded when a round finishes: +1 for the round win,
// +3 bonus when that win also clinches the match.
export function pointsForRound(wonRound, wonMatch) {
  return (wonRound ? 1 : 0) + (wonMatch ? 3 : 0);
}
```

Replace it with:

```js
// ★ awarded to the shop wallet when a player wins a finish, plus a bonus when
// that finish clinches the match.
export const MATCH_BONUS = 2;
export function shopPointsForFinish(outcome, finishValue, matchWon) {
  return (outcome === "player" ? finishValue : 0) + (matchWon ? MATCH_BONUS : 0);
}
```

- [ ] **Step 4: Run the test, watch it pass**

Run: `node --test tests/points.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add js/points.js tests/points.test.js
git commit -m "feat: shop earns the battle points scored (shopPointsForFinish)"
```

---

### Task 3: Finish-name i18n strings

**Files:**
- Modify: `js/i18n.js` (add to `STRINGS`)

- [ ] **Step 1: Add the finish-name keys**

In `js/i18n.js`, find the line `"arena.title": { zh: "陀螺竞技场", ... },` (in the arena block). Immediately after it, add:

```js
  "arena.finish.spin":   { zh: "自旋结束", py: ["zì","xuán","jié","shù"], en: "Spin Finish +1" },
  "arena.finish.over":   { zh: "击飞结束", py: ["jī","fēi","jié","shù"], en: "Over Finish +2" },
  "arena.finish.burst":  { zh: "爆裂结束", py: ["bào","liè","jié","shù"], en: "Burst Finish +2" },
  "arena.finish.xtreme": { zh: "极限结束", py: ["jí","xiàn","jié","shù"], en: "Xtreme Finish +3" },
```

- [ ] **Step 2: Verify the keys resolve and pinyin aligns**

Run:
```bash
node -e '
import("./js/i18n.js").then(m=>{
  const isHan=c=>{const x=c.codePointAt(0);return x>=0x4e00&&x<=0x9fff};
  for(const k of ["arena.finish.spin","arena.finish.over","arena.finish.burst","arena.finish.xtreme"]){
    const e=m.t(k); const han=[...e.zh].filter(isHan).length;
    console.log((han===e.py.length?"ok ":"BAD ")+k+" han="+han+" py="+e.py.length+" | "+e.en);
  }
});'
```
Expected: four `ok` lines (han=4, py=4 each), printing the English with `+1/+2/+2/+3`.

- [ ] **Step 3: Confirm tests still green**

Run: `npm test`
Expected: PASS (`tests/i18n.test.js` unaffected).

- [ ] **Step 4: Commit**

```bash
git add js/i18n.js
git commit -m "feat: i18n finish-name strings (Spin/Over/Burst/Xtreme)"
```

---

### Task 4: Wire scoring into the arena

**Files:**
- Modify: `js/arena.js` (imports, `pips`, finish classification, `finishRound`)

- [ ] **Step 1: Update the imports**

In `js/arena.js`, replace:
```js
import { newMatch, recordRound, WIN_TARGET } from "./match.js";
import { pointsForRound } from "./points.js";
```
with:
```js
import { newMatch, recordRound, POINT_TARGET, FINISH_POINTS } from "./match.js";
import { shopPointsForFinish } from "./points.js";
```

- [ ] **Step 2: Make `pips` a row of 4 filled by points**

Replace:
```js
  function pips(n) {
    let s = "";
    for (let i = 0; i < WIN_TARGET; i++) s += i < n ? "●" : "○";
    return s;
  }
```
with:
```js
  function pips(n) {
    let s = "";
    const filled = Math.min(n, POINT_TARGET);
    for (let i = 0; i < POINT_TARGET; i++) s += i < filled ? "●" : "○";
    return s;
  }
```

- [ ] **Step 3: Classify the finish in the loop**

Find this block (in the main loop, after `decideOutcome`):
```js
    const outcome = decideOutcome(player, opponent);
    if (outcome) {
      // ring-out vs spin-out is decided by where the bey ended up: a bey that
      // died outside the stadium radius was knocked out (ring-out); otherwise
      // its spin ran down (spin-out).
      const ringout =
        (pPrev && !player.alive && distance(player.x, player.y, stadium.cx, stadium.cy) > stadium.r) ||
        (oPrev && !opponent.alive && distance(opponent.x, opponent.y, stadium.cx, stadium.cy) > stadium.r);
      return finishRound(outcome, ringout ? "ringout" : "spinout");
    }
```
Replace it with:
```js
    const outcome = decideOutcome(player, opponent);
    if (outcome) {
      return finishRound(outcome, classifyFinish(outcome));
    }
```

- [ ] **Step 4: Add the `classifyFinish` helper**

Immediately **above** the `function finishRound(` line, insert:

```js
  // Map the just-finished round to a Beyblade X finish type. Precedence:
  // burst > xtreme > over > spin. The loser is the bey that just died; on a
  // draw the finish is irrelevant (no points awarded).
  function classifyFinish(outcome) {
    if (outcome === "draw") return "spin";
    const loser = outcome === "player" ? opponent : player;
    const winner = outcome === "player" ? player : opponent;
    if (loser.burst) return "burst";
    const outside = distance(loser.x, loser.y, stadium.cx, stadium.cy) > stadium.r;
    if (outside) {
      // a ring-out delivered while the attacker is riding / just released the
      // Xtreme rail (or mid-special) is an Xtreme Finish.
      const xtreme = winner.railed || (winner.dashCd ?? 0) > 0 || winner.special;
      return xtreme ? "xtreme" : "over";
    }
    return "spin";
  }
```

- [ ] **Step 5: Rewrite `finishRound` to use the finish type**

Replace the whole `finishRound` function (from `function finishRound(outcome, reason) {` through its closing brace, i.e. the block that currently ends after the `bannerTimer = setTimeout(...)` match-over logic) with:

```js
  function finishRound(outcome, finish) {
    phase = "done";
    cancelAnimationFrame(raf);
    sfx.stopSpinHum();
    if (outcome !== "draw") {
      if (finish === "xtreme") sfx.xtreme();
      else if (finish === "over") sfx.ringOut();
      else if (finish === "burst") sfx.ringOut();
      else sfx.spinOut();
    }
    launchEl.disabled = true;
    specialEl.disabled = true;
    specialEl.classList.remove("ready");

    match = recordRound(match, outcome, finish);
    updateMeters();
    renderScore();

    // Award ★: the finish's point value when the player scored it, plus a
    // bonus on the clinching win.
    const matchWon = match.matchOver && match.matchWinner === "player";
    const earned = shopPointsForFinish(outcome, FINISH_POINTS[finish] ?? 0, matchWon);
    if (earned > 0 && typeof opts.awardPoints === "function") opts.awardPoints(earned);

    if (outcome === "draw") {
      triggerShake("md");
      showBanner(biHtml("arena.draw"));
      bannerTimer = setTimeout(() => {
        showBanner(biHtml("arena.replay"));
        nextRoundEl.innerHTML = biHtml("arena.replay");
        nextRoundEl.hidden = false;
      }, 800);
      return;
    }

    const big = finish === "over" || finish === "xtreme" || finish === "burst";
    triggerShake(big ? "lg" : "md");
    if (big) { spawnBurst(stadium.cx, stadium.cy, "#ff2bd6"); draw(); }
    showBanner(biHtml("arena.finish." + finish));

    bannerTimer = setTimeout(() => {
      if (match.matchOver) {
        const won = match.matchWinner === "player";
        persistStreak(match.streak);
        renderScore();
        if (won) sfx.win(); else sfx.lose();
        showBanner(won ? biHtml("arena.match.won") : biHtml("arena.match.lost"));
        rematchEl.innerHTML = biHtml("arena.rematch");
        rematchEl.hidden = false;
      } else {
        showBanner(outcome === "player" ? biHtml("arena.round.won") : biHtml("arena.round.lost"));
        nextRoundEl.innerHTML = biHtml("arena.next");
        nextRoundEl.hidden = false;
      }
    }, 800);
  }
```

- [ ] **Step 6: Verify it loads and tests pass**

Run: `node -e "import('./js/arena.js').then(()=>console.log('arena loads OK'))"`
Expected: prints `arena loads OK`.

Run: `npm test`
Expected: PASS (all suites green; `match`/`points` already updated).

- [ ] **Step 7: Commit**

```bash
git add js/arena.js
git commit -m "feat: arena classifies finishes (spin/over/burst/xtreme) and scores to 4"
```

---

## PHASE B — Grounded physics realism

### Task 5: Inertia + precession in `stepBey`

**Files:**
- Modify: `js/physics.js` (constants + `stepBey`)
- Test: `tests/physics.test.js` (append)

- [ ] **Step 1: Append the failing tests**

Add to the end of `tests/physics.test.js`:

```js
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
```

- [ ] **Step 2: Run, watch the new tests fail**

Run: `node --test tests/physics.test.js`
Expected: FAIL on the inertia/precession tests (`inertia`/`wobbleSpin` not honored yet).

- [ ] **Step 3: Add constants and rewrite `stepBey`**

In `js/physics.js`, immediately after the `distance` function, add the constants:

```js
// --- spin-dynamics tuning ---
const PRECESS_FLOOR = 0.35; // fraction of centering retained at zero spin
const PRECESS_STEP  = 0.5;  // wobble phase advanced per frame while precessing
const WOBBLE_AMP    = 1.2;  // max wobble position offset (px) at spent spin
```

Replace the entire `stepBey` function with:

```js
export function stepBey(bey, stadium, params) {
  if (!bey.alive) return bey;
  const { dt, friction, spinDecay, centering, wobbleSpin = 0 } = params;
  const spinDecayMult = bey.spinDecayMult ?? 1;
  const inertia = bey.inertia ?? 1;
  let centeringMult = bey.centeringMult ?? 1;

  // gyroscopic precession: a low-spin top wobbles and loses its grip on the
  // bowl — centering weakens, so it drifts toward the rim (the loss spiral).
  let wobble = bey.wobble ?? 0;
  let wobX = 0, wobY = 0;
  if (wobbleSpin > 0 && bey.spin < wobbleSpin) {
    const frac = Math.max(0, bey.spin) / wobbleSpin;        // 1 entering, 0 dead
    centeringMult *= PRECESS_FLOOR + (1 - PRECESS_FLOOR) * frac;
    wobble += PRECESS_STEP;
    const amp = WOBBLE_AMP * (1 - frac);
    wobX = Math.cos(wobble) * amp;
    wobY = Math.sin(wobble) * amp;
  }

  // bowl centering force toward stadium center (scaled per-bey)
  const ax = (stadium.cx - bey.x) * centering * centeringMult;
  const ay = (stadium.cy - bey.y) * centering * centeringMult;

  let vx = (bey.vx + ax * dt) * (1 - friction * dt);
  let vy = (bey.vy + ay * dt) * (1 - friction * dt);

  const x = bey.x + vx * dt + wobX;
  const y = bey.y + vy * dt + wobY;

  // spin decay scaled by stamina and divided by moment of inertia (heavier/
  // wider beys hold their spin longer)
  let spin = bey.spin - (spinDecay * spinDecayMult / inertia) * dt;
  let alive = true;
  if (spin <= 0) { spin = 0; alive = false; }
  if (distance(x, y, stadium.cx, stadium.cy) > stadium.r) { alive = false; }

  return { ...bey, x, y, vx, vy, spin, alive, wobble };
}
```

- [ ] **Step 4: Run, watch all physics tests pass**

Run: `node --test tests/physics.test.js`
Expected: PASS (new + existing; the "decreases spin by spinDecay*dt", "dead bey unchanged", and "does not mutate" cases still hold — `inertia` defaults to 1, `wobbleSpin` to 0, and the dead-bey early return is untouched).

- [ ] **Step 5: Commit**

```bash
git add js/physics.js tests/physics.test.js
git commit -m "feat: physics — moment of inertia (stamina) and gyroscopic precession"
```

---

### Task 6: Spin-steal, scrape-launch, and burst in `resolveCollision`

**Files:**
- Modify: `js/physics.js` (`resolveCollision`)
- Test: `tests/physics.test.js` (append)

- [ ] **Step 1: Append the failing tests**

Add to the end of `tests/physics.test.js`:

```js
test("resolveCollision: opposite-spin contact spin-steals — the gap narrows", () => {
  const a = bey({ x: 0, y: 0, spin: 90, dir: 1, radius: 10 });
  const b = bey({ x: 15, y: 0, spin: 30, dir: -1, radius: 10 });
  const [a2, b2] = resolveCollision(a, b, { ...COLL, oppositeSpinMult: 1, spinSteal: 0.2 });
  assert.ok(Math.abs(a2.spin - b2.spin) < Math.abs(a.spin - b.spin), "gap narrows");
  assert.ok(a2.spin >= 0 && b2.spin >= 0, "no negative spin");
});

test("resolveCollision: same-spin contact does NOT spin-steal", () => {
  const a = bey({ x: 0, y: 0, spin: 90, dir: 1, radius: 10 });
  const b = bey({ x: 15, y: 0, spin: 30, dir: 1, radius: 10 });
  const off = resolveCollision(a, b, { ...COLL, sameSpinMult: 1, spinSteal: 0 });
  const on  = resolveCollision(a, b, { ...COLL, sameSpinMult: 1, spinSteal: 0.2 });
  assert.deepEqual([off[0].spin, off[1].spin], [on[0].spin, on[1].spin]);
});

test("resolveCollision: scrape coupling launches a still opponent tangentially", () => {
  const a = bey({ x: 0, y: 0, spin: 100, dir: 1, vx: 1, vy: 0, radius: 10 });
  const b = bey({ x: 15, y: 0, spin: 0, dir: 1, vx: 0, vy: 0, radius: 10 });
  const [, b2] = resolveCollision(a, b, { ...COLL, scrapeCoupling: 2 });
  assert.notEqual(b2.vy, 0, "b gains tangential (y) velocity from a's spin");
});

test("resolveCollision: burst stress past the threshold bursts the bey", () => {
  const a = bey({ x: 0, y: 0, spin: 100, vx: 0, vy: 0, radius: 10, mass: 1 });
  const b = bey({ x: 15, y: 0, spin: 100, vx: -30, vy: 0, radius: 10, mass: 1, burstThreshold: 5 });
  const [, b2] = resolveCollision(a, b, { ...COLL, burstGain: 1 });
  assert.ok(b2.burstStress >= 5, "stress accumulated");
  assert.equal(b2.burst, true);
  assert.equal(b2.alive, false);
});

test("resolveCollision: no threshold means no burst (default safe)", () => {
  const a = bey({ x: 0, y: 0, spin: 100, vx: 0, radius: 10 });
  const b = bey({ x: 15, y: 0, spin: 100, vx: -30, radius: 10 });
  const [, b2] = resolveCollision(a, b, { ...COLL, burstGain: 1 });
  assert.ok(!b2.burst, "no threshold -> never bursts");
});
```

- [ ] **Step 2: Run, watch the new tests fail**

Run: `node --test tests/physics.test.js`
Expected: FAIL on the new spin-steal/scrape/burst tests.

- [ ] **Step 3: Rewrite `resolveCollision`**

Replace the entire `resolveCollision` function in `js/physics.js` with:

```js
export function resolveCollision(a, b, params) {
  const {
    restitution, collisionSpinDrain, superDrain = 0,
    oppositeSpinMult = 1, sameSpinMult = 1,
    spinSteal = 0, scrapeCoupling = 0, burstGain = 0,
  } = params;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const minDist = a.radius + b.radius;
  if (dist === 0 || dist >= minDist) return [a, b];

  // unit normal from a to b
  const nx = dx / dist;
  const ny = dy / dist;

  // relative velocity along the normal
  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const velAlongNormal = rvx * nx + rvy * ny;

  let a2 = { ...a };
  let b2 = { ...b };

  // only resolve velocity if they are approaching
  if (velAlongNormal < 0) {
    const invMassA = 1 / a.mass;
    const invMassB = 1 / b.mass;
    const j = (-(1 + restitution) * velAlongNormal) / (invMassA + invMassB);
    const ix = j * nx;
    const iy = j * ny;
    a2.vx = a.vx - ix * invMassA;
    a2.vy = a.vy - iy * invMassA;
    b2.vx = b.vx + ix * invMassB;
    b2.vy = b.vy + iy * invMassB;
  }

  // positional correction: push apart so they no longer overlap
  const overlap = minDist - dist;
  a2.x = a.x - nx * (overlap / 2);
  a2.y = a.y - ny * (overlap / 2);
  b2.x = b.x + nx * (overlap / 2);
  b2.y = b.y + ny * (overlap / 2);

  // both lose spin on contact; opposite spins "spin-steal" harder than same-spin
  const sameDir = (a.dir ?? 1) === (b.dir ?? 1);
  const drain = collisionSpinDrain * (sameDir ? sameSpinMult : oppositeSpinMult);
  const aLoss = drain * (b.atkMult ?? 1) / Math.max(a.defMult ?? 1, 0.01);
  const bLoss = drain * (a.atkMult ?? 1) / Math.max(b.defMult ?? 1, 0.01);
  a2.spin = Math.max(0, a.spin - aLoss);
  b2.spin = Math.max(0, b.spin - bLoss);

  // SPIN-STEAL: opposite-spin contact transfers angular momentum from the
  // faster spinner to the slower, narrowing the gap (never below 0).
  if (spinSteal > 0 && !sameDir) {
    const transfer = spinSteal * Math.abs(a2.spin - b2.spin);
    if (a2.spin >= b2.spin) { a2.spin = Math.max(0, a2.spin - transfer); b2.spin += transfer; }
    else { b2.spin = Math.max(0, b2.spin - transfer); a2.spin += transfer; }
  }

  // SCRAPE COUPLING: each bey converts a little spin into a tangential launch on
  // the other (perpendicular to the contact normal, signed by its spin dir).
  if (scrapeCoupling > 0) {
    const tx = -ny, ty = nx;                       // unit tangent
    const sa = scrapeCoupling * (a.spin / 100) * (a.dir ?? 1);
    const sb = scrapeCoupling * (b.spin / 100) * (b.dir ?? 1);
    b2.vx += tx * sa; b2.vy += ty * sa;            // a scrapes b
    a2.vx -= tx * sb; a2.vy -= ty * sb;            // b scrapes a (opposite tangent)
  }

  // BURST STRESS: hard hits accumulate stress scaled by the other's attack;
  // crossing a bey's threshold bursts it (alive=false, burst=true).
  if (burstGain > 0) {
    const force = Math.abs(velAlongNormal);
    a2.burstStress = (a.burstStress ?? 0) + force * burstGain * (b.atkMult ?? 1);
    b2.burstStress = (b.burstStress ?? 0) + force * burstGain * (a.atkMult ?? 1);
    if (a2.burstStress >= (a.burstThreshold ?? Infinity)) { a2.burst = true; a2.alive = false; }
    if (b2.burstStress >= (b.burstThreshold ?? Infinity)) { b2.burst = true; b2.alive = false; }
  }

  // special attack: a bey with `special` set drains extra spin from the other,
  // then its flag clears (one-shot).
  if (a.special) { b2.spin = Math.max(0, b2.spin - superDrain); a2.special = false; }
  if (b.special) { a2.spin = Math.max(0, a2.spin - superDrain); b2.special = false; }

  return [a2, b2];
}
```

- [ ] **Step 4: Run, watch all physics tests pass**

Run: `node --test tests/physics.test.js`
Expected: PASS. The existing collision tests stay green: the non-overlap early return is unchanged; `spinSteal`/`scrapeCoupling`/`burstGain` all default to 0 and `burstThreshold` to `Infinity`, so the "drains spin from both" (45/45), "special drain" (45/25), and "reverses approach velocity" cases are unaffected.

- [ ] **Step 5: Commit**

```bash
git add js/physics.js tests/physics.test.js
git commit -m "feat: physics — spin-steal, spin->motion scrape launch, burst stress"
```

---

### Task 7: Tune the arena with the new physics

**Files:**
- Modify: `js/arena.js` (constants, param objects, `makeBey`)

- [ ] **Step 1: Add the physics params to the constants**

In `js/arena.js`, replace:
```js
const STADIUM_PARAMS = { dt: 1, friction: 0.012, spinDecay: 0.08, centering: 0.0016 };
const COLLISION = { restitution: 1.05, collisionSpinDrain: 1.5, superDrain: 25, oppositeSpinMult: 2.2, sameSpinMult: 0.7 };
```
with:
```js
const STADIUM_PARAMS = { dt: 1, friction: 0.012, spinDecay: 0.08, centering: 0.0016, wobbleSpin: 28 };
const COLLISION = { restitution: 1.05, collisionSpinDrain: 1.5, superDrain: 25, oppositeSpinMult: 2.2, sameSpinMult: 0.7,
  spinSteal: 0.12, scrapeCoupling: 1.1, burstGain: 0.6 };
```

- [ ] **Step 2: Give each bey inertia, burst stress, and a burst threshold**

In `makeBey`, replace the returned object's first two property lines:
```js
    name, x, y, vx: 0, vy: 0, spin: spin0, spin0, radius: 22, mass,
    alive: true, color, special: false, dir, dashCd: 0,
```
with:
```js
    name, x, y, vx: 0, vy: 0, spin: spin0, spin0, radius: 22, mass,
    inertia: mass,                       // heavier beys hold spin longer
    burstStress: 0, burst: false,
    // burst resistance is encoded in centeringMult (1..1.8); map it to a stress cap
    burstThreshold: 70 + 100 * Math.min(1, Math.max(0, (centeringMult - 1) / 0.8)),
    alive: true, color, special: false, dir, dashCd: 0,
```

(Note: `mass` and `centeringMult` are already destructured from `profile` at the top of `makeBey`.)

- [ ] **Step 3: Verify it loads and tests pass**

Run: `node -e "import('./js/arena.js').then(()=>console.log('arena loads OK'))"`
Expected: prints `arena loads OK`.

Run: `npm test`
Expected: PASS (all suites).

- [ ] **Step 4: Commit**

```bash
git add js/arena.js
git commit -m "feat: arena uses the new spin dynamics (inertia, precession, steal, burst)"
```

- [ ] **Step 5: Quick playtest note**

Serve (`python3 -m http.server 8000`), open the arena via the ⚔ button, and confirm battles run without errors and finishes still resolve. Tuning of `wobbleSpin`/`spinSteal`/`scrapeCoupling`/`burstGain`/`burstThreshold` happens in the Task 14 playtest.

---

## PHASE C — Sushi tray + hold-to-eat

### Task 8: `tray.js` inventory module

**Files:**
- Create: `js/tray.js`
- Test: `tests/tray.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/tray.test.js`:

```js
// tests/tray.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { addPieces, eatPiece, trayCount, loadTray } from "../js/tray.js";

const A = { id: "a", name: { zh: "甲", py: "jiǎ", en: "A" }, image: "a.webp", qty: 2 };
const B = { id: "b", name: { zh: "乙", py: "yǐ", en: "B" }, image: "b.webp", qty: 1 };

test("addPieces expands qty into one entry per piece", () => {
  const t = addPieces([], [A, B]);
  assert.equal(t.length, 3);
  assert.deepEqual(t[0], { id: "a", name: A.name, image: "a.webp" });
});

test("addPieces appends to an existing tray", () => {
  const t = addPieces([{ id: "x", name: {}, image: "x" }], [B]);
  assert.equal(t.length, 2);
  assert.equal(t[1].id, "b");
});

test("addPieces defaults a missing qty to 1", () => {
  assert.equal(addPieces([], [{ id: "c", name: {}, image: "c" }]).length, 1);
});

test("eatPiece removes the piece at the index", () => {
  assert.equal(eatPiece(addPieces([], [A]), 0).length, 1);
});

test("eatPiece does not mutate the input", () => {
  const t = addPieces([], [A]);
  eatPiece(t, 0);
  assert.equal(t.length, 2);
});

test("eatPiece is a no-op for an out-of-range index", () => {
  const t = addPieces([], [B]);
  assert.deepEqual(eatPiece(t, 5), t);
});

test("trayCount counts pieces", () => {
  assert.equal(trayCount(addPieces([], [A, B])), 3);
});

test("loadTray defaults to [] when storage is unavailable", () => {
  assert.deepEqual(loadTray(), []);
});
```

- [ ] **Step 2: Run, watch it fail**

Run: `node --test tests/tray.test.js`
Expected: FAIL — `../js/tray.js` not found.

- [ ] **Step 3: Write `js/tray.js`**

```js
// js/tray.js — the owned sushi tray (inventory). Pure + localStorage. No DOM.
export const TRAY_KEY = "shop.tray";

export function loadTray() {
  try {
    const arr = JSON.parse(localStorage.getItem(TRAY_KEY));
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function saveTray(tray) {
  try { localStorage.setItem(TRAY_KEY, JSON.stringify(tray)); } catch { /* ignore */ }
}

// addPieces — append one entry per piece (order lines expanded by qty).
// items: [{ id, name, image, qty }]. Returns a NEW tray.
export function addPieces(tray, items) {
  const pieces = [];
  for (const it of items) {
    for (let i = 0; i < (it.qty ?? 1); i++) {
      pieces.push({ id: it.id, name: it.name, image: it.image });
    }
  }
  return [...tray, ...pieces];
}

// eatPiece — remove the piece at `index`, returning a NEW tray (unchanged if oob).
export function eatPiece(tray, index) {
  if (index < 0 || index >= tray.length) return tray;
  return tray.filter((_, i) => i !== index);
}

export function trayCount(tray) { return tray.length; }
```

- [ ] **Step 4: Run, watch it pass**

Run: `node --test tests/tray.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add js/tray.js tests/tray.test.js
git commit -m "feat: sushi tray inventory module (add/eat/persist)"
```

---

### Task 9: `crunch()` sound

**Files:**
- Modify: `js/sound.js`

- [ ] **Step 1: Add the `crunch` export**

In `js/sound.js`, find the `export function spinOut()` function and insert immediately **after** its closing brace:

```js
// A short crunchy chew — two quick filtered-noise bites. Used by hold-to-eat.
export function crunch() {
  noise(0.05, 0.18, 1800, 4);
  noise(0.06, 0.14, 1200, 3);
}
```

- [ ] **Step 2: Verify the module loads and exports it**

Run: `node -e "import('./js/sound.js').then(m=>console.log('crunch:', typeof m.crunch))"`
Expected: prints `crunch: function`.

- [ ] **Step 3: Commit**

```bash
git add js/sound.js
git commit -m "feat: crunch() chew sound for hold-to-eat"
```

---

### Task 10: Tray / eat i18n strings

**Files:**
- Modify: `js/i18n.js`

- [ ] **Step 1: Add the strings**

In `js/i18n.js`, find `"menu.need": ...` (added in an earlier change, in the topbar/nav block) and add immediately after it:

```js
  "hud.tray":   { zh: "托盘", py: ["tuō","pán"], en: "Tray" },
  "tray.title": { zh: "你的托盘", py: ["nǐ","de","tuō","pán"], en: "Your Tray" },
  "tray.empty": { zh: "托盘空空，去点些寿司吧。", py: ["tuō","pán","kōng","kōng","qù","diǎn","xiē","shòu","sī","ba"], en: "Tray's empty — go order some sushi." },
  "tray.eaten": { zh: "已吃", py: ["yǐ","chī"], en: "Eaten" },
  "eat.done":   { zh: "我吃饱了！", py: ["wǒ","chī","bǎo","le"], en: "Gochisōsama 🥢" },
```

- [ ] **Step 2: Verify keys + pinyin alignment**

Run:
```bash
node -e '
import("./js/i18n.js").then(m=>{
  const isHan=c=>{const x=c.codePointAt(0);return x>=0x4e00&&x<=0x9fff};
  for(const k of ["hud.tray","tray.title","tray.empty","tray.eaten","eat.done"]){
    const e=m.t(k); const han=[...e.zh].filter(isHan).length;
    console.log((han===e.py.length?"ok ":"BAD ")+k+" han="+han+" py="+e.py.length+" | "+e.en);
  }
});'
```
Expected: five `ok` lines.

- [ ] **Step 3: Commit**

```bash
git add js/i18n.js
git commit -m "feat: i18n strings for the tray and eating"
```

---

### Task 11: Tray button + drawer markup

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add the Tray toggle to the topbar**

In `index.html`, find the order toggle button:
```html
      <button id="cart-toggle" class="cart-toggle" aria-label="打开订单">
        <span class="coin-ico" aria-hidden="true">◎</span> <span data-i18n="nav.bag"></span>
        <span id="cart-count" class="cart-badge">0</span>
      </button>
```
Insert immediately **after** it (still inside `<nav class="nav">`):
```html
      <button id="tray-toggle" class="cart-toggle" aria-label="打开托盘">
        <span class="coin-ico" aria-hidden="true">🍱</span> <span data-i18n="hud.tray"></span>
        <span id="tray-count" class="cart-badge">0</span>
      </button>
```

- [ ] **Step 2: Add the Tray drawer**

Find the order drawer's scrim line:
```html
  <div id="cart-scrim" class="scrim" hidden></div>
```
Insert immediately **after** it:
```html
  <!-- TRAY DRAWER — eat your ordered sushi -->
  <aside id="tray-drawer" class="cart-drawer tray-drawer" aria-hidden="true">
    <div class="cart-head">
      <h2 data-i18n="tray.title"></h2>
      <span class="tray-eaten"><span data-i18n="tray.eaten"></span> <span id="eaten-count">0</span></span>
      <button id="tray-close" class="cart-close" aria-label="关闭托盘">✕</button>
    </div>
    <ul id="tray-lines" class="cart-lines"><!-- rendered by main.js --></ul>
    <p class="tray-hint" aria-hidden="true">👆 hold a piece to eat it</p>
  </aside>
  <div id="tray-scrim" class="scrim" hidden></div>
  <div id="eat-flourish" class="eat-flourish" hidden></div>
```

- [ ] **Step 3: Verify the ids are present**

Run: `node -e "const h=require('fs').readFileSync('index.html','utf8');for(const id of ['tray-toggle','tray-count','tray-drawer','tray-lines','eaten-count','tray-close','tray-scrim','eat-flourish']) console.log(id, h.includes('id=\"'+id+'\"'))"`
Expected: every id prints `true`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: tray toggle, tray drawer, and eat-flourish markup"
```

---

### Task 12: Tray + eating styles

**Files:**
- Modify: `css/theme.css` (append)

- [ ] **Step 1: Append the styles**

Add to the **end** of `css/theme.css`:

```css
/* ===== Sushi tray + hold-to-eat ===== */
.tray-eaten { font-family: var(--game); font-size: 9px; color: var(--gold); margin-left: auto; margin-right: 12px; }
.tray-hint { font-family: var(--body); font-size: 12px; color: var(--text-dim); text-align: center; padding: 8px 0 16px; }

.tray-piece {
  position: relative; display: flex; align-items: center; gap: 12px;
  padding: 10px; margin-bottom: 10px; cursor: pointer; user-select: none;
  border: 2px solid var(--win-edge); border-radius: 10px;
  background: linear-gradient(180deg, #2a3a92, #18225f);
  box-shadow: 0 0 0 2px var(--win-ring), inset 0 2px 0 rgba(255,255,255,.12);
  touch-action: none;            /* let pointer-hold work on touch without scrolling */
  overflow: hidden;
}
.tray-piece .tp-img {
  width: 44px; height: 44px; object-fit: cover; border-radius: 7px;
  border: 2px solid #0a1030; image-rendering: auto; flex: none;
}
.tray-piece .tp-name { flex: 1; font-family: var(--kana); font-weight: 700; font-size: 14px; color: var(--text); }
.tray-piece .tp-name .en-gloss { font-family: var(--body); color: var(--text-dim); }
/* fill bar that grows while held */
.tray-piece .eat-fill {
  position: absolute; left: 0; bottom: 0; height: 4px; width: 0%;
  background: linear-gradient(90deg, var(--good), #8af0bb); box-shadow: 0 0 8px var(--good);
}
.tray-piece.eating { animation: chew-shake .12s steps(2) infinite; }
@keyframes chew-shake { 0%{transform:translate(0,0)} 50%{transform:translate(-1px,1px)} 100%{transform:translate(1px,0)} }

/* bite particles spawned on a finished bite */
.bite {
  position: fixed; z-index: 60; width: 7px; height: 7px; border-radius: 50%;
  background: var(--gold); pointer-events: none; animation: bite-fly .5s ease-out forwards;
}
@keyframes bite-fly { to { transform: translate(var(--bx), var(--by)) scale(.2); opacity: 0; } }

/* ごちそうさま flourish */
.eat-flourish {
  position: fixed; left: 50%; top: 40%; transform: translate(-50%,-50%) scale(.8);
  z-index: 70; pointer-events: none;
  font-family: var(--game); font-size: 16px; color: var(--gold);
  text-shadow: 0 2px 0 var(--gold-sh), 0 0 16px rgba(255,210,61,.7);
}
.eat-flourish.show { animation: flourish .9s ease-out forwards; }
@keyframes flourish {
  0% { opacity: 0; transform: translate(-50%,-50%) scale(.7); }
  25% { opacity: 1; transform: translate(-50%,-50%) scale(1.1); }
  100% { opacity: 0; transform: translate(-50%,-90%) scale(1); }
}
```

- [ ] **Step 2: Verify the selectors are present**

Run: `node -e "const c=require('fs').readFileSync('css/theme.css','utf8');for(const s of ['.tray-piece','.eat-fill','chew-shake','.bite','.eat-flourish']) console.log(s, c.includes(s))"`
Expected: every selector prints `true`.

- [ ] **Step 3: Commit**

```bash
git add css/theme.css
git commit -m "feat: tray piece + hold-to-eat visuals (fill, chew, particles, flourish)"
```

---

### Task 13: Order → tray + hold-to-eat in `main.js`

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: Add imports and state**

In `js/main.js`, replace the imports block:
```js
import { MENU } from "./data.js";
import { addItem, setQty, cartCount, cartSubtotal, saveCart, loadCart } from "./cart.js";
import { loadPoints, savePoints, canAfford, spend } from "./points.js";
import { biHtml, phraseHtml, applyI18n, initSpeech } from "./i18n.js";
import { mountArena } from "./arena.js";
import { mountBuilder } from "./builder.js";
```
with:
```js
import { MENU } from "./data.js";
import { addItem, setQty, cartCount, cartSubtotal, saveCart, loadCart } from "./cart.js";
import { loadPoints, savePoints, canAfford, spend } from "./points.js";
import { loadTray, saveTray, addPieces, eatPiece, trayCount } from "./tray.js";
import { biHtml, phraseHtml, applyI18n, initSpeech } from "./i18n.js";
import { mountArena } from "./arena.js";
import { mountBuilder } from "./builder.js";
import * as sfx from "./sound.js";
```

Then replace the state block:
```js
let cart = loadCart();
let points = loadPoints();
let openBuilder = () => {};   // set in init once the builder is mounted
```
with:
```js
let cart = loadCart();
let points = loadPoints();
let tray = loadTray();
let eaten = loadEaten();
let openBuilder = () => {};   // set in init once the builder is mounted

const EATEN_KEY = "shop.eaten";
const EAT_MS = 1500;          // hold duration to finish a bite
function loadEaten() { try { const n = parseInt(localStorage.getItem(EATEN_KEY), 10); return Number.isFinite(n) && n >= 0 ? n : 0; } catch { return 0; } }
function saveEaten(n) { try { localStorage.setItem(EATEN_KEY, String(n)); } catch { /* ignore */ } }
```

- [ ] **Step 2: Show tray count in the HUD**

Replace:
```js
function renderHud() {
  $("#points-count").textContent = points;
  $("#cart-count").textContent = cartCount(cart);
}
```
with:
```js
function renderHud() {
  $("#points-count").textContent = points;
  $("#cart-count").textContent = cartCount(cart);
  $("#tray-count").textContent = trayCount(tray);
}
```

- [ ] **Step 3: Send ordered food to the tray**

Replace `placeOrder`:
```js
function placeOrder() {
  const total = cartSubtotal(cart);
  if (total === 0 || !canAfford(points, total)) return;
  points = spend(points, total);
  savePoints(points);
  cart = [];
  saveCart(cart);
  renderAll();
  const confirm = $("#cart-confirm");
  confirm.hidden = false;
  setTimeout(() => { confirm.hidden = true; }, 3000);
}
```
with:
```js
function placeOrder() {
  const total = cartSubtotal(cart);
  if (total === 0 || !canAfford(points, total)) return;
  points = spend(points, total);
  savePoints(points);
  // the food you bought lands on your tray (with its image) to eat later
  const pieces = cart.map((l) => ({ id: l.id, name: l.name, image: MENU.find((m) => m.id === l.id)?.image, qty: l.qty }));
  tray = addPieces(tray, pieces);
  saveTray(tray);
  cart = [];
  saveCart(cart);
  renderAll();
  renderTrayDrawer();
  const confirm = $("#cart-confirm");
  confirm.hidden = false;
  setTimeout(() => { confirm.hidden = true; }, 3000);
}
```

- [ ] **Step 4: Add the tray drawer render + hold-to-eat**

Insert the following immediately **after** the `closeCart` function:

```js
// ---- Tray drawer (owned food) ----
function openTray() {
  $("#tray-drawer").classList.add("open");
  $("#tray-drawer").setAttribute("aria-hidden", "false");
  $("#tray-scrim").hidden = false;
}
function closeTray() {
  $("#tray-drawer").classList.remove("open");
  $("#tray-drawer").setAttribute("aria-hidden", "true");
  $("#tray-scrim").hidden = true;
}

function renderTrayDrawer() {
  $("#eaten-count").textContent = eaten;
  const lines = $("#tray-lines");
  if (tray.length === 0) {
    lines.innerHTML = `<li class="cart-empty">${biHtml("tray.empty")}</li>`;
    return;
  }
  lines.innerHTML = tray.map((p, i) => `
    <li class="tray-piece" data-i="${i}">
      <img class="tp-img" src="${p.image ?? ""}" alt="" onerror="this.style.display='none'" />
      <span class="tp-name">${phraseHtml(p.name)}</span>
      <span class="eat-fill"></span>
    </li>`).join("");
  lines.querySelectorAll(".tray-piece").forEach(bindEat);
}

// Minecraft-style hold-to-eat: hold to fill, release early to cancel.
function bindEat(el) {
  const i = Number(el.dataset.i);
  const fill = el.querySelector(".eat-fill");
  let raf = 0, startT = 0, active = false;

  const stop = () => {
    active = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    el.classList.remove("eating");
    fill.style.width = "0%";
  };
  const tick = (t) => {
    if (!active) return;
    if (!startT) startT = t;
    const p = Math.min(1, (t - startT) / EAT_MS);
    fill.style.width = (p * 100) + "%";
    if (p >= 1) { stop(); finishEat(i, el); return; }
    raf = requestAnimationFrame(tick);
  };
  const begin = (e) => {
    e.preventDefault();
    sfx.unlockAudio();
    active = true; startT = 0;
    el.classList.add("eating");
    sfx.crunch();
    raf = requestAnimationFrame(tick);
  };
  el.addEventListener("pointerdown", begin);
  el.addEventListener("pointerup", stop);
  el.addEventListener("pointerleave", stop);
  el.addEventListener("pointercancel", stop);
}

function finishEat(i, el) {
  spawnBiteParticles(el);
  tray = eatPiece(tray, i);
  saveTray(tray);
  eaten += 1; saveEaten(eaten);
  sfx.crunch();
  flashFlourish();
  renderHud();
  renderTrayDrawer();
}

function spawnBiteParticles(el) {
  const r = el.getBoundingClientRect();
  const cx = r.left + 40, cy = r.top + r.height / 2;
  for (let k = 0; k < 8; k++) {
    const b = document.createElement("span");
    b.className = "bite";
    b.style.left = cx + "px"; b.style.top = cy + "px";
    const ang = (k / 8) * Math.PI * 2;
    b.style.setProperty("--bx", Math.cos(ang) * 36 + "px");
    b.style.setProperty("--by", (Math.sin(ang) * 36 - 10) + "px");
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 520);
  }
}

function flashFlourish() {
  const f = $("#eat-flourish");
  f.innerHTML = biHtml("eat.done");
  f.hidden = false;
  f.classList.remove("show");
  void f.offsetWidth;          // restart the animation
  f.classList.add("show");
  setTimeout(() => { f.hidden = true; }, 900);
}
```

- [ ] **Step 5: Render the tray drawer in `renderAll` and wire the buttons**

Replace:
```js
function renderAll() {
  renderHud();
  renderMenu();
  renderTray();
}
```
with:
```js
function renderAll() {
  renderHud();
  renderMenu();
  renderTray();
  renderTrayDrawer();
}
```

Then, in `init`, find:
```js
  $("#cart-toggle").addEventListener("click", openCart);
  $("#cart-close").addEventListener("click", closeCart);
  $("#cart-scrim").addEventListener("click", closeCart);
  $("#checkout").addEventListener("click", placeOrder);
```
and insert after it:
```js
  $("#tray-toggle").addEventListener("click", openTray);
  $("#tray-close").addEventListener("click", closeTray);
  $("#tray-scrim").addEventListener("click", closeTray);
```

- [ ] **Step 6: Verify modules load and tests pass**

Run: `node -e "Promise.all([import('./js/tray.js'),import('./js/points.js'),import('./js/cart.js')]).then(()=>console.log('deps OK'))"`
Expected: prints `deps OK`.

Run: `npm test`
Expected: PASS (all suites).

- [ ] **Step 7: Commit**

```bash
git add js/main.js
git commit -m "feat: order food onto a tray + Minecraft-style hold-to-eat"
```

---

### Task 14: Manual playtest (all three features)

**Files:** none (verification only)

- [ ] **Step 1: Serve and open**

Run: `python3 -m http.server 8000` and open `http://localhost:8000`. In the console run `localStorage.clear(); location.reload();` to start fresh.

- [ ] **Step 2: Scoring**

Battle via the ⚔ button. Confirm: the per-side HUD shows **4 pip slots** filling by points; a knock-out fills **two** at once (Over) and the banner reads "Over Finish +2"; an out-spin reads "Spin Finish +1"; reaching **4 points** ends the match; the shop ★ wallet increases by the points you scored (+2 on the clinch).

- [ ] **Step 3: Physics feel**

Watch a few battles. Confirm: low-spin beys **wobble** and drift toward the rim; opposite-spin clashes **even out** the spins (spin-steal); hard hits **launch** the opponent sideways toward the rim; some matches end in a **Burst** ("Burst Finish +2"). No beys get stuck, fly off instantly, or freeze. (Tune `STADIUM_PARAMS.wobbleSpin` / `COLLISION.spinSteal,scrapeCoupling,burstGain` and `makeBey` `burstThreshold` if it feels off, then re-commit `js/arena.js`.)

- [ ] **Step 4: Eat**

Earn ★, order a few dishes, **Place Order** → confirm they appear in the **🍱 Tray** drawer (badge updates). Press-and-hold a piece: the fill grows, it chews, crunch plays; on completion it pops with particles + a **ごちそうさま** flourish, the piece is gone, and the "Eaten" tally rises. **Release early** → it cancels with no consume. Reload → tray + eaten persist.

- [ ] **Step 5: Mobile + regression**

Narrow to phone width; confirm the tray/eat work with touch (hold without scrolling). Run `npm test` once more — all suites green.

- [ ] **Step 6: Final commit (only if playtest tuning was needed)**

```bash
git add -A && git commit -m "fix: playtest tuning for scoring/physics/eating"
```

---

## Notes for the implementer

- **TDD scope:** the pure modules (`match`, `points`, `physics`, `tray`) are unit-tested; `arena.js` and `main.js` are DOM/canvas wiring, verified by the load checks + Task 14 playtest (matching the codebase convention).
- **Backward-compatible physics:** every new physics param defaults to a no-op (`wobbleSpin: 0`, `spinSteal/scrapeCoupling/burstGain: 0`, `inertia: 1`, `burstThreshold: Infinity`), and both early-return paths are preserved, so the pre-existing `physics.test.js` cases stay green.
- **Forward reference:** `classifyFinish` (Task 4) reads `loser.burst`, which is `undefined` until Task 7 gives beys a `burstThreshold`; Burst Finishes simply don't fire until Phase B lands.
- **Naming:** the order cart's render stays `renderTray()` (legacy name); the new owned-tray render is `renderTrayDrawer()` — keep them distinct.
