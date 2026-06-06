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
