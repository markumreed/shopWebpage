// main.js — page wiring
import { MENU } from "./data.js";
import {
  addItem, setQty, cartCount, cartSubtotal, saveCart, loadCart
} from "./cart.js";
import { mountArena } from "./arena.js";

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
}

init();
