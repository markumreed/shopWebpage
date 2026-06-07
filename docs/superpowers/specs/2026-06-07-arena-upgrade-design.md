# Arena Upgrade — Clear Win Conditions, Round Structure & Juice

**Date:** 2026-06-07
**Status:** Approved design, pending implementation plan

## Problem

The hidden Beyblade arena (`js/arena.js` + `js/physics.js`) already has working
win conditions, but nothing surfaces them to the player:

- No on-screen rules — the player doesn't know a match can be won by **ring-out**
  (knocked outside the stadium) or **spin-out** (spin decays to 0).
- No live feedback — there are no spin/health meters, so a match feels random.
- No structure — every launch is a one-off; there's no goal to play toward.

This upgrade adds **clarity** (rules + live meters + win-reason messaging),
**structure** (best-of-3 rounds, scoreboard, win streak), and **juice**
(a burst-special mechanic, impact callouts, scaled screen-shake).

## Goals

1. The player can always tell *how* to win and *who is winning right now*.
2. A match has a clear arc: best-of-3 rounds, first to 2 wins.
3. The game feels good to play: a usable special move and reactive feedback.

## Non-Goals (YAGNI)

- No selectable bey types / stat builds.
- No multiplayer or networking.
- No full state-machine / component-system refactor.
- No audio (visual juice only).

## Architecture

Preserve the existing split between **pure logic** (no DOM, unit-tested) and
**presentation** (DOM/canvas in `arena.js`).

| File | Role | Change |
|------|------|--------|
| `js/physics.js` | Pure physics | Extend `resolveCollision` with an optional special spin-drain |
| `js/match.js` | **New, pure** | Round/score/match/streak state transitions |
| `js/arena.js` | DOM + canvas + game loop | Wire meters, scoreboard, special, callouts, shake tiers, round flow |
| `index.html` | Arena markup | Add meters, scoreboard, rules panel, SPECIAL button |
| `css/arena.css` | Arena styling | Style the new elements |
| `tests/physics.test.js` | Existing | Add cases for special drain |
| `tests/match.test.js` | **New** | Cover match-state transitions |

### Data flow

```
input (charge/angle/special)
  → arena.js launchPlayer / activateSpecial
  → physics.js stepBey / resolveCollision (per frame)
  → arena.js reads bey.spin → updates meters + canvas each frame
  → physics.js decideOutcome → arena.js finish()
  → match.js recordRound(state, outcome, reason)
       → returns { score, matchOver, matchWinner, ... }
  → arena.js renders scoreboard / next round / match banner + streak
```

## Feature Detail

### 1. Clarity

**Live spin meters.** Two labeled horizontal bars above the canvas — `YOU`
(cyan) and `RIVAL` (magenta). Each frame, bar width = `bey.spin / START_SPIN`.
When a bey rings out, its meter is dimmed/zeroed to signal the cause wasn't spin.

**How-to-win panel.** A short blurb in the controls area, visible before launch:

> Knock the rival out of the ring (**RING OUT**) or outspin them
> (**SPIN OUT**). First to **2** round wins takes the match.

**Win-reason messaging.** The end-of-round banner names the *cause* then the
*result*, in two beats:

- Round end by ring-out: `RING OUT!` → `ROUND WON` / `ROUND LOST`
- Round end by spin-out: `SPIN OUT!` → `ROUND WON` / `ROUND LOST`
- Tie (both die same frame): `DRAW` → replay round (no score change)

`arena.js` already distinguishes ring-out from spin-out via the `ringout` flag
in `finish()`; this extends that to also cover the *opponent* dying by spin so
the reason is always correct for either bey.

### 2. Structure

**Best-of-3 rounds.** A match is first to **2** round wins. `match.js` owns the
count. After each non-draw round, show the round result, update the scoreboard,
then either start the next round (`Next Round` button) or end the match.

**Scoreboard.** Round pips in the arena HUD: `YOU ●● — ○○ RIVAL`, two pips per
side, filled as rounds are won.

**Win streak.** Consecutive **match** wins, persisted to `localStorage`
(key `arena.streak`). Shown in the HUD as `🔥 Streak: N`. A match loss resets
it to 0; a match win increments it. Reads tolerate missing/invalid storage
(default 0) and a write failure is non-fatal (streak just isn't persisted).

### 3. Burst Special

A once-per-round dash attack.

- **Charging:** a **burst meter** fills as the player bey lands collisions
  (increment per contact frame, capped at full). It resets at the start of each
  round.
- **Ready:** when full, the **SPECIAL** button enables and pulses.
- **Activation:** pressing SPECIAL while spinning sets `player.special = true`,
  adds a velocity impulse aimed at the opponent (a dash), and consumes the
  meter. The flag persists until the next collision resolves.
- **Effect:** in `resolveCollision`, if either bey has `special` true, that bey
  drains the *other* bey's spin by an extra `superDrain` amount on that contact,
  then the flag clears. Default `superDrain = 0` keeps current behavior and all
  existing tests green.

`resolveCollision` signature stays `(a, b, params)`; `params` gains an optional
`superDrain`. The per-bey `special` boolean is read off `a`/`b`.

### 4. Juice

**Impact callouts.** On each collision, compute impact from the pre-collision
relative speed along the normal. Thresholds map to escalating callouts:
`CLASH!` (light) → `SMASH!` (medium) → `MEGA HIT!` (hard). Rendered as a brief
floating banner near the impact point; does not block the loop.

**Scaled screen-shake.** `triggerShake` takes an intensity tier so big impacts
and ring-outs shake harder/longer than light taps (currently fixed). Implemented
via CSS classes (`shake-sm` / `shake-md` / `shake-lg`).

## Pure Module: `match.js`

Pure functions, no DOM. Illustrative shape (final names settled in the plan):

```js
// Fresh match state.
export function newMatch(streak = 0) { /* { round: 1, you: 0, rival: 0, streak, ... } */ }

// Apply a round outcome. outcome: "player" | "opponent" | "draw".
// Returns a NEW state plus derived flags.
export function recordRound(state, outcome) {
  // → { ...state, you, rival, round, matchOver, matchWinner, streak }
  // draw: no score change, same round replays.
  // matchWinner "player" → streak+1; "opponent" → streak reset to 0.
}

export const WIN_TARGET = 2; // first to 2
```

## Error Handling

- **localStorage unavailable / corrupt:** streak reads default to 0; writes are
  wrapped and failure is ignored (gameplay continues, streak just not saved).
- **Special pressed when not ready / not spinning:** no-op (button disabled, and
  the handler guards on phase + meter).
- **Rapid round transitions / double-clicks:** guard round advancement on the
  current `phase` so `Next Round` can't double-fire or interrupt an active loop.
- **Ghost loops:** keep the existing `cancelAnimationFrame` discipline on open /
  reset / round-advance.

## Testing

- `tests/match.test.js` (new): first-to-2 detection; draw replays without
  scoring; `matchOver`/`matchWinner` correctness; streak increments on match win
  and resets on match loss; default streak from `newMatch`.
- `tests/physics.test.js` (extend): `superDrain` applies extra drain to the
  *other* bey when `special` is set; absent/zero `superDrain` preserves existing
  behavior; special flag clears after resolution.
- Manual: meters track spin live; rules panel reads clearly; round flow advances
  and ends correctly; special charges, fires once per round, and visibly hits;
  callouts and shake tiers fire at the right intensities.

## Build Sequence (high level)

1. `match.js` + `tests/match.test.js` (TDD the pure round/score/streak logic).
2. `physics.js` `superDrain` + tests.
3. `index.html` + `arena.css`: meters, scoreboard, rules panel, SPECIAL button.
4. `arena.js`: meters wiring → round flow via `match.js` → special → callouts +
   shake tiers → streak persistence.
5. Manual playtest pass.
