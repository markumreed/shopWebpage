# Cardioid Rail + Catch/Ride/Release — Design

**Date:** 2026-06-07
**Status:** Approved, ready for implementation plan

## Summary

Replace the current X-Celerator mechanic — a circular ring band that gives an
instant forward impulse when a bey crosses it fast enough — with a **cardioid-
shaped rail** that a bey can **catch** onto, **ride** (accelerating as it
follows the curve), and **release** off the cusp to slingshot at the rival.

The cardioid (`r = a(1 − cos θ)`) is mathematically a heart but visually rounded
— a near-circular loop with a single soft cusp. The cusp is the release point
("the edge of the heart"). Both the player and the rival use the rail. Ride
direction follows the bey's spin direction. On release the bey's velocity is
aimed at the rival's current position so it reliably "speed-hits" them.

## Goals

- Turn the rail into a skillful, readable slingshot: catch → pick up speed →
  fling off the cusp at the rival.
- Keep the curve geometry and the catch/ride/release transitions **pure and
  unit-tested** in `physics.js`, consistent with the codebase convention.
- Reuse the existing spin-direction and gear features rather than adding new
  pre-match controls.

## Non-Goals

- No change to the pre-match controls (spin toggle, gear toggle, rival readout
  all stay as-is).
- No change to spin-steal drain, scoring, or round/match lifecycle.
- No multiple rails or configurable rail shapes — one centered cardioid.

## Decisions (from brainstorming)

- **Shape:** a cardioid (rounded, single cusp), centered in the bowl, cusp
  pointing downward (cosmetic — release aims at the rival regardless).
- **Ride direction:** follows the bey's spin direction (`dir`): right-spin
  (`+1`) rides one way along θ, left-spin (`−1`) the other.
- **Replaces** the instant ring dash entirely (`tryXtremeDash` and the `RAIL`
  ring band are removed).
- **Both** player and rival can catch and ride.
- **Release aim:** velocity points at the rival's current position
  ("aim at the rival").

## Architecture

Same split as today: pure geometry/physics in `js/physics.js` (unit-tested),
all DOM/canvas/game-feel wiring in `js/arena.js` (playtest-verified). The rail
is modeled as a small set of pure functions plus a per-bey "railed" state that
`arena.js`'s loop drives.

### Cardioid geometry (`physics.js`, pure + tested)

Represent the rail as a `cardioid` geometry object built once from a center,
scale, and rotation: `{ cx, cy, scale, rot, cuspTheta }`. The base polar form is
`r(θ) = scale · (1 − cos θ)` with `θ ∈ [0, 2π)`; the cusp is at `θ = 0` (where
`r = 0`). To center the shape in the bowl and orient the cusp downward, points
are computed in the cardioid's local frame and then rotated by `rot` and
translated by an offset so the shape is centered on `(cx, cy)`.

New pure functions:

- `cardioidPoint(theta, geom) → { x, y }` — the curve point at parameter θ
  (applies scale, rotation, centering offset).
- `cardioidTangent(theta, geom) → { x, y }` — the unit tangent at θ (analytic
  derivative of the parametric form, normalized; used for ride heading/visuals).
- `nearestCardioidParam(x, y, geom, samples = 180) → { theta, dist }` — sample
  the curve at `samples` points and return the θ of the closest sample and the
  distance to it. Used for catch detection and snapping.

Because the cusp sits at `θ = 0`, "reaching the cusp" is detected by θ crossing
0 / 2π in the ride direction.

### Per-bey rail state

`makeBey` gains fields (defaulting to the not-railed state so existing physics
tests are unaffected):

- `railed: false`
- `railTheta: 0`
- `railDir: 1` (along-curve sign while railed; set from spin `dir` on catch)
- `railSpeed: 0` (accumulated ride speed)

The existing `dashCd` (cooldown frames) is reused as the post-release cooldown.

### Catch / ride / release (pure helpers + loop wiring)

Pure helpers in `physics.js`:

- `tryCatchRail(bey, geom, gear) → { bey, caught }`
  - No catch if `!bey.alive`, `bey.railed`, or `(bey.dashCd ?? 0) > 0`.
  - Compute `{ theta, dist } = nearestCardioidParam(bey.x, bey.y, geom)`.
  - No catch if `dist > geom.catchDist` or
    `hypot(bey.vx, bey.vy) < gear.engageSpeed`.
  - On catch: return a new bey with `railed: true`, `railTheta: theta`,
    `railDir: (bey.dir ?? 1)`, `railSpeed: max(speed, gear.minRideSpeed)`.
    Never mutates input.

- `stepRail(bey, geom, gear) → { bey, released }`
  - Precondition: `bey.railed` is true.
  - Advance: `railSpeed = min(gear.rideCap, railSpeed + gear.rideAccel)`;
    `nextTheta = railTheta + railDir · (railSpeed / geom.arcScale)` (θ-advance
    scaled so higher speed moves further along the curve per frame).
  - Snap position to `cardioidPoint(nextTheta, geom)`; set `vx, vy` to
    `cardioidTangent(nextTheta) · railSpeed` (keeps velocity meaningful for the
    frame it releases and for visuals).
  - Apply a small spin trickle `spin = max(0, spin − gear.rideSpinDrain)`.
  - **Release** when the advance crosses the cusp (`θ` passes 0 / 2π in the
    ride direction): return a new bey with `railed: false`,
    `dashCd: geom.cooldown`, `spin = max(0, spin − gear.spinCost)`, and velocity
    left for `arena.js` to aim at the rival (see below). `released: true`.
  - Never mutates input.

`arena.js` owns the release **aim** because it knows the opponent's live
position (kept out of the pure helper to avoid coupling the two beys). On
`released`, `arena.js` sets the bey's velocity to a vector of magnitude
`railSpeed` pointing from the bey toward the rival's current position, then runs
the existing dash juice (callout, shake, trail, `sfx.xtreme()`).

### Main-loop integration (`arena.js`)

Per frame, for each bey, in order:

1. If `bey.railed`: call `stepRail`; on `released`, aim velocity at the rival,
   apply release FX. (Do **not** run free `stepBey` physics this frame for a
   railed bey — its motion is the rail.)
2. Else: run the normal `stepBey` free physics, then tick `dashCd` down, then
   call `tryCatchRail`; on `caught`, no FX yet (catch is silent; the payoff is
   the release).

Collision resolution and outcome checks run as today on the resulting positions.

### Rendering (`arena.js`)

Replace the dashed ring draw with the cardioid: stroke the sampled polyline as a
bright glowing track (gold, matching the current rail color), drawn beneath the
beys. Optionally brighten the cusp slightly to read as the launch point.

### Gear repurposing

`GEARS` keys (`high`, `standard`) stay, but fields change from the impulse model
to the ride model:

| Field | Meaning | High | Standard |
|---|---|---|---|
| `engageSpeed` | min speed to catch | low (easy) | higher |
| `rideAccel` | speed gained per frame on the rail | high | moderate |
| `rideCap` | max ride speed | high | moderate |
| `spinCost` | spin spent on release | higher | low |
| `rideSpinDrain` | small per-frame spin trickle while riding | small | smaller |
| `minRideSpeed` | floor applied to ride speed on catch | shared | shared |

Geometry-level constants live on the `cardioid`/rail geom object:
`catchDist`, `cooldown`, `arcScale`, plus `scale`/`rot`/center.

## What Is Removed

- `tryXtremeDash` in `physics.js` and its 7 tests in `tests/physics.test.js`.
- The `RAIL = { innerFrac, outerFrac, cooldown }` ring-band constant and the
  dashed-ring draw block in `arena.js`.
- The instant-impulse fields on `GEARS` (`dashImpulse`) — replaced as above.

Retained: `dir`/spin-steal, the spin + gear pre-match controls, the rival
randomization + readout, `sfx.xtreme()`, the callout/shake/trail juice.

## Testing Strategy

Unit tests (`tests/physics.test.js`) for the pure layer:

- `cardioidPoint`: known points — cusp at `θ = 0` maps to the cusp location;
  `θ = π` maps to the far (rounded) end; results are within the bowl.
- `cardioidTangent`: returns a unit vector; direction flips sense with θ.
- `nearestCardioidParam`: a point exactly on the curve returns ~0 distance at
  the right θ; a point far away returns a large distance.
- `tryCatchRail`: catches when near the curve and fast enough; no catch when
  too far, too slow, dead, already railed, or on cooldown; sets `railDir` from
  `dir`; does not mutate input.
- `stepRail`: advances θ in `railDir`; `railSpeed` ramps toward `rideCap`;
  position snaps onto the curve; releases (`released: true`, `railed: false`,
  `dashCd` set, spin cost applied) when the advance crosses the cusp; does not
  mutate input.

Game feel (`arena.js`) — the release aim, draw, FX, and loop ordering — is
verified by playtest, per the existing convention (no DOM tests).

## Risks / Open Questions

- **Ride-step tuning:** `arcScale`, `rideAccel`, and `rideCap` together set how
  fast a bey whips around the cardioid. First-pass values; tune by playtest. If
  the ride feels too long, raise `arcScale` (more θ per frame) or shorten the
  ridden arc.
- **Catch thrash:** `catchDist` too large will snap beys onto the rail
  constantly; `cooldown` after release prevents immediate re-catch. Tune both.
- **Release reliability:** aiming at the rival's *current* position is a
  snapshot at release; a moving rival may still be missed. Acceptable — the bey
  travels fast. Revisit if hits feel unfair.
- **Both beys releasing same frame:** the existing dash-juice double-fire
  observation (callout/sfx) still applies; not addressed here.
