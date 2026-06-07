# Builder Screen + Battle Image Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move beyblade building to a dedicated screen (Blade/Ratchet/Bit picker + horizontal bar-graph stats + blade preview) reached by the red button, hand the built bey to the arena via a TO BATTLE button, and draw the blade image — rotated by spin — as the bey in the bowl.

**Architecture:** A pure `buildBars` helper in `build.js` turns combined stats into bar rows. A new `js/builder.js` (`mountBuilder`) owns a `#builder` overlay and emits the chosen build via `onBattle`. `js/arena.js` loses its in-arena dropdowns, gains `open(build)`, and `drawBey` renders the rotating blade image (with the procedural top as fallback). `js/main.js` wires the red→builder→arena→builder loop.

**Tech Stack:** Vanilla ES modules, HTML5 canvas, Node's built-in test runner (`node --test`).

---

## File Structure

- `js/build.js` — **modify**: add pure `buildBars(stats)`. Tested.
- `tests/build.test.js` — **modify**: `buildBars` tests.
- `js/builder.js` — **new**: `mountBuilder(opts)` controller for the builder screen.
- `css/builder.css` — **new**: builder overlay + bar-graph styles.
- `index.html` — **modify**: link `builder.css`; add `#builder` overlay; remove the arena `.build-picker` block.
- `js/arena.js` — **modify**: `open(build)`; remove picker wiring; image cache + rotating `drawBey` with procedural fallback.
- `js/main.js` — **modify**: mount the builder; wire red→builder→arena→builder; drop the moved select refs.

Current test baseline: **82 passing**.

---

## Task 1: `buildBars` pure helper

**Files:**
- Modify: `js/build.js`
- Test: `tests/build.test.js`

- [ ] **Step 1: Write the failing tests**

Append to the END of `tests/build.test.js`:

```javascript
import { buildBars } from "../js/build.js";

test("buildBars returns one row per stat in fixed order with raw values", () => {
  const rows = buildBars({ attack: 60, defense: 40, stamina: 30, xDash: 25, burstResistance: 55 });
  assert.deepEqual(rows.map(r => r.label), ["ATK", "DEF", "STA", "X", "BR"]);
  assert.deepEqual(rows.map(r => r.value), [60, 40, 30, 25, 55]);
});

test("buildBars normalizes each stat to its own max as a 0-100 percent", () => {
  const rows = buildBars({ attack: 75, defense: 150, stamina: 0, xDash: 45, burstResistance: 40 });
  const pct = Object.fromEntries(rows.map(r => [r.label, r.pct]));
  assert.equal(pct.ATK, 50);  // 75 / 150
  assert.equal(pct.DEF, 100); // 150 / 150
  assert.equal(pct.STA, 0);   // 0 / 150
  assert.equal(pct.X, 100);   // 45 / 45
  assert.equal(pct.BR, 50);   // 40 / 80
});

test("buildBars clamps percent to 100 when a stat exceeds its max", () => {
  const rows = buildBars({ attack: 300, defense: 0, stamina: 0, xDash: 90, burstResistance: 160 });
  const pct = Object.fromEntries(rows.map(r => [r.label, r.pct]));
  assert.equal(pct.ATK, 100);
  assert.equal(pct.X, 100);
  assert.equal(pct.BR, 100);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test 2>&1 | grep -E "buildBars|# fail"`
Expected: FAIL — `buildBars is not a function`.

- [ ] **Step 3: Implement `buildBars`**

Append to `js/build.js` (after `statsToPhysics`):

```javascript
// Per-stat bar maxima for the builder graph: the summed atk/def/sta share the
// summed-stat ceiling; xDash and burstResistance use their own ranges (matching
// statsToPhysics). Each bar fills relative to its own realistic max.
const BAR_MAX = { attack: 150, defense: 150, stamina: 150, xDash: 45, burstResistance: 80 };
const BAR_ROWS = [
  { key: "attack", label: "ATK" },
  { key: "defense", label: "DEF" },
  { key: "stamina", label: "STA" },
  { key: "xDash", label: "X" },
  { key: "burstResistance", label: "BR" },
];

// buildBars — turn combined stats into rows for the builder's bar graph:
// { label, value (raw), pct (0-100, clamped, normalized to that stat's max) }.
export function buildBars(stats) {
  return BAR_ROWS.map(({ key, label }) => ({
    label,
    value: stats[key],
    pct: Math.round(clamp01(stats[key] / BAR_MAX[key]) * 100),
  }));
}
```

(`clamp01` is already defined at the top of `build.js`.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test`
Expected: PASS — 82 + 3 = 85 tests, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add js/build.js tests/build.test.js
git commit -m "feat: buildBars — combined stats to normalized bar-graph rows"
```

---

## Task 2: Builder screen + flow rewire (remove in-arena picker)

**Files:**
- Create: `js/builder.js`, `css/builder.css`
- Modify: `index.html`, `js/arena.js`, `js/main.js`

After this task, the red button opens the builder screen; TO BATTLE enters the arena with the chosen bey; Exit returns to the builder; the arena has no dropdowns. (The bowl still draws the procedural top — the image comes in Task 3.)

- [ ] **Step 1: Create `js/builder.js`**

```javascript
// builder.js — the pre-battle builder screen. Owns the #builder overlay: a
// Blade/Ratchet/Bit picker, a horizontal bar-graph of the combined stats, and a
// preview of the selected blade. TO BATTLE hands the chosen build to the arena.
import { BLADES, RATCHETS, BITS } from "./parts.js";
import { combineStats, buildBars } from "./build.js";

export function mountBuilder(opts) {
  const {
    overlayEl, bladeSelEl, ratchetSelEl, bitSelEl,
    graphEl, previewEl, nameEl, battleBtnEl, closeBtnEl, onBattle,
  } = opts;

  let build = { blade: BLADES[0], ratchet: RATCHETS[0], bit: BITS[0] };

  function fillSelect(sel, arr) {
    sel.innerHTML = "";
    arr.forEach((p, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = p.name;
      sel.appendChild(o);
    });
  }

  function renderGraph() {
    const bars = buildBars(combineStats(build.blade, build.ratchet, build.bit));
    graphEl.innerHTML = "";
    bars.forEach((bar) => {
      const row = document.createElement("div"); row.className = "bar-row";
      const label = document.createElement("span"); label.className = "bar-label"; label.textContent = bar.label;
      const track = document.createElement("div"); track.className = "bar-track";
      const fill = document.createElement("div"); fill.className = "bar-fill"; fill.style.width = bar.pct + "%";
      const val = document.createElement("span"); val.className = "bar-val"; val.textContent = String(bar.value);
      track.appendChild(fill);
      row.append(label, track, val);
      graphEl.appendChild(row);
    });
  }

  function renderPreview() {
    previewEl.style.visibility = "visible";
    previewEl.src = build.blade.image;
    previewEl.alt = build.blade.name;
    previewEl.onerror = () => { previewEl.style.visibility = "hidden"; };
    nameEl.textContent = `${build.blade.name} / ${build.ratchet.name} / ${build.bit.name}`;
  }

  function render() { renderGraph(); renderPreview(); }

  function open() { overlayEl.hidden = false; render(); }
  function close() { overlayEl.hidden = true; }

  fillSelect(bladeSelEl, BLADES);
  fillSelect(ratchetSelEl, RATCHETS);
  fillSelect(bitSelEl, BITS);
  bladeSelEl.addEventListener("change", () => { build = { ...build, blade: BLADES[Number(bladeSelEl.value)] }; render(); });
  ratchetSelEl.addEventListener("change", () => { build = { ...build, ratchet: RATCHETS[Number(ratchetSelEl.value)] }; render(); });
  bitSelEl.addEventListener("change", () => { build = { ...build, bit: BITS[Number(bitSelEl.value)] }; render(); });
  battleBtnEl.addEventListener("click", () => { close(); onBattle(build); });
  closeBtnEl.addEventListener("click", close);
  render();

  return { open, close };
}
```

- [ ] **Step 2: Create `css/builder.css`**

```css
/* Builder screen — full-screen overlay reached from the red button */
.builder { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center;
  background: radial-gradient(circle at 50% 35%, #161226, #07060f 70%);
  font-family: var(--display, sans-serif); color: #eaf7ff; }
.builder[hidden] { display: none; }
.builder-panel { position: relative; width: min(680px, 92vw); background: rgba(12,10,26,.92);
  border: 1.5px solid #2bf2ff; border-radius: 14px; padding: 28px 26px 26px;
  box-shadow: 0 0 40px rgba(43,242,255,.25); text-align: center; }
.builder-close { position: absolute; top: 10px; right: 12px; background: none; border: 0;
  color: #eaf7ff; font-size: 22px; cursor: pointer; opacity: .7; }
.builder-close:hover { opacity: 1; }
.builder-title { margin: 0 0 18px; font-size: clamp(22px, 5vw, 36px); letter-spacing: 2px;
  text-transform: uppercase; }
.builder-title span { color: #ff2bd6; text-shadow: 0 0 16px rgba(255,43,214,.7); }
.builder-body { display: flex; gap: 22px; align-items: center; flex-wrap: wrap; justify-content: center; }
.builder-preview { flex: 0 0 200px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.builder-blade-img { width: 180px; height: 180px; object-fit: contain;
  background: rgba(255,255,255,.05); border-radius: 12px; }
.builder-name { margin: 0; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #2bf2ff; }
.builder-config { flex: 1 1 300px; min-width: 260px; display: flex; flex-direction: column; gap: 16px; }
.builder-selects { display: flex; flex-direction: column; gap: 8px; }
.builder-field { display: flex; justify-content: space-between; align-items: center; gap: 10px;
  font-size: 12px; letter-spacing: 1px; text-transform: uppercase; }
.builder-field .part-select { flex: 1; }
/* bar graph */
.builder-graph { display: flex; flex-direction: column; gap: 6px; }
.bar-row { display: grid; grid-template-columns: 34px 1fr 32px; align-items: center; gap: 8px; }
.bar-label { font-size: 11px; letter-spacing: 1px; color: rgba(234,247,255,.85); text-align: right; }
.bar-track { height: 12px; background: #15122b; border: 1px solid rgba(43,242,255,.4); border-radius: 6px; overflow: hidden; }
.bar-fill { height: 100%; background: linear-gradient(90deg, #2bf2ff, #ff2bd6); transition: width .15s ease; }
.bar-val { font-size: 11px; color: #eaf7ff; text-align: left; }
.builder-battle { margin-top: 22px; }
```

- [ ] **Step 3: Link the stylesheet + add the `#builder` overlay in `index.html`**

In `<head>`, after the `css/arena.css` link, add:

```html
  <link rel="stylesheet" href="css/builder.css" />
```

Immediately BEFORE the `<!-- ARENA OVERLAY (hidden until red button) -->` comment, insert:

```html
  <!-- BUILDER SCREEN (hidden until red button) -->
  <div id="builder" class="builder" hidden>
    <div class="builder-panel">
      <button id="builder-close" class="builder-close" aria-label="Back to shop">✕</button>
      <h2 class="builder-title">BUILD YOUR <span>BEYBLADE</span></h2>
      <div class="builder-body">
        <div class="builder-preview">
          <img id="builder-blade-img" class="builder-blade-img" alt="" />
          <p id="builder-name" class="builder-name"></p>
        </div>
        <div class="builder-config">
          <div class="builder-selects">
            <label class="builder-field">Blade <select id="sel-blade" class="part-select" aria-label="Blade"></select></label>
            <label class="builder-field">Ratchet <select id="sel-ratchet" class="part-select" aria-label="Ratchet"></select></label>
            <label class="builder-field">Bit <select id="sel-bit" class="part-select" aria-label="Bit"></select></label>
          </div>
          <div id="builder-graph" class="builder-graph"></div>
        </div>
      </div>
      <button id="builder-battle" class="btn-launch builder-battle">⚔&nbsp;TO&nbsp;BATTLE</button>
    </div>
  </div>
```

- [ ] **Step 4: Remove the in-arena build picker from `index.html`**

Delete this block from inside `.arena-controls`:

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

(The `#sel-blade`/`#sel-ratchet`/`#sel-bit` ids now live only in `#builder`, so there's no duplicate-id collision.)

- [ ] **Step 5: Remove the picker wiring from `js/arena.js`**

(a) In the `opts` destructure, change:
```javascript
    spinDirEl, rivalSetupEl,
    bladeSelEl, ratchetSelEl, bitSelEl, buildStatsEl, buildYouEl, buildRivalEl,
```
to:
```javascript
    spinDirEl, rivalSetupEl, buildYouEl, buildRivalEl,
```

(b) Revert `setSetupEnabled` (remove the selects line):
```javascript
  function setSetupEnabled(on) {
    spinDirEl.querySelectorAll(".seg-btn").forEach((b) => { b.disabled = !on; });
    [bladeSelEl, ratchetSelEl, bitSelEl].forEach((s) => { s.disabled = !on; });
  }
```
becomes:
```javascript
  function setSetupEnabled(on) {
    spinDirEl.querySelectorAll(".seg-btn").forEach((b) => { b.disabled = !on; });
  }
```

(c) Delete the `fillSelect`, `renderPlayerBuild`, and `applyPlayerBuild` functions entirely. KEEP `renderBuildImages` (it still renders the HUD thumbnails) — it currently sits between `fillSelect` and `renderPlayerBuild`, so remove the three named functions around it. After the edit, the only function left in that group is:
```javascript
  // ---- HUD part images ----
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
```

(d) In `startRound`, change:
```javascript
    renderRivalSetup();
    renderPlayerBuild();
    renderBuildImages(buildRivalEl, rivalBuild);
    draw();
```
to:
```javascript
    renderRivalSetup();
    renderBuildImages(buildYouEl, playerBuild);
    renderBuildImages(buildRivalEl, rivalBuild);
    draw();
```

(e) Delete the select population + change-listener block near the end of `mountArena`:
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
  syncSetupControls();
  renderPlayerBuild(); // initialize stats + HUD images to match the default build
```
and replace it with just:
```javascript
  syncSetupControls();
```

- [ ] **Step 6: Make `arena.open` accept the player's build**

In `js/arena.js`, change the `open` function:
```javascript
  function open() {
    cancelAnimationFrame(raf); // stop any ghost loop before re-initialising
    overlayEl.hidden = false;
```
to:
```javascript
  function open(build) {
    if (build) playerBuild = build;
    cancelAnimationFrame(raf); // stop any ghost loop before re-initialising
    overlayEl.hidden = false;
```

(`playerBuild` keeps its `BLADES[0]/RATCHETS[0]/BITS[0]` default as a fallback if `open` is ever called with no build.)

- [ ] **Step 7: Wire the screens in `js/main.js`**

Add the builder import near the top (with the other imports):
```javascript
import { mountBuilder } from "./builder.js";
```

In the `mountArena({ ... })` options, remove the four moved select refs:
```javascript
    bladeSelEl: $("#sel-blade"),
    ratchetSelEl: $("#sel-ratchet"),
    bitSelEl: $("#sel-bit"),
    buildStatsEl: $("#build-stats"),
```
(keep `buildYouEl`/`buildRivalEl`/`spinDirEl`/`rivalSetupEl`), and change `onExit` to return to the builder:
```javascript
    onExit: () => {}
```
becomes:
```javascript
    onExit: () => builder.open(),
```

Then replace the red-button wiring at the bottom:
```javascript
  $("#red-button").addEventListener("click", arena.open);
  $("#arena-exit").addEventListener("click", arena.close);
```
with:
```javascript
  const builder = mountBuilder({
    overlayEl: $("#builder"),
    bladeSelEl: $("#sel-blade"),
    ratchetSelEl: $("#sel-ratchet"),
    bitSelEl: $("#sel-bit"),
    graphEl: $("#builder-graph"),
    previewEl: $("#builder-blade-img"),
    nameEl: $("#builder-name"),
    battleBtnEl: $("#builder-battle"),
    closeBtnEl: $("#builder-close"),
    onBattle: (build) => arena.open(build),
  });
  $("#red-button").addEventListener("click", () => builder.open());
  $("#arena-exit").addEventListener("click", arena.close);
```

(`builder` is referenced inside the arena's `onExit` arrow, which only fires later on Exit — after `builder` is assigned — so there's no temporal-dead-zone issue.)

- [ ] **Step 8: Verify parse + tests + grep**

Run: `node --check js/builder.js && node --check js/arena.js && node --check js/main.js` → exit 0.
Run: `node --test` → 85 pass, 0 fail.
Run: `grep -n "build-picker\|build-stats\|fillSelect\|renderPlayerBuild\|applyPlayerBuild\|bladeSelEl\|buildStatsEl" js/arena.js index.html` → no matches.
Run: `grep -c "id=\"sel-blade\"" index.html` → exactly `1` (only in `#builder`).

- [ ] **Step 9: Playtest**

Open `index.html`, press the red button → the **builder screen** appears with three dropdowns, a live **bar graph**, and a blade preview that update as you change parts. **⚔ TO BATTLE** opens the arena with that build; the arena has **no dropdowns** (just the Spin toggle). **Exit** returns to the builder; the builder **✕** returns to the shop. The rival still varies each match (parts shown in the HUD + readout).

- [ ] **Step 10: Commit**

```bash
git add js/builder.js css/builder.css index.html js/arena.js js/main.js
git commit -m "feat: dedicated builder screen; red->builder->arena->builder flow"
```

---

## Task 3: Draw the rotating blade image as the battle bey

**Files:**
- Modify: `js/arena.js`

- [ ] **Step 1: Add an image cache + preload blades**

In `js/arena.js`, inside `mountArena`, right after the `const rail = { ... };` block, add:

```javascript
  // blade-image cache: the bowl draws each bey's blade render, preloaded so it's
  // ready by battle. imgFor returns a cached HTMLImageElement per src.
  const imgCache = new Map();
  function imgFor(src) {
    let im = imgCache.get(src);
    if (!im) { im = new Image(); im.src = src; imgCache.set(src, im); }
    return im;
  }
  BLADES.forEach((b) => imgFor(b.image)); // warm the cache
```

- [ ] **Step 2: Attach each bey's blade image in `startRound`**

In `startRound`, immediately AFTER the two `makeBey(...)` lines:
```javascript
    player = makeBey("You", stadium.cx - 120, stadium.cy, "#2bf2ff", playerDir, buildProfile(playerBuild));
    opponent = makeBey("Rival", stadium.cx + 120, stadium.cy, "#ff2bd6", rivalDir, buildProfile(rivalBuild));
```
add:
```javascript
    player.img = imgFor(playerBuild.blade.image);
    opponent.img = imgFor(rivalBuild.blade.image);
```

- [ ] **Step 3: Render the rotating image in `drawBey` (procedural fallback)**

Replace the entire `drawBey` function with:

```javascript
  function drawBey(b) {
    if (!b.alive) return;
    const frac = Math.max(0, b.spin) / b.spin0;
    const r = b.radius * (0.82 + 0.18 * frac);
    // wobble grows as the top loses spin (a dying top tips and circles)
    const wob = (1 - frac) * 4;
    const wx = Math.cos(b.wobble) * wob;
    const wy = Math.sin(b.wobble * 1.3) * wob * 0.6;

    ctx.save();

    // contact shadow on the stadium floor for depth
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(b.x + 4, b.y + 8, r * 1.05, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.translate(b.x + wx, b.y + wy);

    // motion-blur energy ring: brighter/larger the faster it spins (both looks)
    ctx.save();
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = b.color;
    ctx.globalAlpha = 0.18 + 0.32 * frac;
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const sweep = 0.7 + frac * 1.4;
      const off = b.rot * 0.5 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.3, off, off + sweep);
      ctx.stroke();
    }
    ctx.restore();

    const img = b.img;
    if (img && img.complete && img.naturalWidth > 0) {
      // the actual blade render, rotated by its spin angle
      ctx.save();
      ctx.rotate(b.rot);
      const s = r * 2.4;
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.restore();
      ctx.restore();
      return;
    }

    // ---- fallback: procedural metal top (when the image isn't ready) ----
    // spinning metal attack ring — ghosted copies simulate motion blur
    ctx.save();
    ctx.rotate(b.rot);
    bladeRing(r, 6, b.color, 1);
    ctx.rotate(-0.18);
    bladeRing(r, 6, b.color, 0.35 * frac);
    ctx.rotate(-0.18);
    bladeRing(r, 6, b.color, 0.18 * frac);
    ctx.restore();
    ctx.globalAlpha = 1;

    // metallic disc body (radial gradient = brushed-metal sheen)
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 0.78);
    g.addColorStop(0, "#f4f7fa");
    g.addColorStop(0.45, "#aeb7c2");
    g.addColorStop(0.8, "#5b636e");
    g.addColorStop(1, "#2c3138");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    ctx.fill();

    // colored hub ring
    ctx.strokeStyle = b.color;
    ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    // center bolt with screw cross and specular highlight
    const bg = ctx.createRadialGradient(-r * 0.12, -r * 0.12, 1, 0, 0, r * 0.32);
    bg.addColorStop(0, "#ffffff");
    bg.addColorStop(0.6, "#c9d2dc");
    bg.addColorStop(1, "#6b7480");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(40,46,54,.8)";
    ctx.lineWidth = 2;
    ctx.save();
    ctx.rotate(b.rot * 0.4);
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, 0); ctx.lineTo(r * 0.2, 0);
    ctx.moveTo(0, -r * 0.2); ctx.lineTo(0, r * 0.2);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }
```

(This keeps the contact shadow and the spin energy ring for both looks; the image branch draws the rotated blade and returns, balancing the two outer `ctx.save()`s with two `ctx.restore()`s. The fallback is the original procedural drawing unchanged.)

- [ ] **Step 4: Verify parse + tests**

Run: `node --check js/arena.js` → exit 0.
Run: `node --test` → 85 pass, 0 fail (arena.js isn't imported by tests).

- [ ] **Step 5: Playtest**

Open `index.html`, build a bey, TO BATTLE: in the bowl your bey is now the **blade image, rotating** as it spins (with the glow ring behind it), and the rival shows its own blade image. Confirm the image scales/wobbles with spin like before, and that if an image is slow to load the procedural top shows for a frame then swaps in.

- [ ] **Step 6: Commit**

```bash
git add js/arena.js
git commit -m "feat: draw the rotating blade image as the battle bey (procedural fallback)"
```

---

## Task 4: Final verification

- [ ] **Step 1: Full test run**

Run: `node --test`
Expected: `# pass 85`, `# fail 0`.

- [ ] **Step 2: Parse all modules**

Run: `node --check js/build.js && node --check js/builder.js && node --check js/parts.js && node --check js/physics.js && node --check js/arena.js && node --check js/sound.js && node --check js/main.js`
Expected: no output (exit 0).

- [ ] **Step 3: No leftover in-arena picker references**

Run: `grep -rn "build-picker\|#build-stats\|applyPlayerBuild\|renderPlayerBuild" js/ index.html`
Expected: no matches.

- [ ] **Step 4: Playtest the whole loop**

Open `index.html`: red button → builder (pick parts, watch bars + preview) → TO BATTLE → fight with the rotating blade image → Exit → back to builder → ✕ → shop. Confirm sound still triggers (from the earlier fix), spin direction still works, and the rival re-rolls each match.

- [ ] **Step 5: Tuning pass (optional, after playtest)**

If the blade image looks too big/small in the bowl, adjust `s = r * 2.4` in `drawBey`. If a bar always reads full/empty, tune `BAR_MAX` in `build.js`. Re-run `node --test` after changes; commit separately.

---

## Notes for the implementer

- **TDZ is fine:** `main.js` references `builder` inside the arena's `onExit` arrow before `const builder` is assigned, but the arrow only runs on a later Exit click, by which point `builder` exists.
- **Image readiness:** `drawBey` checks `img.complete && img.naturalWidth > 0`; until then (or if the asset 404s) it draws the procedural top, so the bowl is never blank.
- **`#sel-blade` etc. move, not duplicate:** Task 2 deletes the arena's copy and adds them under `#builder`, so the ids stay unique.
- **Arena still owns physics builds:** `arena.js` keeps importing `combineStats`/`statsToPhysics`/`BLADES`/`RATCHETS`/`BITS` for `buildProfile` and `randomBuild`; only the picker UI moved out.
- **`buildBars` is tested with synthetic stats**, independent of the vendored parts data.
