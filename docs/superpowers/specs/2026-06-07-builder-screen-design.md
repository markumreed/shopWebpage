# Builder Screen + Battle Image — Design

**Date:** 2026-06-07
**Status:** Approved, ready for implementation plan

## Summary

Promote the beyblade builder from an in-arena dropdown picker to a dedicated
**builder screen** reached by the red "DO NOT PRESS" button. The screen lets the
player pick Blade / Ratchet / Bit, shows the combined stats as a **horizontal
bar graph** and a preview of the selected blade, then enters the arena with that
bey via a **TO BATTLE** button. In the arena, the bey in the bowl is now the
**actual blade image, rotated by its spin** (with the procedural top as a
fallback). The in-arena part dropdowns are removed.

## Goals

- Make building a deliberate, readable step with a real stats visualization.
- Show the player's chosen parts *as* the fighting bey, not just HUD thumbnails.
- Keep the pure stat/physics core unit-tested; keep DOM/canvas playtest-verified.
- Keep `arena.js` from growing — the builder screen is its own module.

## Non-Goals

- No radar chart (bars chosen).
- No persistence across sessions (the build is held in memory; defaults on load).
- No compositing of the three part renders into one image — the **blade** image
  represents the bey in the bowl.
- No change to the spin-steal, rail, gear-from-xDash, or scoring logic.

## Decisions (from brainstorming)

- **Entry/flow:** red button → builder screen → (TO BATTLE) → arena. Arena
  **Exit returns to the builder**; the builder's **✕ returns to the shop**.
- **Graph:** horizontal bars (DOM), not radar.
- **Battle bey:** the blade image is **rotated** by the bey's spin angle in the
  bowl; falls back to the procedural top if the image isn't ready/missing.
- **Old picker:** the in-arena Blade/Ratchet/Bit dropdowns + stats text are
  **removed**; building happens only on the builder screen. The **Spin-direction
  toggle stays** in the arena (a per-launch tactical choice, not a part).

## Flow

```
Shop ──(red button)──▶ Builder screen ──(TO BATTLE)──▶ Arena
  ▲                        │  ▲                           │
  └──────(✕ close)─────────┘  └──────(Exit to garage)─────┘
```

`js/main.js` wires it: `#red-button` → `builder.open()`; the builder's
`onBattle(build)` → `arena.open(build)`; the arena's `onExit` → `builder.open()`.

## Builder screen (`js/builder.js` — new module)

`export function mountBuilder(opts)` mirrors `mountArena`'s shape. It owns the
`#builder` overlay and the current player build, and exposes `{ open, close }`.

`opts`: `overlayEl, bladeSelEl, ratchetSelEl, bitSelEl, graphEl, previewEl,
nameEl, battleBtnEl, closeBtnEl, onBattle`.

Behavior:
- On mount: populate the three `<select>`s from `BLADES`/`RATCHETS`/`BITS`
  (option value = array index, text = part name); default build = first of each;
  render the graph + preview; wire change handlers and buttons.
- On any select change: update the held build, re-render the bar graph and the
  blade preview image + name.
- `open()`: show the overlay, (re-)render to the current build.
- TO BATTLE button: `close()` the builder and call `onBattle(currentBuild)`.
- ✕ button: `close()` only — hiding the `#builder` overlay reveals the shop
  underneath, so no extra callback is needed.

State handoff: the builder holds the canonical player build; the arena receives
it as an argument to `open(build)` and does not keep its own default picker.

## Stats bar graph

A pure helper in `js/build.js`:

`buildBars(stats) → [{ label, value, pct }]` — one entry per displayed stat
(ATK, DEF, STA, X, BR), where `value` is the raw combined stat and `pct` is
`clamp01(value / max) * 100` rounded, with per-stat maxima: ATK/DEF/STA use the
summed-stat max (`150`), X uses `45`, BR uses `80` (matching the ranges in
`statsToPhysics`). This makes each bar fill relative to its own realistic
ceiling so a build's shape is legible.

The builder renders these as DOM rows (label + track + fill `width:{pct}%`),
styled in `css/builder.css`. `buildBars` is unit-tested; the DOM rendering is
playtested.

## Battle bey = rotating blade image (`js/arena.js`)

- **Image cache:** a small `imgFor(src)` helper caches `HTMLImageElement`s; the
  six blade images are preloaded at arena mount so they're ready by battle.
- **Bey carries its blade image:** in `startRound`, right after each
  `makeBey(...)` call, attach `player.img = imgFor(playerBuild.blade.image)` and
  `opponent.img = imgFor(rivalBuild.blade.image)` (`makeBey` itself stays
  parts-agnostic — it only knows the physics profile).
- **`drawBey`:** if `bey.img` is loaded (`img.complete && img.naturalWidth > 0`),
  draw it rotated by `bey.rot`: save → translate to `(b.x+wob, b.y+wob)` →
  `rotate(b.rot)` → `drawImage(img, -r, -r, 2r, 2r)` → restore, keeping the
  existing contact shadow, low-spin wobble, and impact bursts. `r` scales with
  the spin fraction as today (using `b.spin0`). If the image isn't ready, render
  the existing procedural top unchanged (fallback path retained).
- The HUD part-images (you / rival) remain, so all three parts stay visible.

## Arena changes

- `open(build)` takes the player's build; `startRound` builds the player bey
  from it and the rival from `randomBuild()` (unchanged). `onExit` returns to the
  builder.
- Remove the `.build-picker` block, `#build-stats`, and the select wiring
  (`fillSelect`/`renderPlayerBuild`/`applyPlayerBuild` and the change listeners)
  from the arena; that logic moves to `builder.js`. `setSetupEnabled` reverts to
  toggling only the Spin buttons. Keep `renderBuildImages` for the HUD.

## Files

- **New:** `js/builder.js`, `css/builder.css`.
- **Modified:** `index.html` (add `#builder` overlay + `css/builder.css` link;
  remove the arena `.build-picker`/`#build-stats`), `js/arena.js` (image cache +
  rotating `drawBey` with fallback, `open(build)`, remove picker wiring),
  `js/build.js` (`buildBars`), `js/main.js` (mount builder, wire the
  red→builder→arena→builder loop), `tests/build.test.js` (`buildBars` tests).

## Testing Strategy

- **Pure (unit-tested):** `buildBars` — correct labels/values, `pct` normalized
  per-stat and clamped to 0–100, order stable. `combineStats`/`statsToPhysics`
  unchanged and still green.
- **DOM / canvas (playtested):** builder screen wiring and graph, the
  red→builder→battle→builder loop, and the rotating blade image (incl. the
  procedural fallback when an image is missing).

## Risks / Open Questions

- **Angled renders rotating:** the part images are angled product shots, so a
  full rotation reads as a tumble rather than a flat spin. Accepted by the user.
  If it looks off in playtest, the fallback is the procedural top or an
  upright-with-spin-ring treatment — the `drawBey` branch is the only place to
  change.
- **Image readiness:** a rival's randomly-rolled blade may not be decoded on the
  first frame; the procedural fallback covers that until it loads.
- **Bar maxima** are first-pass; if a stat's bar always looks full or empty,
  tune the per-stat max in `buildBars`.
- **Exit-to-builder loop:** returning to the builder after Exit (rather than the
  shop) is intentional; the builder's ✕ is the way back to the shop.
