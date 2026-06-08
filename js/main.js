// main.js — page wiring
import { MENU } from "./data.js";
import {
  addItem, setQty, cartCount, cartSubtotal, saveCart, loadCart
} from "./cart.js";
import { biHtmlEntry, biHtml, applyI18n, initSpeech } from "./i18n.js";
import { mountArena } from "./arena.js";
import { mountBuilder } from "./builder.js";

let cart = loadCart();

const $ = (sel) => document.querySelector(sel);

// ---- Menu rendering ----
function renderMenu() {
  const grid = $("#menu-grid");
  grid.innerHTML = MENU.map((item) => `
    <article class="menu-card">
      <span class="mc-kana">${biHtmlEntry(item.kana)}</span>
      <h3>${biHtmlEntry(item.name)}</h3>
      <p class="mc-desc">${biHtmlEntry(item.desc)}</p>
      <div class="mc-foot">
        <span class="mc-price">${item.price}</span>
        <button class="mc-add" data-id="${item.id}">${biHtml("menu.buy")}</button>
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
  $("#cart-total").textContent = cartSubtotal(cart);

  const lines = $("#cart-lines");
  if (cart.length === 0) {
    lines.innerHTML = `<li class="cart-empty">${biHtml("cart.empty")}</li>`;
    return;
  }
  lines.innerHTML = cart.map((line) => `
    <li class="cart-line">
      <span class="cl-name">${biHtmlEntry(line.name)}</span>
      <span class="cl-qty">
        <button data-act="dec" data-id="${line.id}">−</button>
        <span>${line.qty}</span>
        <button data-act="inc" data-id="${line.id}">+</button>
      </span>
      <span class="cl-price">◎${line.price * line.qty}</span>
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
  renderMenu();
  renderCart();
  mountDialogue();
  $("#cart-toggle").addEventListener("click", openCart);
  $("#cart-close").addEventListener("click", closeCart);
  $("#cart-scrim").addEventListener("click", closeCart);
  $("#checkout").addEventListener("click", checkout);

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
  $("#red-button").addEventListener("click", () => builder.open());
  $("#arena-exit").addEventListener("click", arena.close);
  applyI18n(document);
  initSpeech(document);
}

init();
