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
