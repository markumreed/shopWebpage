// main.js — page wiring: arena-points ordering game.
// You earn ★ points by winning in the arena and spend them ordering food.
import { MENU } from "./data.js";
import { addItem, setQty, cartCount, cartSubtotal, saveCart, loadCart } from "./cart.js";
import { loadPoints, savePoints, canAfford, spend } from "./points.js";
import { loadTray, saveTray, addPieces, eatPiece, trayCount } from "./tray.js";
import { biHtml, phraseHtml, applyI18n, initSpeech } from "./i18n.js";
import { mountArena } from "./arena.js";
import { mountBuilder } from "./builder.js";
import * as sfx from "./sound.js";

let cart = loadCart();
let points = loadPoints();
let tray = loadTray();
let eaten = loadEaten();
let openBuilder = () => {};   // set in init once the builder is mounted

const EATEN_KEY = "shop.eaten";
const EAT_MS = 1500;          // hold duration to finish a bite
function loadEaten() { try { const n = parseInt(localStorage.getItem(EATEN_KEY), 10); return Number.isFinite(n) && n >= 0 ? n : 0; } catch { return 0; } }
function saveEaten(n) { try { localStorage.setItem(EATEN_KEY, String(n)); } catch { /* ignore */ } }

const $ = (sel) => document.querySelector(sel);

// What the player can still spend once the current tray is paid for.
const remaining = () => points - cartSubtotal(cart);

// ---- Topbar HUD ----
function renderHud() {
  $("#points-count").textContent = points;
  $("#cart-count").textContent = cartCount(cart);
  $("#tray-count").textContent = trayCount(tray);
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
  renderTrayDrawer();
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

// ---- Place Order (spend points) ----
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

// ---- Points earned in the arena ----
function awardPoints(n) {
  points += n;
  savePoints(points);
  renderAll();
}

// ---- JRPG dialogue (bilingual) ----
const LINE_KEYS = ["chef.l1", "chef.l2", "chef.l3", "chef.l4", "chef.l5", "chef.l6"];

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
  $("#tray-toggle").addEventListener("click", openTray);
  $("#tray-close").addEventListener("click", closeTray);
  $("#tray-scrim").addEventListener("click", closeTray);
  $("#battle-btn").addEventListener("click", () => builder.open());
  $("#red-button").addEventListener("click", () => builder.open());
  $("#arena-exit").addEventListener("click", arena.close);
  applyI18n(document);
  initSpeech(document);
}

init();
