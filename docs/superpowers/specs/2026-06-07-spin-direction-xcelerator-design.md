# Spin Direction + X-Celerator Gear System — Design

**Date:** 2026-06-07
**Status:** Approved, ready for implementation plan

## Summary

Two new pre-match choices and one new in-arena mechanic for the Beyblade arena:

1. **Spin direction (left/right)** — a strategic choice with real gameplay weight
   via spin-steal: opposite-spin matchups drain spin faster, same-spin matchups
   drain slower.
2. **X-Celerator rail + Xtreme Dash** — a gear-track ring on the stadium floor.
   When a bey crosses it at speed, its bit-gear meshes with the rail and it
   rockets forward in an Xtreme Dash.
3. **X-Celerator Gear System** — a pre-match gear choice (High / Standard) that
   scales how the Xtreme Dash behaves.

Both the player and the rival use all three. The rival rolls its spin direction
and gear randomly each round, shown to the player before launch so the player's
choice is informed.

## Goals

- Give the pre-match `"ready"` phase meaningful tactical choices.
- Stay faithful to the existing architecture: pure, tested physics in
  `physics.js`; DOM/canvas/game-feel wiring in `arena.js`; no new assets
  (sound stays procedural).
- Keep all tuning numbers as named constants so they can be adjusted after
  playtesting.

## Non-Goals

- No new finish types beyond the existing ring-out / spin-out / draw.
- No more than two gears (YAGNI — a third adds tuning burden without clear value).
- No persistence of the player's spin/gear choice across sessions.

## Feature 1 — Spin Direction (Strategic Spin-Steal)

### Data model
- Each bey gains a `dir` field: `+1` = right / clockwise, `-1` = left /
  counter-clockwise. Set in `makeBey` (default `+1`) and overridden at launch.

### Visual
- Rotation advance becomes direction-aware:
  `b.rot += b.dir * (0.25 + frac * 0.9)` in `spinVisuals`.
  Left-spinners visibly rotate the opposite way.

### Gameplay (in `physics.js`, pure + tested)
- `resolveCollision` factors spin direction into the contact spin drain.
  New params on the `COLLISION` object:
  - `oppositeSpinMult` (≈ `2.2`) — applied to `collisionSpinDrain` when the two
    beys spin in opposite directions.
  - `sameSpinMult` (≈ `0.7`) — applied when they spin the same direction.
- Effective per-clash drain for both beys =
  `collisionSpinDrain * (a.dir === b.dir ? sameSpinMult : oppositeSpinMult)`.
- The `superDrain` from a special is unaffected (still a flat one-shot).
- Beys without a `dir` field default to `+1` so existing behavior/tests that
  don't set direction keep working (same-spin path).

### Strategic intent
- **Opposite spin** → faster spin loss on every clash → favors aggressive
  spin-out finishes; good when you hold a spin-stamina lead.
- **Same spin** → gentler clashes → battles trend toward ring-outs.

### Choice / UI
- A segmented L/R toggle (`#spin-dir`) in `.arena-controls`.
- Editable only while `phase === "ready"`; disabled during `"spinning"` and
  `"done"`.
- The rival's direction for the round is chosen randomly in `startRound` and
  surfaced in a `#rival-setup` readout (e.g. `RIVAL  ↻ right · HIGH gear`).

## Feature 2 — X-Celerator Rail + Xtreme Dash

### Rail geometry
- An annulus band on the stadium floor:
  `railInner = stadium.r * 0.62`, `railOuter = stadium.r * 0.70`.
- Drawn as a bright dashed "gear-track" ring in `draw()`, beneath the beys.

### Engagement (pure helper in `physics.js`, tested)
- New function `tryXtremeDash(bey, stadium, rail, gear)`:
  - Returns `{ bey, fired }` (never mutates input).
  - Fires when ALL hold:
    - `bey.alive`
    - `bey.dashCd <= 0` (cooldown elapsed)
    - distance-from-center is within `[rail.inner, rail.outer]`
    - current speed `hypot(vx, vy) >= gear.engageSpeed`
  - On fire: adds an impulse of magnitude `gear.dashImpulse` along the bey's
    current unit heading vector (`vx += ux * dashImpulse`,
    `vy += uy * dashImpulse`), subtracts `gear.spinCost` from spin (clamped at
    0), and sets
    `bey.dashCd = DASH_COOLDOWN_FRAMES` (≈ `40`).
  - Each frame in the loop, `dashCd` is decremented toward 0 for both beys
    (handled in `arena.js` since it owns the frame loop, or as a tiny pure
    decrement — implementation detail for the plan).

### Feel (in `arena.js`)
- On a fired dash: spawn a streaked afterimage / motion burst along the heading,
  show a `"XTREME DASH!"` callout, trigger a small screen-shake (`"sm"`), and
  play `sfx.xtreme()`.
- New `sfx.xtreme()` in `sound.js`: a rising sawtooth rev + a short noise whoosh,
  built from the existing `blip`/`noise` helpers (no new infrastructure).

### Who dashes
- Both player and rival. The AI already steers around the bowl, so it will ride
  the rail naturally; `tryXtremeDash` is called for both beys each frame.

## Feature 3 — X-Celerator Gear System (Pre-Match Choice)

A segmented toggle (`#gear`) in `.arena-controls`, editable only while
`phase === "ready"`. Two gears with a genuine tradeoff:

| Gear | `dashImpulse` | `engageSpeed` | `spinCost` |
|---|---|---|---|
| **High (Xtreme)** | large | low (engages easily) | higher (burns stamina) |
| **Standard** | moderate | higher | low |

- Gears are defined as a named `GEARS` constant object in `arena.js`, e.g.
  `{ high: {...}, standard: {...} }`. First-pass numbers chosen during
  implementation and tuned after playtest.
- The rival rolls a random gear each round (shown in `#rival-setup`).

## Affected Files

- **`index.html`** — add `#spin-dir` and `#gear` segmented toggles plus a
  `#rival-setup` readout to `.arena-controls`.
- **`css/arena.css`** — styles for the segmented toggles, the readout line, and
  the Xtreme Dash streak/afterimage if CSS-driven (canvas streak is JS-drawn).
- **`js/physics.js`** — spin-direction drain in `resolveCollision`; new
  `tryXtremeDash` helper.
- **`js/arena.js`** — store/apply player `spinDir` and `gear`; randomize rival's
  in `startRound`; direction-aware `spinVisuals`; draw the rail; per-frame
  `tryXtremeDash` for both beys with dash visuals; cooldown bookkeeping; wire and
  enable/disable the new controls by phase; render `#rival-setup`.
- **`js/sound.js`** — new `xtreme()` SFX.
- **`tests/physics.test.js`** — tests for spin-steal drain (opposite vs same vs
  default) and for `tryXtremeDash` (fires inside band above threshold; no-fire
  when slow / outside band / on cooldown / dead; spin cost applied; input not
  mutated).
- **`js/main.js`** — pass the new element refs (`#spin-dir`, `#gear`,
  `#rival-setup`) into `mountArena`.

## Tuning Constants (first-pass, all named)

- `COLLISION.oppositeSpinMult ≈ 2.2`, `COLLISION.sameSpinMult ≈ 0.7`
- `RAIL = { innerFrac: 0.62, outerFrac: 0.70 }`
- `DASH_COOLDOWN_FRAMES ≈ 40`
- `GEARS.high = { dashImpulse, engageSpeed (low), spinCost (high) }`
- `GEARS.standard = { dashImpulse (lower), engageSpeed (higher), spinCost (low) }`

## Testing Strategy

- **Pure logic** (`physics.js`) gets unit tests as above — this is where
  correctness lives.
- **Game-feel / DOM** (`arena.js`, `sound.js`) is verified by playtest, matching
  the existing project convention (no DOM tests today).
- Existing 44 tests must continue to pass; new beys default `dir = +1` so any
  test not setting direction is unaffected.

## Risks / Open Questions

- Rail-as-full-ring + bowl-centering means beys spend a lot of time near the
  band; the speed threshold + cooldown are what keep the dash from spamming. If
  it still fires too often in playtest, raise `engageSpeed` or
  `DASH_COOLDOWN_FRAMES`.
- Spin-steal `oppositeSpinMult` interacts with the recently-eased rival
  difficulty; revisit win-rate feel after this lands.
