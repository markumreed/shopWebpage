# Arena-Points Ordering Game — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the front page into a game where you order food with ★ points earned by winning in the beyblade arena; a new player starts at 0 points and must battle before they can order.

**Architecture:** A new pure `points.js` module (localStorage-backed economy) is unit-tested. The existing `cart.js` is reused unchanged as a points-priced "order tray." `main.js` owns the live points balance, renders the topbar POINTS HUD, gates every menu card's Add button on the remaining budget (so the tray is always payable), and exposes an `awardPoints` callback that `arena.js` calls when the player wins a round/match. Menu prices become whole points 1–3. A ⚔ Battle button (topbar + empty tray) opens the existing builder→arena flow.

**Tech Stack:** Vanilla ES modules, `node --test` for unit tests, plain DOM + Canvas, CSS with existing `:root` tokens (`--ink`, `--red`, `--paper`, `--game` = Press Start 2P).

**Spec:** `docs/superpowers/specs/2026-06-09-arena-points-order-game-design.md`

---

## File Structure

- **Create:** `js/points.js` — pure points economy (load/save/award/afford/spend).
- **Create:** `tests/points.test.js` — unit tests for the pure functions.
- **Modify:** `js/data.js` — menu prices → integers 1–3.
- **Modify:** `js/arena.js` — award points on round/match win via `opts.awardPoints`.
- **Modify:** `js/i18n.js` — add `hud.points`, `hud.battle`, `menu.need`; relabel `menu.buy`, `nav.bag`, `cart.title`, `cart.checkout`, `cart.confirm`.
- **Modify:** `index.html` — add POINTS HUD + ⚔ Battle button to the nav.
- **Modify:** `js/main.js` — points state, HUD, afford/lock menu, points-priced tray, Place Order, battle CTA, `awardPoints` wiring (full rewrite).
- **Modify:** `css/theme.css` — 8-bit POINTS HUD, ⚔ button, ★ cost, locked-card, tray-battle styles (append).
- **Unchanged / kept:** `js/cart.js`, `tests/cart.test.js` (reused as the tray).

---

### Task 1: Points economy module (`points.js`)

**Files:**
- Create: `js/points.js`
- Test: `tests/points.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/points.test.js`:

```js
// tests/points.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { pointsForRound, canAfford, spend, loadPoints } from "../js/points.js";

test("pointsForRound: winning the round only = 1", () => {
  assert.equal(pointsForRound(true, false), 1);
});

test("pointsForRound: winning the round AND the match = 4", () => {
  assert.equal(pointsForRound(true, true), 4);
});

test("pointsForRound: losing the round = 0", () => {
  assert.equal(pointsForRound(false, false), 0);
});

test("pointsForRound: match flag without round win = 3 (bonus only)", () => {
  assert.equal(pointsForRound(false, true), 3);
});

test("canAfford: exact balance is affordable", () => {
  assert.equal(canAfford(3, 3), true);
});

test("canAfford: short balance is not affordable", () => {
  assert.equal(canAfford(2, 3), false);
});

test("spend: deducts the cost when affordable", () => {
  assert.equal(spend(5, 3), 2);
});

test("spend: no-op when short (never goes negative)", () => {
  assert.equal(spend(2, 3), 2);
});

test("loadPoints: defaults to 0 when localStorage is unavailable", () => {
  assert.equal(loadPoints(), 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/points.test.js`
Expected: FAIL — `Cannot find module '../js/points.js'`.

- [ ] **Step 3: Write the minimal implementation**

Create `js/points.js`:

```js
// points.js — pure points economy + localStorage persistence (no DOM).
// Points are earned by winning in the arena and spent ordering food.
export const POINTS_KEY = "arena.points";

// loadPoints — current balance, 0 if unset/corrupt or storage is unavailable.
export function loadPoints() {
  try {
    const n = parseInt(localStorage.getItem(POINTS_KEY), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

// savePoints — persist a non-negative integer balance (no-op if unavailable).
export function savePoints(n) {
  try {
    localStorage.setItem(POINTS_KEY, String(Math.max(0, Math.floor(n))));
  } catch {
    /* localStorage unavailable — ignore */
  }
}

// pointsForRound — points awarded when a round finishes: +1 for the round win,
// +3 bonus when that win also clinches the match.
export function pointsForRound(wonRound, wonMatch) {
  return (wonRound ? 1 : 0) + (wonMatch ? 3 : 0);
}

export function canAfford(balance, cost) {
  return balance >= cost;
}

// spend — deduct cost when affordable, otherwise leave the balance untouched.
export function spend(balance, cost) {
  return canAfford(balance, cost) ? balance - cost : balance;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/points.test.js`
Expected: PASS — 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/points.js tests/points.test.js
git commit -m "feat: points economy module (earn in arena, spend on food)"
```

---

### Task 2: Menu prices → whole points 1–3 (`data.js`)

**Files:**
- Modify: `js/data.js` (each item's `price`)

Tier mapping: Signature Rolls → 3, Sweet Bites → 3, Classic Sushi → 2, Hot Snacks → 2, Drinks → 1.

- [ ] **Step 1: Rewrite each price by item id**

Run this exact block (each `sed` anchors on the item id, so prices on shared lines are unambiguous):

```bash
cd /Users/markumreed/Documents/shopWebpage
for id in watermelon_extreme_roll melting_chocolate_roll noodles_red_bean_cream_sushi banana_chocolate_sushi mochi_ice_cream red_bean_dango chocolate_banana_roll; do
  sed -i '' "s/\(id: \"$id\", price: \)[0-9.]*/\13/" js/data.js
done
for id in salmon_nigiri tuna_nigiri shrimp_nigiri cucumber_roll avocado_roll crab_roll tempura_shrimp takoyaki dumplings edamame; do
  sed -i '' "s/\(id: \"$id\", price: \)[0-9.]*/\12/" js/data.js
done
for id in green_tea lemon_soda mango_juice water; do
  sed -i '' "s/\(id: \"$id\", price: \)[0-9.]*/\11/" js/data.js
done
```

- [ ] **Step 2: Verify every price is now an integer 1–3**

Run:
```bash
node -e "import('./js/data.js').then(m=>{const bad=m.MENU.filter(i=>!Number.isInteger(i.price)||i.price<1||i.price>3);console.log(bad.length?('BAD: '+JSON.stringify(bad.map(b=>[b.id,b.price]))):'ALL OK');m.MENU.forEach(i=>console.log(i.category.en.padEnd(16),i.price,i.id))})"
```
Expected: prints `ALL OK` followed by every item showing 3/2/2/3/1 by tier; no `BAD`.

- [ ] **Step 3: Confirm existing tests still pass**

Run: `npm test`
Expected: PASS (no test depends on the old float prices).

- [ ] **Step 4: Commit**

```bash
git add js/data.js
git commit -m "feat: price menu in whole points (1-3) by tier"
```

---

### Task 3: Award points from the arena (`arena.js`)

**Files:**
- Modify: `js/arena.js` (import + inside `finishRound`)

- [ ] **Step 1: Import `pointsForRound`**

Find the existing match import near the top of `js/arena.js`:

```js
import { newMatch, recordRound, WIN_TARGET } from "./match.js";
```

Add this line immediately after it:

```js
import { pointsForRound } from "./points.js";
```

- [ ] **Step 2: Award after the round is recorded**

In `finishRound`, find these three consecutive lines:

```js
    match = recordRound(match, outcome);
    updateMeters();
    renderScore();
```

Replace them with:

```js
    match = recordRound(match, outcome);
    updateMeters();
    renderScore();

    // Award points: +1 for winning the round, +3 more if it clinched the match.
    const matchWon = match.matchOver && match.matchWinner === "player";
    const earned = pointsForRound(outcome === "player", matchWon);
    if (earned > 0 && typeof opts.awardPoints === "function") opts.awardPoints(earned);
```

- [ ] **Step 3: Confirm nothing broke**

Run: `npm test`
Expected: PASS (match/physics tests unaffected; `arena.js` is playtested, not unit-tested).

Run: `node -e "import('./js/arena.js').then(()=>console.log('arena loads OK'))"`
Expected: prints `arena loads OK` (verifies the new `./points.js` import resolves).

- [ ] **Step 4: Commit**

```bash
git add js/arena.js
git commit -m "feat: arena awards points on round/match win via opts.awardPoints"
```

---

### Task 4: i18n strings for the game UI (`i18n.js`)

**Files:**
- Modify: `js/i18n.js` (the `STRINGS` table)

- [ ] **Step 1: Add three new keys**

In `js/i18n.js`, find the `// ---- topbar / nav ----` block. After the `"nav.bag"` line, add:

```js
  "hud.points": { zh: "积分", py: ["jī", "fēn"], en: "Points" },
  "hud.battle": { zh: "去对战", py: ["qù", "duì", "zhàn"], en: "Battle" },
  "menu.need":  { zh: "还差", py: ["hái", "chà"], en: "need" },
```

- [ ] **Step 2: Relabel the order/nav strings**

Apply these exact replacements in `js/i18n.js` (left → right):

`"nav.bag"`:
```js
  "nav.bag":    { zh: "购物袋", py: ["gòu", "wù", "dài"], en: "Bag" },
```
→
```js
  "nav.bag":    { zh: "订单", py: ["dìng", "dān"], en: "Order" },
```

`"menu.buy"`:
```js
  "menu.buy":   { zh: "购买", py: ["gòu", "mǎi"], en: "Buy" },
```
→
```js
  "menu.buy":   { zh: "加入", py: ["jiā", "rù"], en: "Add" },
```

`"cart.title"`:
```js
  "cart.title": { zh: "你的购物袋", py: ["nǐ", "de", "gòu", "wù", "dài"], en: "Your Bag" },
```
→
```js
  "cart.title": { zh: "你的订单", py: ["nǐ", "de", "dìng", "dān"], en: "Your Order" },
```

`"cart.checkout"`:
```js
  "cart.checkout": { zh: "结账", py: ["jié", "zhàng"], en: "Checkout" },
```
→
```js
  "cart.checkout": { zh: "下单", py: ["xià", "dān"], en: "Place Order" },
```

`"cart.confirm"`:
```js
  "cart.confirm": { zh: "下单成功！开动啦", py: ["xià","dān","chéng","gōng","kāi","dòng","la"], en: "Order in! Itadakimasu 🥢" },
```
→
```js
  "cart.confirm": { zh: "已下单！开动啦", py: ["yǐ","xià","dān","kāi","dòng","la"], en: "Order up! Itadakimasu 🥢" },
```

- [ ] **Step 3: Verify the module loads and keys resolve**

Run:
```bash
node -e "import('./js/i18n.js').then(m=>{for(const k of ['hud.points','hud.battle','menu.need','menu.buy','nav.bag','cart.checkout','cart.confirm']) console.log(k, '=>', m.t(k).en)})"
```
Expected: prints each key with its new English (`Points`, `Battle`, `need`, `Add`, `Order`, `Place Order`, `Order up! Itadakimasu 🥢`).

Run: `npm test`
Expected: PASS (`tests/i18n.test.js` stays green).

- [ ] **Step 4: Commit**

```bash
git add js/i18n.js
git commit -m "feat: i18n strings for points HUD, battle CTA, order tray"
```

---

### Task 5: Topbar POINTS HUD + Battle button (`index.html`)

**Files:**
- Modify: `index.html` (the `<nav class="nav">` block)

- [ ] **Step 1: Add the HUD and Battle button to the nav**

Find this block (lines ~25–32):

```html
    <nav class="nav">
      <a href="#menu" data-i18n="nav.menu"></a>
      <a href="#about" data-i18n="nav.story"></a>
      <button id="cart-toggle" class="cart-toggle" aria-label="打开购物袋">
        <span class="coin-ico" aria-hidden="true">◎</span> <span data-i18n="nav.bag"></span>
        <span id="cart-count" class="cart-badge">0</span>
      </button>
    </nav>
```

Replace it with:

```html
    <nav class="nav">
      <a href="#menu" data-i18n="nav.menu"></a>
      <a href="#about" data-i18n="nav.story"></a>
      <span class="points-hud" aria-label="Points">
        <span class="ph-star" aria-hidden="true">★</span>
        <span class="ph-label" data-i18n="hud.points"></span>
        <span id="points-count" class="ph-count">0</span>
      </span>
      <button id="battle-btn" class="battle-btn">
        <span aria-hidden="true">⚔</span> <span data-i18n="hud.battle"></span>
      </button>
      <button id="cart-toggle" class="cart-toggle" aria-label="打开订单">
        <span class="coin-ico" aria-hidden="true">◎</span> <span data-i18n="nav.bag"></span>
        <span id="cart-count" class="cart-badge">0</span>
      </button>
    </nav>
```

- [ ] **Step 2: Verify markup**

Run: `node -e "const h=require('fs').readFileSync('index.html','utf8');for(const id of ['points-count','battle-btn','cart-count','cart-toggle','checkout','cart-confirm']) console.log(id, h.includes('id=\"'+id+'\"'))"`
Expected: every id prints `true`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: topbar POINTS HUD and Battle button"
```

---

### Task 6: Wire the game in `main.js` (full rewrite)

**Files:**
- Modify: `js/main.js` (replace entire file)

This rewrite keeps the cart drawer DOM and the dialogue/arena/builder wiring, but re-prices the tray in points, gates Add on the remaining budget, adds Place Order + the battle CTA, and feeds `awardPoints` to the arena. It reuses `cart.js` and the existing `#cart-*`/`#checkout`/`#cart-confirm` elements.

- [ ] **Step 1: Replace the whole file**

Overwrite `js/main.js` with exactly:

```js
// main.js — page wiring: arena-points ordering game.
// You earn ★ points by winning in the arena and spend them ordering food.
import { MENU } from "./data.js";
import { addItem, setQty, cartCount, cartSubtotal, saveCart, loadCart } from "./cart.js";
import { loadPoints, savePoints, canAfford, spend } from "./points.js";
import { biHtml, phraseHtml, applyI18n, initSpeech } from "./i18n.js";
import { mountArena } from "./arena.js";
import { mountBuilder } from "./builder.js";

let cart = loadCart();
let points = loadPoints();
let openBuilder = () => {};   // set in init once the builder is mounted

const $ = (sel) => document.querySelector(sel);

// What the player can still spend once the current tray is paid for.
const remaining = () => points - cartSubtotal(cart);

// ---- Topbar HUD ----
function renderHud() {
  $("#points-count").textContent = points;
  $("#cart-count").textContent = cartCount(cart);
}

// ---- Menu rendering (affordability + lock) ----
function renderMenu() {
  const grid = $("#menu-grid");
  const budget = remaining();
  let lastCat = null;
  grid.innerHTML = MENU.map((item) => {
    let head = "";
    if (item.category.en !== lastCat) {
      lastCat = item.category.en;
      head = `<h3 class="menu-cat">${phraseHtml(item.category)}</h3>`;
    }
    const afford = canAfford(budget, item.price);
    const need = item.price - budget;
    const btn = afford
      ? `<button class="mc-add" data-id="${item.id}">${biHtml("menu.buy")}</button>`
      : `<button class="mc-add" data-id="${item.id}" disabled>🔒 ${biHtml("menu.need")} ${need}</button>`;
    return head + `
    <article class="menu-card${afford ? "" : " is-locked"}">
      <img class="mc-img" src="${item.image}" alt="${item.name.en.replace(/"/g, "&quot;")}" loading="lazy"
           onerror="this.style.display='none'" />
      <h3>${phraseHtml(item.name)}</h3>
      <p class="mc-desc">${phraseHtml(item.desc)}</p>
      <div class="mc-foot">
        <span class="mc-cost">★ ${item.price}</span>
        ${btn}
      </div>
    </article>`;
  }).join("");

  grid.querySelectorAll(".mc-add:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = MENU.find((m) => m.id === btn.dataset.id);
      cart = addItem(cart, item);
      saveCart(cart);
      renderAll();
      openCart();
    });
  });
}

// ---- Order tray rendering ----
function renderTray() {
  $("#cart-total").textContent = cartSubtotal(cart);

  const lines = $("#cart-lines");
  if (cart.length === 0) {
    lines.innerHTML = `<li class="cart-empty">${biHtml("cart.empty")}</li>
      <li class="tray-battle-wrap">
        <button class="tray-battle"><span aria-hidden="true">⚔</span> ${biHtml("hud.battle")}</button>
      </li>`;
    lines.querySelector(".tray-battle").addEventListener("click", () => {
      closeCart();
      openBuilder();
    });
    $("#checkout").disabled = true;
    return;
  }

  $("#checkout").disabled = !canAfford(points, cartSubtotal(cart));
  lines.innerHTML = cart.map((line) => `
    <li class="cart-line">
      <span class="cl-name">${phraseHtml(line.name)}</span>
      <span class="cl-qty">
        <button data-act="dec" data-id="${line.id}">−</button>
        <span>${line.qty}</span>
        <button data-act="inc" data-id="${line.id}">+</button>
      </span>
      <span class="cl-price">★ ${line.price * line.qty}</span>
    </li>
  `).join("");

  lines.querySelectorAll(".cl-qty button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const cur = cart.find((l) => l.id === id);
      if (btn.dataset.act === "inc") {
        if (remaining() < cur.price) return;   // can't add past your budget
        cart = setQty(cart, id, cur.qty + 1);
      } else {
        cart = setQty(cart, id, cur.qty - 1);
      }
      saveCart(cart);
      renderAll();
    });
  });
}

function renderAll() {
  renderHud();
  renderMenu();
  renderTray();
}

// ---- Order drawer open/close ----
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

// ---- Place Order (spend points) ----
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

// ---- Points earned in the arena ----
function awardPoints(n) {
  points += n;
  savePoints(points);
  renderAll();
}

// ---- JRPG dialogue (bilingual) ----
const LINE_KEYS = ["chef.l1", "chef.l2", "chef.l3", "chef.l4"];

function mountDialogue() {
  const box = $("#dialogue");
  const textEl = $("#dialogue-text");
  const nextEl = $("#dialogue-next");
  if (!box || !textEl) return;

  let idx = 0;
  function show(i) {
    textEl.innerHTML = biHtml(LINE_KEYS[i]);
    textEl.classList.remove("fade-in");
    void textEl.offsetWidth;        // restart the fade animation
    textEl.classList.add("fade-in");
    nextEl.classList.add("show");
  }
  function advance() { idx = (idx + 1) % LINE_KEYS.length; show(idx); }

  show(0);
  box.addEventListener("click", advance);
  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); advance(); }
  });
}

// ---- Wire it up ----
function init() {
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
    muteEl: $("#arena-mute"),
    spinDirEl: $("#spin-dir"),
    rivalSetupEl: $("#rival-setup"),
    buildYouEl: $("#build-you"),
    buildRivalEl: $("#build-rival"),
    awardPoints,
    onExit: () => builder.open(),
  });
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
  openBuilder = () => builder.open();

  renderAll();
  mountDialogue();
  $("#cart-toggle").addEventListener("click", openCart);
  $("#cart-close").addEventListener("click", closeCart);
  $("#cart-scrim").addEventListener("click", closeCart);
  $("#checkout").addEventListener("click", placeOrder);
  $("#battle-btn").addEventListener("click", () => builder.open());
  $("#red-button").addEventListener("click", () => builder.open());
  $("#arena-exit").addEventListener("click", arena.close);
  applyI18n(document);
  initSpeech(document);
}

init();
```

- [ ] **Step 2: Verify the module graph loads**

Run: `node -e "Promise.all([import('./js/points.js'),import('./js/cart.js'),import('./js/data.js')]).then(()=>console.log('deps OK'))"`
Expected: prints `deps OK` (arena/builder pull in DOM/Canvas globals, so they're verified by playtest, not node).

Run: `npm test`
Expected: PASS — all existing unit tests plus `points.test.js` green.

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "feat: points-gated ordering, Place Order, and battle CTA in main.js"
```

---

### Task 7: 8-bit styling for the game UI (`theme.css`)

**Files:**
- Modify: `css/theme.css` (append a styling block at the end)

- [ ] **Step 1: Append the styles**

Add this block to the **end** of `css/theme.css`:

```css
/* ===== Arena-points ordering game ===== */

/* Topbar POINTS HUD */
.points-hud {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: var(--game);
  font-size: 11px;
  color: var(--ink);
  background: #fff;
  border: 3px solid var(--ink);
  box-shadow: 3px 3px 0 var(--ink);
  padding: 7px 10px;
}
.points-hud .ph-star { color: #c98a00; font-size: 14px; }
.points-hud .ph-count { color: var(--red); min-width: 1.2em; text-align: right; }

/* ⚔ Battle button (topbar) */
.battle-btn {
  font-family: var(--game);
  font-size: 11px;
  color: #fff;
  background: var(--red);
  border: 3px solid var(--ink);
  box-shadow: 3px 3px 0 var(--ink);
  padding: 7px 12px;
  cursor: pointer;
}
.battle-btn:hover { filter: brightness(1.08); }
.battle-btn:active { transform: translate(3px, 3px); box-shadow: none; }

/* ★ point cost on a menu card (replaces the ◎ price) */
.menu-card .mc-cost {
  font-family: var(--game);
  font-size: 14px;
  color: var(--ink);
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

/* Locked card — can't afford it yet */
.menu-card.is-locked {
  opacity: 0.55;
  filter: grayscale(0.4);
}
.menu-card.is-locked:hover { transform: none; box-shadow: var(--panel-shadow); }
.menu-card .mc-add[disabled] {
  cursor: not-allowed;
  background: var(--paper);
  color: var(--ink);
  opacity: 0.9;
}
.menu-card .mc-add[disabled]:hover { background: var(--paper); color: var(--ink); }

/* Place Order disabled state */
#checkout[disabled] { opacity: 0.5; cursor: not-allowed; }

/* Battle CTA inside the empty order tray */
.tray-battle-wrap { list-style: none; margin-top: 14px; display: flex; justify-content: center; }
.tray-battle {
  font-family: var(--game);
  font-size: 12px;
  color: #fff;
  background: var(--red);
  border: 3px solid var(--ink);
  box-shadow: 4px 4px 0 var(--ink);
  padding: 12px 16px;
  cursor: pointer;
}
.tray-battle:hover { filter: brightness(1.08); }
.tray-battle:active { transform: translate(4px, 4px); box-shadow: none; }

/* Keep Chinese item names legible — never break mid-word */
.menu-card h3 .bi-zh { white-space: nowrap; }
```

- [ ] **Step 2: Verify CSS is valid and present**

Run: `node -e "const c=require('fs').readFileSync('css/theme.css','utf8');console.log('points-hud',c.includes('.points-hud'),'battle-btn',c.includes('.battle-btn'),'mc-cost',c.includes('.mc-cost'),'is-locked',c.includes('.is-locked'),'tray-battle',c.includes('.tray-battle'))"`
Expected: every selector prints `true`.

- [ ] **Step 3: Commit**

```bash
git add css/theme.css
git commit -m "feat: 8-bit styling for points HUD, battle button, locked cards"
```

---

### Task 8: Manual playtest (full loop)

**Files:** none (verification only)

- [ ] **Step 1: Serve the page**

Run: `python3 -m http.server 8000` (then open `http://localhost:8000`). Keep it running.

- [ ] **Step 2: Cold-start lock check**

In the browser, first clear state: open devtools console and run `localStorage.clear(); location.reload();`.
Expected: topbar shows `★ Points 0`; every menu card is dimmed (`is-locked`) with a disabled `🔒 need N` button; opening the Order drawer shows the empty message + the ⚔ Battle button.

- [ ] **Step 3: Earn points**

Click the ⚔ Battle button → builder opens → To Battle → arena. Win a round.
Expected: on returning to the shop (close the builder with "Back to Shop"), `★ Points` reflects the winnings (+1 per round won, +3 extra on a match win), and cards costing ≤ your balance are now un-dimmed with an **Add** button.

- [ ] **Step 4: Order food**

Add affordable items to the tray; try to add past your budget.
Expected: you can only Add / `+` while the remaining budget covers the item; the cheapest unaffordable item stays locked. The tray total shows `★ N`. Click **Place Order**.
Expected: points decrease by the total, the tray clears, `Order up! Itadakimasu 🥢` flashes, and cards re-lock if you can no longer afford them.

- [ ] **Step 5: Persistence**

Reload the page.
Expected: the points balance persists (localStorage), and affordability reflects it.

- [ ] **Step 6: Readability / mobile**

Narrow the window to a phone width.
Expected: Chinese item names don't break mid-word; the HUD, ★ costs, and buttons render in the pixel font and stay legible.

- [ ] **Step 7: Final commit (if any tweaks were needed)**

If playtest surfaced fixes, make them in the relevant task's file, then:
```bash
git add -A && git commit -m "fix: playtest adjustments for points ordering game"
```

---

## Notes for the implementer

- **TDD scope:** only `points.js` has unit tests — it holds all the new pure logic. The DOM/Canvas wiring (`main.js`, `arena.js`) follows the codebase's existing convention of being playtested (Task 8), not unit-tested.
- **Invariant:** Add/`+` are gated on `remaining() = points − trayTotal`, so the tray total can never exceed the balance and **Place Order** always succeeds for a freshly built tray. `placeOrder` and the `#checkout[disabled]` state still guard against a stale saved tray loaded when the balance is lower.
- **Navigation reuse:** the ⚔ buttons call `builder.open()` — the same entry the hidden red button uses. After a battle, `arena.onExit` reopens the builder; closing it ("Back to Shop") returns to the shop, which is already current because `awardPoints` re-rendered on each win.
- **No deletions:** `cart.js` and `tests/cart.test.js` are intentionally kept and reused.
