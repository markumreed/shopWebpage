# Beyblade Builder — Design

**Date:** 2026-06-07
**Status:** Approved, ready for implementation plan

## Summary

Add a part-based beyblade builder, inspired by [beybrew](https://github.com/yujinyuz/beybrew),
to the arena. Before a match the player assembles a bey from three parts —
**Blade + Ratchet + Bit** — chosen in the arena's pre-match controls. Each part
carries stats; the combined stats drive that bey's physics for the fight. The
rival is assembled from a random build each match. Part images appear in the
arena HUD; the spinning top in the bowl stays procedural, keeping its side color
(cyan you / magenta rival).

This replaces the High/Standard gear toggle: the chosen Bit's **xDash** stat now
determines X-Celerator rail performance.

## Goals

- Make builds matter: a heavy-defense bey plays differently from a glass-cannon
  attacker, all from the three picked parts.
- Mirror beybrew's part/stat structure (Blade/Ratchet/Bit; attack/defense/
  stamina; Bit also xDash + burstResistance) so the data is familiar.
- Keep the stat→physics mapping **pure and unit-tested**, per the codebase
  convention; keep `arena.js` playtest-verified.
- Tune so an *average* build feels like the game does today (no regression for a
  middling pick).

## Non-Goals

- No persistence (per decision: picks are chosen fresh each time the arena
  opens; nothing saved to localStorage).
- No CX-line 4-part combos, Assist Blades, or Lock Chips — just the core three
  slots.
- No deck/export features from beybrew (this is a single-bey builder for the
  fight, not a deck planner).
- We do **not** vendor beybrew's long part *descriptions* (creative prose). Only
  the factual stat fields and the part images are used.

## Decisions (from brainstorming)

- **Assets:** vendor a curated subset of beybrew's part **images + stat data**
  (not the full catalog, not the descriptions). Add an attribution/source note.
- **Rival:** assembled from a random build each match, shown in the rival readout.
- **Builder location:** an in-arena pre-match picker (three dropdowns) — not a
  separate page; nothing persists.
- **xDash replaces the gear toggle.** Spin-direction toggle stays (it's a launch
  choice, not a part).
- **Images in the HUD**, procedural top in the bowl.

## Data

### Vendored parts (`js/parts.js`, `assets/parts/`)

A curated subset — roughly **6 Blades, 6 Ratchets, 6 Bits** (18 images) — chosen
to span the type triangle (attack / defense / stamina / balance). Stored as pure
exported arrays:

- `BLADES`, `RATCHETS`: `{ id, name, image, attack, defense, stamina }`
- `BITS`: `{ id, name, image, attack, defense, stamina, xDash, burstResistance }`

`image` is a filename under `assets/parts/`. Stat fields and ranges mirror
beybrew (attack/defense/stamina ~5–75 per part; xDash ~5–45; burstResistance
~30–80). `assets/parts/SOURCE.md` credits beybrew and the underlying source.

## Build model (`js/build.js`, pure + tested)

- `combineStats(blade, ratchet, bit) → { attack, defense, stamina, xDash, burstResistance }`
  — `attack/defense/stamina` are the sum across the three parts; `xDash` and
  `burstResistance` come from the Bit.

- `statsToPhysics(stats) → profile` — normalizes each stat to 0–1 and lerps
  between bounds chosen so a mid build ≈ today's values. `norm(x, lo, hi) =
  clamp((x − lo)/(hi − lo), 0, 1)`. Reference ranges: attack/defense/stamina sums
  use `lo=30, hi=150`; `xDash` uses `5–45`; `burstResistance` uses `30–80`.
  The `profile` (all consumed by `arena.js`/physics):
  - `spin0     = 80 + 40·norm(stamina)`        → starting spin (80–120; ~100 mid)
  - `spinDecayMult = 1.2 − 0.4·norm(stamina)`  → scales global spin decay (0.8–1.2)
  - `mass     = 0.7 + 0.8·norm(defense)`       → knockback resistance (0.7–1.5)
  - `defMult  = 0.7 + 0.6·norm(defense)`       → divides spin lost when struck
  - `atkMult  = 0.7 + 0.6·norm(attack)`        → scales spin drained from the foe
  - `launchMult = 0.85 + 0.3·norm(attack)`     → scales launch speed (0.85–1.15)
  - `centeringMult = 1 + 0.8·norm(burstResistance)` → stronger self-centering →
    harder to ring out (our arena has no "burst" finish; burstResistance maps to
    ring-out survivability)
  - `gear = xDashToGear(xDash)` → the X-Celerator rail params (below)

- `xDashToGear(xDash) → { engageSpeed, rideAccel, rideCap, spinCost, rideSpinDrain, minRideSpeed }`
  — lerps between a low-xDash gear (hard to catch, gentle ride: like today's
  "standard") and a high-xDash gear (easy catch, hard ride: like "high") using
  `norm(xDash, 5, 45)`. Replaces the static `GEARS` table.

- `randomBuild() → { blade, ratchet, bit }` — picks one of each at random (uses
  `Math.random`; not unit-tested — the pure `combineStats`/`statsToPhysics` are
  what tests cover).

## Physics changes (`js/physics.js`, pure + tested)

The profile fields are attached to each bey (via `makeBey`) and read by the pure
functions, all with backward-compatible defaults so existing tests are
unaffected (a bey without the new fields behaves exactly as today):

- `stepBey`: scale spin decay by `bey.spinDecayMult ?? 1` and the bowl-centering
  force by `bey.centeringMult ?? 1`.
- `resolveCollision`: make the per-contact spin drain asymmetric — each bey's
  loss scales with the *other's* `atkMult` and its own `defMult`:
  `aLoss = drain · (b.atkMult ?? 1) / (a.defMult ?? 1)`, and symmetrically for b.
  The existing spin-direction multiplier still applies to `drain`. With all mults
  defaulting to 1, this reduces exactly to today's symmetric drain (existing
  tests pass unchanged).

## Pre-match picker (`index.html`, `css/arena.css`, `js/arena.js`)

In the arena controls, **remove the Gear toggle** and add three dropdowns —
**Blade / Ratchet / Bit** — each a `<select>` populated from `parts.js`. Below
them, a small panel shows the selected parts' **images** and a **combined-stats
readout** (Attack / Defense / Stamina / xDash / Burst). The Spin-direction toggle
stays. Defaults: the first entry of each array.

Selecting a part (while `phase === "ready"`) updates the player's build and the
stats readout; the build is locked at launch like the other controls.

## Arena integration (`js/arena.js`)

- On `startRound`: build the player's bey from the three current picks and the
  rival's from `randomBuild()`. `makeBey(name, x, y, color, dir, profile)` sets
  `spin = profile.spin0`, `mass = profile.mass`, and attaches `atkMult`,
  `defMult`, `spinDecayMult`, `centeringMult`, and `gear` (the rail gear) to the
  bey. The rival's parts show in the existing rival readout.
- `launchPlayer` / AI launch: scale launch speed by the bey's `launchMult` and
  start spin from `spin0`.
- `advanceRail`: use the bey's own `gear` (from its build) instead of the removed
  `GEARS[gearKey]` lookup.
- **HUD images:** each combatant's three part images render in the arena HUD,
  next to that side's spin meter (you vs rival), updating when the build changes
  / each round. The bowl top stays procedural and keeps its existing side color
  (cyan you / magenta rival); the build is conveyed through the HUD images and
  the stats readout rather than by recoloring the on-field top.

## Files

- **New:** `js/parts.js` (data), `js/build.js` (pure model + tests target),
  `assets/parts/*.png` (+ `SOURCE.md`).
- **Modified:** `js/physics.js` (decay/centering/drain hooks), `js/arena.js`
  (build wiring, drop gear toggle, HUD images, per-bey gear), `index.html`
  (part pickers + stat readout + HUD image slots, remove gear toggle markup),
  `css/arena.css` (picker + thumbnail + readout styles), `js/main.js` (new refs),
  `tests/physics.test.js` (collision/decay/centering default-preservation +
  new-behavior tests), and a new `tests/build.test.js`.

## Testing Strategy

Pure layer (unit-tested):
- `tests/build.test.js`: `combineStats` sums the three parts and pulls
  xDash/burstResistance from the Bit; `statsToPhysics` is monotonic (more stamina
  → more spin0; more defense → more mass and defMult; more attack → more atkMult
  and launchMult; more burstResistance → more centeringMult) and stays within the
  stated bounds; `xDashToGear` is monotonic and bounded.
- `tests/physics.test.js`: new tests that `stepBey` honors `spinDecayMult` /
  `centeringMult`, and `resolveCollision` applies asymmetric `atkMult`/`defMult`
  drain; plus regression tests that **defaults (no new fields) reproduce today's
  numbers** so the existing suite stays green.

Game feel / DOM (picker wiring, HUD images, draw) — playtest, per convention.

## Risks / Open Questions

- **Licensing:** beybrew's part images are official franchise renders; vendoring
  them into a public repo redistributes copyrighted assets. Accepted by the user
  for this fan project; mitigated by curating a small subset, using only factual
  stats (not the prose), and crediting the source. Easy to swap to custom art
  later — the data schema and physics mapping don't depend on the images.
- **Balance:** the normalization ranges (`lo/hi`) and lerp bounds are first-pass;
  tune by playtest so no build is degenerate (e.g., max-stamina stalling forever,
  or max-attack one-shotting). All bounds are named constants.
- **Image orientation:** beybrew renders are angled product shots, so they live
  in the HUD, not spun in the bowl. If a top-down render set is ever available,
  the bowl top could use it instead.
- **Rival fairness:** a fully random rival build can occasionally roll a hard
  counter; acceptable given best-of-3 and the difficulty easing already in place.
  Revisit if it feels swingy.
