# Beyblade Realism + Sushi Eating — Design

**Date:** 2026-06-11
**Status:** Approved, ready for implementation plan

## Summary

Three independent enhancements to the existing sushi-shop / beyblade-arena game:

1. **Real Beyblade X scoring** — replace the arena's "first to 2 round wins" with
   the canonical Beyblade X point system (Spin 1 / Over 2 / Burst 2 / Xtreme 3,
   first to 4 points). The shop ★ wallet earns the battle points you score.
2. **Grounded physics realism** — add real spin dynamics (angular momentum,
   gyroscopic precession/wobble, spin-direction-dependent contact, spin↔motion
   coupling, burst stress) on top of the current 2D point-mass sim.
3. **Sushi tray + hold-to-eat** — ordered food lands on an owned tray; a
   Minecraft-style press-and-hold consumes a piece with progress, particles, and
   sound. Purely cosmetic/flavor.

They share no state and can ship independently. **Build order: scoring → physics
→ eating** (physics references the finish types scoring defines; eating is
standalone).

## Decisions (from brainstorming)

- Physics: **grounded realism** (additive spin dynamics), not a full rigid-body rewrite.
- Scoring: **Beyblade X canonical** — `{spin:1, over:2, burst:2, xtreme:3}`, first to **4**.
- Shop ★: **earn the battle points you score** (per-finish value added to the wallet).
- Eating: **hold-to-eat, cosmetic** — no buffs, no hunger meter.

## Non-Goals

- No full rigid-body / moment-of-inertia-tensor simulation; no 3D.
- No battle buffs or hunger system from eating (YAGNI).
- No change to the bilingual render core, the 16-bit front-page styling, or the
  builder screen beyond what scoring/HUD wiring requires.

---

## Feature 1 — Beyblade X scoring

### `js/match.js` (rewrite, pure + tested)
- `export const POINT_TARGET = 4;`
- `export const FINISH_POINTS = { spin: 1, over: 2, burst: 2, xtreme: 3 };`
- `newMatch(streak = 0)` → `{ round: 1, you: 0, rival: 0, streak, matchOver: false,
  matchWinner: null }` where `you`/`rival` are now **point totals** (not round wins).
- `recordRound(state, outcome, finish)`:
  - `outcome`: `"player" | "opponent" | "draw"`; `finish`: a `FINISH_POINTS` key
    (ignored on draw).
  - draw → unchanged state, same round (replays), as today.
  - else the winner gains `FINISH_POINTS[finish]`; `round` advances; `matchOver`
    when `you >= 4` or `rival >= 4`; `matchWinner` set; `streak` +1 on a player
    match win, reset to 0 on a loss. Input never mutated.
- `WIN_TARGET` export is removed (was the round-win count); `arena.js` imports
  `POINT_TARGET`/`FINISH_POINTS` instead.

### `js/arena.js` — classify the finish
`finishRound(outcome, reason)` becomes `finishRound(outcome, finish)` where the
loop computes the finish type before calling it:
- opponent `spin <= 0` (and still inside the rim) → `"spin"`.
- opponent pushed outside `stadium.r` (ring-out) → `"over"`, **unless** the
  attacker is railed or within `XTREME_WINDOW` frames of a rail release / active
  `special` → `"xtreme"`.
- opponent `burstStress >= burstThreshold` (Feature 2) → `"burst"` (takes
  precedence over spin/over when it trips).
- mutual death → `"draw"`.

`recordRound(match, outcome, finish)` is called with the classified finish. The
banner shows the finish name (new i18n keys `arena.finish.spin/over/burst/xtreme`).
Existing `arena.ringout`/`arena.spinout` strings are repurposed/kept as needed.

### HUD — points to 4 (`index.html`, `css/arena.css`)
The per-side pip readout (`#score-you` / `#score-rival`, round wins) becomes a
**row of 4 pip slots** per side, filled by `min(points, 4)` (a 2-point Over fills
two slots at once). `renderScore` fills pips from `match.you` / `match.rival`. The
🔥 streak HUD is unchanged.

### Shop ★ link (`js/points.js`, `js/arena.js`, `js/main.js`)
- `js/points.js`: replace `pointsForRound(wonRound, matchWon)` with
  `shopPointsForFinish(outcome, finishValue, matchWon)` →
  `(outcome === "player" ? finishValue : 0) + (matchWon ? MATCH_BONUS : 0)`,
  `MATCH_BONUS = 2`. (`canAfford`, `spend`, `loadPoints`, `savePoints` unchanged.)
- In `finishRound`, after `recordRound`, the arena computes
  `shopPointsForFinish(outcome, FINISH_POINTS[finish] ?? 0, match.matchOver &&
  match.matchWinner === "player")` and calls `opts.awardPoints(n)` when `n > 0`
  (existing callback in `main.js` adds + saves + re-renders the shop).

### Tests (`tests/match.test.js` rewrite, `tests/points.test.js` update)
- `match`: each finish value scores correctly; first-to-4 ends the match
  (incl. overshoot, e.g. 2 + Xtreme = 5 wins); draw replays; streak +1/reset;
  no mutation; a mixed-finish path to 4.
- `points`: `shopPointsForFinish` — player finish adds its value, opponent finish
  adds 0, match-win bonus, both.

---

## Feature 2 — Grounded physics realism

All additive **pure** functions/fields in `js/physics.js`; `arena.js` passes the
new params and reads the new fields. Beys without the new fields behave as today
(defaults preserve current tests).

### Spin as angular momentum + stamina
- `spin` is treated as angular speed (RPM-like). A per-bey **moment of inertia**
  `inertia` (derived in `arena.js` from build mass/radius, default 1) scales spin
  decay: `effectiveDecay = spinDecay * spinDecayMult / inertia` — heavier/wider
  beys hold spin longer (stamina). `stepBey` reads `bey.inertia`.

### Gyroscopic precession / wobble
- Below `wobbleSpin` (a fraction of launch spin), a bey **precesses**: `stepBey`
  adds a small spin-scaled oscillating offset to its position and **reduces the
  effective centering** (`centeringMult *= clamp(spin/wobbleSpin, lowFloor, 1)`),
  so low-spin beys drift toward the rim — the realistic "loss spiral." `wobble`
  becomes physical, not just cosmetic.

### Spin-direction contact + spin-steal (`resolveCollision`)
- Opposite-spin contact transfers **angular momentum** from the faster to the
  slower spinner: a fraction `spinSteal` of the gap `(faster.spin − slower.spin)`
  moves across (faster loses, slower… also loses net via friction, but the
  *transfer* models spin-steal). Same-spin contact keeps the current linear
  impulse with reduced spin drain. Net angular change is bounded so totals never
  go negative.

### Spin↔motion coupling (launch)
- On contact, a fraction `scrapeCoupling` of the attacker's spin converts to a
  **tangential linear impulse** on the opponent (perpendicular to the contact
  normal, signed by the attacker's `dir`). Fast spinners fling opponents toward
  the rim — the mechanism behind Over/Xtreme finishes.

### Burst stress
- Each hard contact adds `burstStress += hitImpulse * burstGain` to both beys
  (scaled by the *other's* attack). When `burstStress >= burstThreshold`
  (build-derived, passed in), that bey is flagged `burst = true` and `alive =
  false` → the arena reads it as a **Burst Finish**. Decays slowly when not hit.

### New params (passed from `arena.js`)
`{ spinSteal, scrapeCoupling, wobbleSpin, burstGain, burstThreshold }` added to
the existing step/collision param objects. New bey fields: `inertia`,
`burstStress`, `burst`.

### Tests (`tests/physics.test.js`, additive)
- moment of inertia: higher `inertia` → less spin lost per `stepBey`.
- precession: at `spin < wobbleSpin`, effective centering is reduced and a wobble
  offset is applied; at full spin it is not.
- spin-steal: after an opposite-spin collision the spin **gap narrows** and no
  spin goes negative; same-spin collision drains less.
- scrape coupling: a fast spinner imparts tangential velocity to a still opponent.
- burst: stress accumulates past threshold → `burst` flag + `alive = false`.
- Existing collision/step/AI/cardioid tests stay green (defaults preserve behavior).

---

## Feature 3 — Sushi tray + hold-to-eat

### `js/tray.js` (new, pure + tested)
Owned-food inventory, localStorage-backed (separate key from the order cart):
- `TRAY_KEY = "shop.tray"`.
- `loadTray()` / `saveTray(tray)` — array of `{ id, name, image }` pieces
  (one entry per piece; quantity = repeated entries), tolerant of missing storage.
- `addPieces(tray, items)` — append the ordered lines expanded by qty.
- `eatPiece(tray, index)` — remove the piece at `index`, return the new tray.
- `trayCount(tray)`.

### Order → tray (`js/main.js`)
`placeOrder` no longer just clears the cart: it `addPieces(tray, cart)`,
`saveTray`, then clears the cart (still spends ★, still confirms). A new topbar
**🍱 Tray** button (`#tray-toggle`, badge = `trayCount`) opens a **Tray drawer**
(mirrors the order drawer markup/style) listing each piece.

### Hold-to-eat (`js/main.js`, `js/sound.js`)
Each tray piece is a press-and-hold target:
- `pointerdown` starts a ~1500ms timer and a **progress ring/bar** that fills; a
  chew-shake animation runs and a soft crunch loop plays.
- Completing → `tray = eatPiece(tray, i)`, `saveTray`, spawn **bite particles**, a
  one-shot crunch, a **ごちそうさま / gochisōsama** flourish, and bump an
  `eaten` tally (persisted, shown on the tray header).
- `pointerup` / `pointerleave` / `pointercancel` **before** completion cancels
  (no consume) — true Minecraft behavior.
- `js/sound.js` gains `crunch()` (and reuses the existing audio-unlock). Respects
  the existing mute state.

### Markup / style (`index.html`, `css/theme.css`)
- New topbar `🍱 Tray` button + badge next to the Order toggle.
- New `#tray-drawer` (same sliding-window style as the order drawer), `#tray-lines`,
  a header with the `eaten` tally, and a `#tray-scrim`.
- Eating visuals: progress ring, `chew-shake` keyframes, particle + flourish CSS,
  styled in the 16-bit JRPG language already established.

### Tests (`tests/tray.test.js`, new)
`addPieces` (expands qty, appends), `eatPiece` (removes the right index, no
mutation), `trayCount`, `loadTray` default-on-missing.

---

## Files

- **New:** `js/tray.js`, `tests/tray.test.js`,
  `docs/superpowers/specs/2026-06-11-beyblade-realism-and-eating-design.md`.
- **Rewritten:** `js/match.js` (+ `tests/match.test.js`).
- **Modified:** `js/physics.js` (+ `tests/physics.test.js`), `js/arena.js` (finish
  classification, new physics params, scoring + ★ award, HUD points),
  `js/points.js` (+ `tests/points.test.js`) for `shopPointsForFinish`,
  `js/main.js` (order→tray, tray drawer, hold-to-eat), `js/sound.js` (`crunch`),
  `index.html` (Tray button + drawer, points-to-4 HUD), `css/theme.css` /
  `css/arena.css` (tray + eating visuals, HUD points), `js/i18n.js` (finish names,
  tray/eat strings).

## Testing Strategy

- **Pure / unit-tested:** `match` (points model), `points` (shop award),
  `physics` (the new spin dynamics), `tray` (inventory) — all via `node --test`.
  Existing render-core tests stay green.
- **DOM / canvas (playtested):** finish types scoring correctly and the points-to-4
  HUD; battles *feeling* more physical (wobble, spin-steal, launches, bursts);
  ordering food → tray → hold-to-eat with progress, particles, sound, and cancel
  on early release. Verified with the headless-Chrome screenshot loop where it helps.

## Risks / Open Questions

- **Physics tuning:** the new forces need constants that feel good without making
  matches degenerate (instant ring-outs or unkillable center-huggers). Defaults
  chosen conservatively; tuned in playtest. Pure functions keep it testable.
- **Finish classification edges:** simultaneous burst + ring-out, or ring-out on
  the exact frame spin hits 0 — resolved by a fixed precedence (burst > xtreme >
  over > spin) documented in `finishRound`.
- **Backward-compatible physics:** new fields are optional with defaults so the
  existing `physics.test.js` cases (no new fields) keep passing.
- **Scope:** three features in one spec; each phase is independently shippable, so
  the plan can stop after any phase if priorities change.
