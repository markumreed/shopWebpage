# Spin Sushi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Beyblade X–styled sushi restaurant website that secretly transforms into a playable Beyblade arena when a hidden red button is pressed.

**Architecture:** A single static `index.html` with scroll sections for the restaurant (hero, menu, about) plus a cart drawer and a hidden full-screen arena overlay. Pure logic (cart math, game physics) lives in framework-free ES modules that load unchanged in the browser and under Node's test runner. DOM wiring is isolated in `main.js`; the canvas game loop is isolated in `arena.js`.

**Tech Stack:** Plain HTML, CSS, and JavaScript (ES modules). No framework, no bundler, no build step. Tests run with Node's built-in test runner (`node --test`, Node 18+). Google Fonts for display type.

---

## File Structure

```
index.html            # single page: hero, menu, about, cart drawer, arena overlay
package.json          # { "type": "module" } + test script (enables node --test on ES modules)
css/
  theme.css           # shop styling (style A: ink black / racing red / electric blue)
  arena.css           # arena styling (style C: neon cyan / magenta) + transformation
js/
  data.js             # MENU: array of sushi items (pure data)
  cart.js             # pure cart logic + localStorage persistence
  physics.js          # pure game physics helpers (distance, step, collision, outcome)
  arena.js            # canvas game: launch UI, AI opponent, render loop, FX, win/exit
  main.js             # page wiring: render menu, cart drawer, red button, transitions
tests/
  cart.test.js        # unit tests for cart.js pure functions
  physics.test.js     # unit tests for physics.js pure functions
assets/               # images / icons (optional; CSS-drawn placeholders used by default)
```

**Responsibilities & interfaces:**
- `data.js` exports `MENU` — array of `{ id, name, kana, price, desc }`.
- `cart.js` exports pure functions over a cart array of `{ id, name, price, qty }`:
  `addItem`, `removeItem`, `setQty`, `cartCount`, `cartSubtotal`, plus `saveCart`/`loadCart` (localStorage-guarded).
- `physics.js` exports `distance`, `stepBey`, `resolveCollision`, `decideOutcome` over a bey
  `{ x, y, vx, vy, spin, radius, mass, alive, name }` and a stadium `{ cx, cy, r }`.
- `arena.js` exports `mountArena({ overlayEl, canvasEl, ...controls, onExit })` returning `{ open, close }`.
- `main.js` imports the above and wires the DOM. It is the only module that queries the document on load.

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `css/theme.css` (empty placeholder, filled in Task 9)
- Create: `css/arena.css` (empty placeholder, filled in Task 11)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "spin-sushi",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Create a minimal `index.html` shell**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Spin Sushi</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Manrope:wght@400;600;800&family=Zen+Kaku+Gothic+New:wght@700;900&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="css/theme.css" />
  <link rel="stylesheet" href="css/arena.css" />
</head>
<body>
  <main id="shop">
    <h1>Spin Sushi</h1>
  </main>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create empty CSS files**

Create `css/theme.css` and `css/arena.css` each containing a single comment line:

```css
/* theme.css — shop styling (filled in Task 9) */
```

```css
/* arena.css — arena styling (filled in Task 11) */
```

- [ ] **Step 4: Create a placeholder `js/main.js` so the page loads without 404**

```js
// main.js — page wiring (filled in Task 10 / Task 11)
console.log("Spin Sushi loaded");
```

- [ ] **Step 5: Verify the test runner works (zero tests yet)**

Run: `npm test`
Expected: command exits 0 with "tests 0" (no test files yet is OK).

- [ ] **Step 6: Commit**

```bash
git add package.json index.html css/theme.css css/arena.css js/main.js
git commit -m "chore: scaffold Spin Sushi static site"
```

---

## Task 2: Menu data

**Files:**
- Create: `js/data.js`

- [ ] **Step 1: Create the menu data module**

```js
// data.js — sushi menu (pure data, no DOM)
export const MENU = [
  { id: "tuna-nigiri",   name: "Tuna Nigiri",   kana: "マグロ",   price: 6, desc: "Bluefin over hand-pressed rice." },
  { id: "salmon-nigiri", name: "Salmon Nigiri", kana: "サーモン", price: 5, desc: "Buttery salmon, brushed with nikiri." },
  { id: "dragon-roll",   name: "Dragon Roll",   kana: "ドラゴン", price: 14, desc: "Eel & avocado, scaled like a dragon." },
  { id: "spicy-tuna",    name: "Spicy Tuna Roll", kana: "ピリ辛", price: 9, desc: "Chopped tuna, chili oil, crunch." },
  { id: "uni-gunkan",    name: "Uni Gunkan",    kana: "ウニ",     price: 12, desc: "Sea urchin battleship — fitting." },
  { id: "tamago",        name: "Tamago",        kana: "玉子",     price: 4, desc: "Sweet layered omelette." },
  { id: "edamame",       name: "Edamame",       kana: "枝豆",     price: 5, desc: "Sea-salted soybeans." },
  { id: "miso-soup",     name: "Miso Soup",     kana: "味噌汁",   price: 3, desc: "Dashi, tofu, scallion." }
];
```

- [ ] **Step 2: Commit**

```bash
git add js/data.js
git commit -m "feat: add sushi menu data"
```

---

## Task 3: Cart logic (pure functions)

**Files:**
- Create: `js/cart.js`
- Test: `tests/cart.test.js`

- [ ] **Step 1: Write failing tests for cart math**

```js
// tests/cart.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { addItem, removeItem, setQty, cartCount, cartSubtotal } from "../js/cart.js";

const tuna = { id: "tuna-nigiri", name: "Tuna Nigiri", price: 6 };
const tamago = { id: "tamago", name: "Tamago", price: 4 };

test("addItem adds a new line with qty 1", () => {
  const cart = addItem([], tuna);
  assert.deepEqual(cart, [{ id: "tuna-nigiri", name: "Tuna Nigiri", price: 6, qty: 1 }]);
});

test("addItem increments qty for an existing line", () => {
  const cart = addItem(addItem([], tuna), tuna);
  assert.equal(cart.length, 1);
  assert.equal(cart[0].qty, 2);
});

test("addItem does not mutate the input cart", () => {
  const original = [];
  addItem(original, tuna);
  assert.deepEqual(original, []);
});

test("setQty changes a line's quantity", () => {
  const cart = setQty(addItem([], tuna), "tuna-nigiri", 5);
  assert.equal(cart[0].qty, 5);
});

test("setQty of 0 or less removes the line", () => {
  const cart = setQty(addItem([], tuna), "tuna-nigiri", 0);
  assert.deepEqual(cart, []);
});

test("removeItem removes the matching line", () => {
  let cart = addItem(addItem([], tuna), tamago);
  cart = removeItem(cart, "tuna-nigiri");
  assert.deepEqual(cart.map((l) => l.id), ["tamago"]);
});

test("cartCount sums quantities", () => {
  const cart = addItem(addItem(addItem([], tuna), tuna), tamago);
  assert.equal(cartCount(cart), 3);
});

test("cartSubtotal sums price * qty", () => {
  const cart = addItem(addItem(addItem([], tuna), tuna), tamago); // 6*2 + 4
  assert.equal(cartSubtotal(cart), 16);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/cart.test.js`
Expected: FAIL — cannot resolve module `../js/cart.js` (file does not exist yet).

- [ ] **Step 3: Implement `js/cart.js` pure functions**

```js
// cart.js — pure cart logic + localStorage persistence

export function addItem(cart, item) {
  const existing = cart.find((line) => line.id === item.id);
  if (existing) {
    return cart.map((line) =>
      line.id === item.id ? { ...line, qty: line.qty + 1 } : line
    );
  }
  return [...cart, { id: item.id, name: item.name, price: item.price, qty: 1 }];
}

export function removeItem(cart, id) {
  return cart.filter((line) => line.id !== id);
}

export function setQty(cart, id, qty) {
  if (qty <= 0) return removeItem(cart, id);
  return cart.map((line) => (line.id === id ? { ...line, qty } : line));
}

export function cartCount(cart) {
  return cart.reduce((sum, line) => sum + line.qty, 0);
}

export function cartSubtotal(cart) {
  return cart.reduce((sum, line) => sum + line.price * line.qty, 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/cart.test.js`
Expected: PASS — 8 tests passing.

- [ ] **Step 5: Commit**

```bash
git add js/cart.js tests/cart.test.js
git commit -m "feat: cart math with tests"
```

---

## Task 4: Cart persistence

**Files:**
- Modify: `js/cart.js` (append persistence functions)
- Modify: `tests/cart.test.js` (append persistence tests)

- [ ] **Step 1: Append failing persistence tests**

Add to the bottom of `tests/cart.test.js`:

```js
import { saveCart, loadCart } from "../js/cart.js";

function withFakeLocalStorage(run) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  try {
    run();
  } finally {
    delete globalThis.localStorage;
  }
}

test("saveCart then loadCart round-trips the cart", () => {
  withFakeLocalStorage(() => {
    const cart = addItem([], tuna);
    saveCart(cart);
    assert.deepEqual(loadCart(), cart);
  });
});

test("loadCart returns [] when nothing is stored", () => {
  withFakeLocalStorage(() => {
    assert.deepEqual(loadCart(), []);
  });
});

test("loadCart returns [] when no localStorage exists", () => {
  assert.deepEqual(loadCart(), []);
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node --test tests/cart.test.js`
Expected: FAIL — `saveCart`/`loadCart` are not exported.

- [ ] **Step 3: Append persistence functions to `js/cart.js`**

```js
const STORAGE_KEY = "spin-sushi-cart";

export function saveCart(cart) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

export function loadCart() {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/cart.test.js`
Expected: PASS — 11 tests passing.

- [ ] **Step 5: Commit**

```bash
git add js/cart.js tests/cart.test.js
git commit -m "feat: persist cart to localStorage"
```

---

## Task 5: Physics — distance & stepBey

**Files:**
- Create: `js/physics.js`
- Test: `tests/physics.test.js`

The stadium is a bowl: a centering force pulls beys toward the middle, friction damps
velocity, and spin decays each step. A bey dies (`alive=false`) when spin hits 0
(spin-out) or its center leaves the bowl radius (ring-out).

- [ ] **Step 1: Write failing tests for `distance` and `stepBey`**

```js
// tests/physics.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { distance, stepBey } from "../js/physics.js";

const STADIUM = { cx: 0, cy: 0, r: 100 };
const PARAMS = { dt: 1, friction: 0.1, spinDecay: 1, centering: 0.05 };

function bey(overrides = {}) {
  return {
    x: 0, y: 0, vx: 0, vy: 0,
    spin: 100, radius: 10, mass: 1, alive: true, name: "test",
    ...overrides
  };
}

test("distance computes Euclidean distance", () => {
  assert.equal(distance(0, 0, 3, 4), 5);
});

test("stepBey decreases spin by spinDecay*dt", () => {
  const next = stepBey(bey({ spin: 100 }), STADIUM, PARAMS);
  assert.equal(next.spin, 99);
});

test("stepBey marks a bey dead when spin reaches 0 (spin-out)", () => {
  const next = stepBey(bey({ spin: 1 }), STADIUM, PARAMS);
  assert.equal(next.spin, 0);
  assert.equal(next.alive, false);
});

test("stepBey marks a bey dead when it leaves the bowl (ring-out)", () => {
  // far outside, moving further out so centering can't save it this step
  const next = stepBey(bey({ x: 200, y: 0, vx: 50 }), STADIUM, PARAMS);
  assert.equal(next.alive, false);
});

test("stepBey does not mutate the input bey", () => {
  const b = bey();
  stepBey(b, STADIUM, PARAMS);
  assert.equal(b.spin, 100);
  assert.equal(b.alive, true);
});

test("stepBey leaves a dead bey unchanged", () => {
  const dead = bey({ alive: false, spin: 0 });
  const next = stepBey(dead, STADIUM, PARAMS);
  assert.deepEqual(next, dead);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/physics.test.js`
Expected: FAIL — cannot resolve `../js/physics.js`.

- [ ] **Step 3: Implement `distance` and `stepBey` in `js/physics.js`**

```js
// physics.js — pure game physics (no DOM, no canvas)

export function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function stepBey(bey, stadium, params) {
  if (!bey.alive) return bey;
  const { dt, friction, spinDecay, centering } = params;

  // bowl centering force toward stadium center
  const ax = (stadium.cx - bey.x) * centering;
  const ay = (stadium.cy - bey.y) * centering;

  let vx = (bey.vx + ax * dt) * (1 - friction * dt);
  let vy = (bey.vy + ay * dt) * (1 - friction * dt);

  const x = bey.x + vx * dt;
  const y = bey.y + vy * dt;

  let spin = bey.spin - spinDecay * dt;
  let alive = true;
  if (spin <= 0) {
    spin = 0;
    alive = false;
  }
  if (distance(x, y, stadium.cx, stadium.cy) > stadium.r) {
    alive = false;
  }

  return { ...bey, x, y, vx, vy, spin, alive };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/physics.test.js`
Expected: PASS — 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add js/physics.js tests/physics.test.js
git commit -m "feat: bey stepping physics with tests"
```

---

## Task 6: Physics — collision resolution

**Files:**
- Modify: `js/physics.js` (add `resolveCollision`)
- Modify: `tests/physics.test.js` (add collision tests)

- [ ] **Step 1: Append failing collision tests**

Add to `tests/physics.test.js`:

```js
import { resolveCollision } from "../js/physics.js";

const COLL = { restitution: 1, collisionSpinDrain: 5 };

test("resolveCollision leaves non-overlapping beys unchanged", () => {
  const a = bey({ x: -50, y: 0 });
  const b = bey({ x: 50, y: 0 });
  const [a2, b2] = resolveCollision(a, b, COLL);
  assert.deepEqual([a2, b2], [a, b]);
});

test("resolveCollision separates overlapping beys", () => {
  const a = bey({ x: -5, y: 0 }); // radius 10 each => overlapping (dist 10 < 20)
  const b = bey({ x: 5, y: 0 });
  const [a2, b2] = resolveCollision(a, b, COLL);
  assert.ok(distance(a2.x, a2.y, b2.x, b2.y) >= a.radius + b.radius - 1e-6);
});

test("resolveCollision reverses approach velocity along the normal", () => {
  const a = bey({ x: -5, y: 0, vx: 10 });  // moving right, toward b
  const b = bey({ x: 5, y: 0, vx: -10 });  // moving left, toward a
  const [a2, b2] = resolveCollision(a, b, COLL);
  assert.ok(a2.vx < 0, "a should be pushed left after impact");
  assert.ok(b2.vx > 0, "b should be pushed right after impact");
});

test("resolveCollision drains spin from both on contact", () => {
  const a = bey({ x: -5, y: 0, spin: 50 });
  const b = bey({ x: 5, y: 0, spin: 50 });
  const [a2, b2] = resolveCollision(a, b, COLL);
  assert.equal(a2.spin, 45);
  assert.equal(b2.spin, 45);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/physics.test.js`
Expected: FAIL — `resolveCollision` not exported.

- [ ] **Step 3: Implement `resolveCollision` in `js/physics.js`**

```js
export function resolveCollision(a, b, params) {
  const { restitution, collisionSpinDrain } = params;
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

  // both lose spin on contact
  a2.spin = Math.max(0, a.spin - collisionSpinDrain);
  b2.spin = Math.max(0, b.spin - collisionSpinDrain);

  return [a2, b2];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/physics.test.js`
Expected: PASS — 10 tests passing.

- [ ] **Step 5: Commit**

```bash
git add js/physics.js tests/physics.test.js
git commit -m "feat: bey collision resolution with tests"
```

---

## Task 7: Physics — outcome decision

**Files:**
- Modify: `js/physics.js` (add `decideOutcome`)
- Modify: `tests/physics.test.js` (add outcome tests)

- [ ] **Step 1: Append failing outcome tests**

Add to `tests/physics.test.js`:

```js
import { decideOutcome } from "../js/physics.js";

test("decideOutcome returns null while both are alive", () => {
  assert.equal(decideOutcome(bey({ alive: true }), bey({ alive: true })), null);
});

test("decideOutcome returns 'player' when only opponent is dead", () => {
  assert.equal(decideOutcome(bey({ alive: true }), bey({ alive: false })), "player");
});

test("decideOutcome returns 'opponent' when only player is dead", () => {
  assert.equal(decideOutcome(bey({ alive: false }), bey({ alive: true })), "opponent");
});

test("decideOutcome returns 'draw' when both are dead", () => {
  assert.equal(decideOutcome(bey({ alive: false }), bey({ alive: false })), "draw");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/physics.test.js`
Expected: FAIL — `decideOutcome` not exported.

- [ ] **Step 3: Implement `decideOutcome` in `js/physics.js`**

```js
export function decideOutcome(player, opponent) {
  if (player.alive && opponent.alive) return null;
  if (player.alive && !opponent.alive) return "player";
  if (!player.alive && opponent.alive) return "opponent";
  return "draw";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/physics.test.js`
Expected: PASS — 14 tests passing.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — all cart + physics tests (25 total) passing.

- [ ] **Step 6: Commit**

```bash
git add js/physics.js tests/physics.test.js
git commit -m "feat: battle outcome decision with tests"
```

---

## Task 8: Page structure (HTML)

**Files:**
- Modify: `index.html` (replace the `<main>` shell with the full structure)

- [ ] **Step 1: Replace the `<body>` contents of `index.html`**

```html
<body>
  <!-- Hidden arena trigger: disguised "do not press" button -->
  <button id="red-button" class="red-button" aria-label="Do not press">
    <span class="rb-cap"></span>
    <span class="rb-label">DO&nbsp;NOT&nbsp;PRESS</span>
  </button>

  <header class="topbar">
    <div class="brand">SPIN<span>SUSHI</span></div>
    <nav class="nav">
      <a href="#menu">Menu</a>
      <a href="#about">Story</a>
      <button id="cart-toggle" class="cart-toggle" aria-label="Open cart">
        Cart <span id="cart-count" class="cart-badge">0</span>
      </button>
    </nav>
  </header>

  <main id="shop">
    <!-- HERO -->
    <section class="hero">
      <div class="hero-speedlines" aria-hidden="true"></div>
      <div class="hero-inner">
        <p class="hero-kana">回転寿司</p>
        <h1 class="hero-title">SPIN<br />SUSHI</h1>
        <p class="hero-tag">Hand-pressed nigiri at terminal velocity.</p>
        <a class="btn-primary" href="#menu">View the Menu</a>
      </div>
    </section>

    <!-- MENU -->
    <section id="menu" class="menu">
      <h2 class="section-title">The Menu <span class="kana">献立</span></h2>
      <div id="menu-grid" class="menu-grid"><!-- rendered by main.js --></div>
    </section>

    <!-- ABOUT / STORY -->
    <section id="about" class="about">
      <div class="about-panel">
        <h2 class="section-title">Our Story <span class="kana">物語</span></h2>
        <p>By day, Spin Sushi serves the sharpest nigiri in the city. The rice is
          pressed in a single motion. The cuts are clean. Regulars say the counter
          hums faintly, like something underneath is always spinning.</p>
        <p>They're not wrong. Beneath the floor sleeps a regulation Beyblade X
          stadium. The staff don't talk about the red button. <em>You shouldn't press it.</em></p>
      </div>
    </section>
  </main>

  <!-- CART DRAWER -->
  <aside id="cart-drawer" class="cart-drawer" aria-hidden="true">
    <div class="cart-head">
      <h2>Your Order</h2>
      <button id="cart-close" class="cart-close" aria-label="Close cart">✕</button>
    </div>
    <ul id="cart-lines" class="cart-lines"><!-- rendered by main.js --></ul>
    <div class="cart-foot">
      <div class="cart-total">Total <span id="cart-total">$0</span></div>
      <button id="checkout" class="btn-primary btn-block">Checkout</button>
      <p id="cart-confirm" class="cart-confirm" hidden>Order in! Itadakimasu 🥢</p>
    </div>
  </aside>
  <div id="cart-scrim" class="scrim" hidden></div>

  <!-- ARENA OVERLAY (hidden until red button) -->
  <div id="arena" class="arena" hidden>
    <div class="arena-hud">
      <div class="arena-title">BEYBLADE <span>ARENA</span></div>
      <button id="arena-exit" class="arena-exit">Exit to Shop</button>
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
      <button id="launch" class="btn-launch">HOLD&nbsp;TO&nbsp;CHARGE</button>
      <button id="rematch" class="btn-primary" hidden>Rematch</button>
    </div>
    <div id="arena-banner" class="arena-banner" hidden></div>
  </div>

  <script type="module" src="js/main.js"></script>
</body>
```

- [ ] **Step 2: Verify the page loads**

Run: `python3 -m http.server 8000` then open `http://localhost:8000`
Expected: Unstyled but complete page — hero text, menu heading (empty grid), story, and a "DO NOT PRESS" button are all present in the DOM. No console errors. Stop the server with Ctrl-C.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: full page structure (hero, menu, story, cart, arena)"
```

---

## Task 9: Shop styling (theme.css)

**Files:**
- Modify: `css/theme.css` (replace the placeholder comment)

- [ ] **Step 1: Write the shop theme**

```css
:root {
  --ink: #0b0c10;
  --red: #e3001b;
  --blue: #00b3ff;
  --paper: #f4f1ea;
  --display: "Anton", system-ui, sans-serif;
  --body: "Manrope", system-ui, sans-serif;
  --kana: "Zen Kaku Gothic New", sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { background: var(--ink); color: var(--paper); font-family: var(--body); }

/* Topbar */
.topbar {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 24px; background: rgba(11,12,16,.85);
  backdrop-filter: blur(8px); border-bottom: 2px solid var(--red);
}
.brand { font-family: var(--display); font-size: 26px; letter-spacing: 1px; font-style: italic; }
.brand span { color: var(--red); }
.nav { display: flex; align-items: center; gap: 20px; }
.nav a { color: var(--paper); text-decoration: none; font-weight: 800; text-transform: uppercase; font-size: 13px; letter-spacing: 1px; }
.nav a:hover { color: var(--blue); }
.cart-toggle { background: var(--red); color: #fff; border: 0; padding: 8px 14px; font-weight: 800; cursor: pointer; transform: skewX(-8deg); text-transform: uppercase; font-size: 13px; }
.cart-badge { display: inline-block; min-width: 18px; text-align: center; background: #fff; color: var(--red); border-radius: 9px; font-size: 12px; margin-left: 4px; }

/* Hero */
.hero { position: relative; min-height: 88vh; display: grid; place-items: center; overflow: hidden;
  background: radial-gradient(circle at 70% 20%, #15171f, var(--ink)); }
.hero-speedlines { position: absolute; inset: 0; opacity: .35;
  background: repeating-linear-gradient(115deg, transparent 0 14px, rgba(255,255,255,.06) 14px 16px); }
.hero-inner { position: relative; text-align: center; padding: 24px; }
.hero-kana { font-family: var(--kana); color: var(--blue); letter-spacing: 6px; margin-bottom: 8px; }
.hero-title { font-family: var(--display); font-style: italic; text-transform: uppercase;
  font-size: clamp(64px, 14vw, 180px); line-height: .85; color: #fff; text-shadow: 6px 6px 0 var(--red); }
.hero-tag { margin: 18px 0 26px; font-size: clamp(15px, 2.2vw, 20px); font-weight: 600; opacity: .9; }

.btn-primary { display: inline-block; background: var(--blue); color: var(--ink); font-weight: 800;
  text-transform: uppercase; letter-spacing: 1px; text-decoration: none; padding: 14px 26px;
  border: 0; cursor: pointer; transform: skewX(-8deg); font-size: 14px; }
.btn-primary:hover { background: #fff; }
.btn-block { width: 100%; transform: none; }

/* Sections */
.section-title { font-family: var(--display); font-style: italic; text-transform: uppercase;
  font-size: clamp(34px, 6vw, 64px); margin-bottom: 24px; }
.section-title .kana { font-family: var(--kana); font-size: .4em; color: var(--blue); margin-left: 12px; }
.menu, .about { max-width: 1100px; margin: 0 auto; padding: 72px 24px; }

/* Menu grid */
.menu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 18px; }
.menu-card { background: #14161d; border: 2px solid #23262f; border-left: 6px solid var(--red);
  padding: 18px; display: flex; flex-direction: column; gap: 8px; transition: transform .12s, border-color .12s; }
.menu-card:hover { transform: translateY(-4px); border-left-color: var(--blue); }
.menu-card .mc-kana { font-family: var(--kana); color: var(--blue); font-size: 14px; letter-spacing: 2px; }
.menu-card h3 { font-family: var(--display); font-style: italic; text-transform: uppercase; font-size: 22px; }
.menu-card .mc-desc { font-size: 13px; opacity: .75; flex: 1; }
.menu-card .mc-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; }
.menu-card .mc-price { font-family: var(--display); font-size: 22px; color: var(--blue); }
.menu-card .mc-add { background: var(--red); color: #fff; border: 0; padding: 8px 14px; font-weight: 800;
  cursor: pointer; transform: skewX(-8deg); text-transform: uppercase; font-size: 12px; }
.menu-card .mc-add:hover { background: #fff; color: var(--red); }

/* About */
.about-panel { background: #14161d; border: 2px solid #23262f; padding: 36px; line-height: 1.7; }
.about-panel p { margin-bottom: 14px; opacity: .9; }
.about-panel em { color: var(--red); font-style: italic; font-weight: 700; }

/* Cart drawer */
.cart-drawer { position: fixed; top: 0; right: 0; height: 100%; width: min(380px, 90vw); z-index: 40;
  background: #101218; border-left: 3px solid var(--red); transform: translateX(100%);
  transition: transform .25s ease; display: flex; flex-direction: column; }
.cart-drawer.open { transform: translateX(0); }
.cart-head { display: flex; align-items: center; justify-content: space-between; padding: 18px; border-bottom: 2px solid #23262f; }
.cart-head h2 { font-family: var(--display); font-style: italic; text-transform: uppercase; }
.cart-close { background: none; border: 0; color: var(--paper); font-size: 20px; cursor: pointer; }
.cart-lines { list-style: none; flex: 1; overflow-y: auto; padding: 12px 18px; }
.cart-line { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #23262f; }
.cart-line .cl-name { flex: 1; font-weight: 600; font-size: 14px; }
.cart-line .cl-qty { display: flex; align-items: center; gap: 6px; }
.cart-line .cl-qty button { width: 24px; height: 24px; border: 0; background: #23262f; color: #fff; cursor: pointer; font-weight: 800; }
.cart-line .cl-price { width: 52px; text-align: right; color: var(--blue); font-weight: 800; }
.cart-empty { opacity: .6; text-align: center; padding: 40px 0; }
.cart-foot { padding: 18px; border-top: 2px solid #23262f; }
.cart-total { display: flex; justify-content: space-between; font-family: var(--display); font-size: 24px; margin-bottom: 14px; }
.cart-total span { color: var(--blue); }
.cart-confirm { margin-top: 12px; text-align: center; color: var(--blue); font-weight: 800; }

.scrim { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 30; }

/* Red button — disguised, discoverable on hover */
.red-button { position: fixed; right: 18px; bottom: 18px; z-index: 25;
  background: none; border: 0; cursor: pointer; display: grid; place-items: center; gap: 4px;
  opacity: .55; transition: opacity .2s, transform .2s; }
.red-button:hover { opacity: 1; transform: scale(1.06); }
.rb-cap { width: 46px; height: 46px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ff5a4d, var(--red) 60%, #7d0010);
  box-shadow: 0 0 0 4px #2a0207, 0 6px 14px rgba(0,0,0,.5); }
.red-button:hover .rb-cap { box-shadow: 0 0 0 4px #2a0207, 0 0 22px rgba(227,0,27,.8); animation: rb-pulse 1s infinite; }
.rb-label { font-size: 9px; font-weight: 800; letter-spacing: 1px; color: var(--red); }
@keyframes rb-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }

@media (max-width: 640px) {
  .nav a { display: none; }
}
```

- [ ] **Step 2: Verify visually**

Run: `python3 -m http.server 8000` then open `http://localhost:8000`
Expected: Styled shop — black background, italic chrome hero with red drop-shadow, sticky topbar, empty menu grid, story panel, and a pulsing red "DO NOT PRESS" button bottom-right. Stop the server with Ctrl-C.

- [ ] **Step 3: Commit**

```bash
git add css/theme.css
git commit -m "feat: shop styling (Beyblade X theme)"
```

---

## Task 10: Page wiring — menu render + cart drawer (main.js)

**Files:**
- Modify: `js/main.js` (replace placeholder)

This task wires the tested `cart.js` and `data.js` into the DOM. The arena import is
included now but `mountArena` is created in Task 12; until then the red button logs.

- [ ] **Step 1: Implement menu rendering and cart wiring**

```js
// main.js — page wiring
import { MENU } from "./data.js";
import {
  addItem, removeItem, setQty, cartCount, cartSubtotal, saveCart, loadCart
} from "./cart.js";

let cart = loadCart();

const $ = (sel) => document.querySelector(sel);

// ---- Menu rendering ----
function renderMenu() {
  const grid = $("#menu-grid");
  grid.innerHTML = MENU.map((item) => `
    <article class="menu-card">
      <span class="mc-kana">${item.kana}</span>
      <h3>${item.name}</h3>
      <p class="mc-desc">${item.desc}</p>
      <div class="mc-foot">
        <span class="mc-price">$${item.price}</span>
        <button class="mc-add" data-id="${item.id}">Add</button>
      </div>
    </article>
  `).join("");

  grid.querySelectorAll(".mc-add").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = MENU.find((m) => m.id === btn.dataset.id);
      cart = addItem(cart, item);
      persistAndRender();
      openCart();
    });
  });
}

// ---- Cart rendering ----
function renderCart() {
  $("#cart-count").textContent = cartCount(cart);
  $("#cart-total").textContent = "$" + cartSubtotal(cart);

  const lines = $("#cart-lines");
  if (cart.length === 0) {
    lines.innerHTML = `<li class="cart-empty">Your tray is empty.</li>`;
    return;
  }
  lines.innerHTML = cart.map((line) => `
    <li class="cart-line">
      <span class="cl-name">${line.name}</span>
      <span class="cl-qty">
        <button data-act="dec" data-id="${line.id}">−</button>
        <span>${line.qty}</span>
        <button data-act="inc" data-id="${line.id}">+</button>
      </span>
      <span class="cl-price">$${line.price * line.qty}</span>
    </li>
  `).join("");

  lines.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const cur = cart.find((l) => l.id === id);
      if (btn.dataset.act === "inc") cart = setQty(cart, id, cur.qty + 1);
      else cart = setQty(cart, id, cur.qty - 1);
      persistAndRender();
    });
  });
}

function persistAndRender() {
  saveCart(cart);
  renderCart();
}

// ---- Cart drawer open/close ----
function openCart() {
  $("#cart-drawer").classList.add("open");
  $("#cart-drawer").setAttribute("aria-hidden", "false");
  $("#cart-scrim").hidden = false;
}
function closeCart() {
  $("#cart-drawer").classList.remove("open");
  $("#cart-drawer").setAttribute("aria-hidden", "true");
  $("#cart-scrim").hidden = true;
}

// ---- Checkout (fake) ----
function checkout() {
  if (cart.length === 0) return;
  cart = [];
  persistAndRender();
  const confirm = $("#cart-confirm");
  confirm.hidden = false;
  setTimeout(() => { confirm.hidden = true; }, 3000);
}

// ---- Wire it up ----
function init() {
  renderMenu();
  renderCart();
  $("#cart-toggle").addEventListener("click", openCart);
  $("#cart-close").addEventListener("click", closeCart);
  $("#cart-scrim").addEventListener("click", closeCart);
  $("#checkout").addEventListener("click", checkout);

  // Red button — arena wired in Task 12
  $("#red-button").addEventListener("click", () => {
    console.log("RED BUTTON (arena mounts in Task 12)");
  });
}

init();
```

- [ ] **Step 2: Verify the shop is interactive**

Run: `python3 -m http.server 8000` then open `http://localhost:8000`
Expected:
- Menu grid is populated with 8 sushi cards.
- Clicking "Add" opens the cart drawer and shows the item; the cart badge increments.
- +/- adjust quantity; reaching 0 removes the line; total updates.
- "Checkout" empties the cart and shows the confirmation message.
- Reloading the page restores the cart (localStorage). Stop the server with Ctrl-C.

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "feat: wire menu rendering and cart drawer"
```

---

## Task 11: Arena styling + transformation (arena.css)

**Files:**
- Modify: `css/arena.css` (replace the placeholder comment)

- [ ] **Step 1: Write the arena/neon styles and transformation**

```css
/* Arena (style C: neon) + transformation from shop */

/* Transformation: when battling, shake + dim the shop behind the overlay */
body.battling { overflow: hidden; }
body.battling #shop,
body.battling .topbar { filter: brightness(.25) saturate(.4); transition: filter .5s; }

@keyframes screen-shake {
  0%,100% { transform: translate(0,0); }
  20% { transform: translate(-8px, 6px); }
  40% { transform: translate(7px, -7px); }
  60% { transform: translate(-6px, -5px); }
  80% { transform: translate(6px, 7px); }
}
.shake { animation: screen-shake .45s linear; }

/* Overlay */
.arena {
  position: fixed; inset: 0; z-index: 60;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
  background: radial-gradient(circle at 50% 30%, #1a1140, #07060f 70%);
  color: #eaf7ff;
}
.arena[hidden] { display: none; }

.arena-hud { position: absolute; top: 0; left: 0; right: 0;
  display: flex; align-items: center; justify-content: space-between; padding: 16px 22px; }
.arena-title { font-family: var(--display, sans-serif); font-style: italic; text-transform: uppercase;
  font-size: 28px; letter-spacing: 2px; text-shadow: 0 0 16px #ff2bd6, 0 0 30px #2bf2ff; }
.arena-title span { color: #2bf2ff; }
.arena-exit { background: transparent; border: 1.5px solid #2bf2ff; color: #2bf2ff; padding: 8px 14px;
  font-weight: 800; text-transform: uppercase; cursor: pointer; box-shadow: 0 0 14px rgba(43,242,255,.5); }
.arena-exit:hover { background: #2bf2ff; color: #07060f; }

.arena-canvas { width: min(72vmin, 720px); height: min(72vmin, 720px);
  border-radius: 50%; box-shadow: 0 0 60px rgba(43,242,255,.35), inset 0 0 80px rgba(255,43,214,.25);
  background: #0a0a16; }

.arena-controls { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; justify-content: center; }
.ctrl { display: flex; flex-direction: column; align-items: center; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; gap: 6px; }
.ctrl input[type=range] { width: 160px; accent-color: #2bf2ff; }

.power-wrap { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.power-label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
.power-track { width: 160px; height: 14px; background: #15122b; border: 1px solid #2bf2ff; overflow: hidden; }
.power-fill { width: 0%; height: 100%; background: linear-gradient(90deg, #2bf2ff, #ff2bd6); }

.btn-launch { background: #ff2bd6; color: #07060f; border: 0; padding: 14px 22px; font-weight: 800;
  text-transform: uppercase; letter-spacing: 1px; cursor: pointer; box-shadow: 0 0 22px rgba(255,43,214,.6); }
.btn-launch:active { transform: scale(.97); }
.btn-launch:disabled { opacity: .5; cursor: default; box-shadow: none; }

.arena-banner { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none;
  font-family: var(--display, sans-serif); font-style: italic; text-transform: uppercase;
  font-size: clamp(48px, 12vw, 140px); color: #fff;
  text-shadow: 0 0 24px #ff2bd6, 0 0 48px #2bf2ff; animation: banner-pop .4s ease-out; }
.arena-banner[hidden] { display: none; }
@keyframes banner-pop { from { transform: scale(.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
```

- [ ] **Step 2: Verify the overlay shows when un-hidden**

Run: `python3 -m http.server 8000`, open the page, and in the browser console run
`document.getElementById('arena').hidden = false`.
Expected: A full-screen dark neon overlay appears with a glowing circular stadium, angle slider, power bar, and a magenta "HOLD TO CHARGE" launch button. Re-hide with `document.getElementById('arena').hidden = true`. Stop the server with Ctrl-C.

- [ ] **Step 3: Commit**

```bash
git add css/arena.css
git commit -m "feat: neon arena styling and transformation effects"
```

---

## Task 12: Arena game (arena.js) + red button hookup

**Files:**
- Create: `js/arena.js`
- Modify: `js/main.js` (import and mount the arena, wire the red button)

The game uses the tested `physics.js` helpers. `arena.js` owns the canvas, the
charge-launch input, a randomized AI launch, the render loop, FX, and win handling.

- [ ] **Step 1: Implement `js/arena.js`**

```js
// arena.js — canvas battle. Pure physics comes from physics.js.
import { stepBey, resolveCollision, decideOutcome } from "./physics.js";

const STADIUM_PARAMS = { dt: 1, friction: 0.012, spinDecay: 0.08, centering: 0.0016 };
const COLLISION = { restitution: 1.05, collisionSpinDrain: 1.5 };
const START_SPIN = 100;

function makeBey(name, x, y, color) {
  return { name, x, y, vx: 0, vy: 0, spin: START_SPIN, radius: 22, mass: 1, alive: true, color };
}

export function mountArena(opts) {
  const { overlayEl, canvasEl, angleEl, powerFillEl, launchEl, rematchEl, bannerEl, onExit } = opts;
  const ctx = canvasEl.getContext("2d");
  const W = canvasEl.width, H = canvasEl.height;
  const stadium = { cx: W / 2, cy: H / 2, r: W / 2 - 16 };

  let player, opponent, phase, raf, charging, power;

  function reset() {
    player = makeBey("You", stadium.cx - 120, stadium.cy, "#2bf2ff");
    opponent = makeBey("Rival", stadium.cx + 120, stadium.cy, "#ff2bd6");
    phase = "ready"; // ready -> spinning -> done
    charging = false;
    power = 0;
    powerFillEl.style.width = "0%";
    launchEl.disabled = false;
    launchEl.textContent = "HOLD TO CHARGE";
    rematchEl.hidden = true;
    bannerEl.hidden = true;
    draw();
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
    loop();
  }

  // ---- main loop ----
  function loop() {
    player = stepBey(player, stadium, STADIUM_PARAMS);
    opponent = stepBey(opponent, stadium, STADIUM_PARAMS);
    [player, opponent] = resolveCollision(player, opponent, COLLISION);
    draw();

    const outcome = decideOutcome(player, opponent);
    if (outcome) return finish(outcome);
    raf = requestAnimationFrame(loop);
  }

  function finish(outcome) {
    phase = "done";
    cancelAnimationFrame(raf);
    const text = outcome === "player" ? "YOU WIN!" : outcome === "opponent" ? "DEFEAT" : "DRAW";
    bannerEl.textContent = text;
    bannerEl.hidden = false;
    rematchEl.hidden = false;
    triggerShake();
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

  function triggerShake() {
    overlayEl.classList.add("shake");
    setTimeout(() => overlayEl.classList.remove("shake"), 460);
  }

  // ---- open/close ----
  function open() {
    overlayEl.hidden = false;
    document.body.classList.add("battling");
    triggerShake();
    reset();
  }
  function close() {
    cancelAnimationFrame(raf);
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
  rematchEl.addEventListener("click", reset);

  return { open, close };
}
```

- [ ] **Step 2: Wire the arena into `js/main.js`**

Add this import at the top of `js/main.js`, below the existing imports:

```js
import { mountArena } from "./arena.js";
```

Then, in `init()`, replace the existing red-button handler:

```js
  // Red button — arena wired in Task 12
  $("#red-button").addEventListener("click", () => {
    console.log("RED BUTTON (arena mounts in Task 12)");
  });
```

with:

```js
  const arena = mountArena({
    overlayEl: $("#arena"),
    canvasEl: $("#arena-canvas"),
    angleEl: $("#angle"),
    powerFillEl: $("#power-fill"),
    launchEl: $("#launch"),
    rematchEl: $("#rematch"),
    bannerEl: $("#arena-banner"),
    onExit: () => {}
  });
  $("#red-button").addEventListener("click", arena.open);
  $("#arena-exit").addEventListener("click", arena.close);
```

- [ ] **Step 3: Verify the full experience end-to-end**

Run: `python3 -m http.server 8000` then open `http://localhost:8000`
Expected:
- Pressing the red "DO NOT PRESS" button shakes the screen, dims the shop, and opens the neon arena.
- Holding "HOLD TO CHARGE" fills the power bar; releasing launches your (cyan) bey at the chosen angle.
- The (magenta) AI bey launches too; both orbit, collide, and lose spin.
- When one stops or leaves the ring, a banner shows "YOU WIN!", "DEFEAT", or "DRAW" and a Rematch button appears.
- Rematch resets the battle; "Exit to Shop" returns to the restaurant with the cart intact.
Stop the server with Ctrl-C.

- [ ] **Step 4: Run the full test suite once more**

Run: `npm test`
Expected: PASS — all 25 tests still passing.

- [ ] **Step 5: Commit**

```bash
git add js/arena.js js/main.js
git commit -m "feat: playable Beyblade arena with red-button reveal"
```

---

## Task 13: README + final pass

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace `README.md`**

```markdown
# Spin Sushi

A Beyblade X–styled sushi restaurant website that secretly transforms into a
playable Beyblade arena when you press the hidden red button.

Plain HTML/CSS/JS — no build step.

## Run

Open `index.html` directly, or serve it:

```bash
python3 -m http.server 8000
# visit http://localhost:8000
```

## Play

Browse the menu, add sushi to your cart, then find the **"DO NOT PRESS"** button
(bottom-right). Press it. Hold to charge, set your launch angle, and release —
last bey spinning wins.

## Test

```bash
npm test
```

Runs unit tests for the cart math (`js/cart.js`) and battle physics (`js/physics.js`).
```

- [ ] **Step 2: Final verification**

Run: `npm test`
Expected: PASS — all tests green.

Run: `python3 -m http.server 8000`, click through shop → cart → checkout → red button → battle → rematch → exit. No console errors. Stop the server with Ctrl-C.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: project README"
```

---

## Self-Review Notes

- **Spec coverage:** Hero ✓ (T8/T9), Menu showcase ✓ (T2/T9/T10), Cart + order flow ✓ (T3/T4/T10), About/story ✓ (T8/T9), hidden red button ✓ (T8/T9/T12), transformation sequence ✓ (T11/T12), charge-launch gameplay ✓ (T12), physics + spin/ring-out + outcome ✓ (T5/T6/T7), manga FX (shake/banner) ✓ (T11/T12), rematch/exit ✓ (T12), visual identity A+C ✓ (T9/T11), testing of pure functions ✓ (T3–T7).
- **Type consistency:** cart line `{id,name,price,qty}` used uniformly; bey `{x,y,vx,vy,spin,radius,mass,alive,name,color}` consistent across physics and arena; `mountArena` option names match the element ids in `index.html`.
- **No placeholders:** every code/CSS/HTML step contains complete content.
```
