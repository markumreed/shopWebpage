// js/tray.js — the owned sushi tray (inventory). Pure + localStorage. No DOM.
export const TRAY_KEY = "shop.tray";

export function loadTray() {
  try {
    const arr = JSON.parse(localStorage.getItem(TRAY_KEY));
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function saveTray(tray) {
  try { localStorage.setItem(TRAY_KEY, JSON.stringify(tray)); } catch { /* ignore */ }
}

// addPieces — append one entry per piece (order lines expanded by qty).
// items: [{ id, name, image, qty }]. Returns a NEW tray.
export function addPieces(tray, items) {
  const pieces = [];
  for (const it of items) {
    for (let i = 0; i < (it.qty ?? 1); i++) {
      pieces.push({ id: it.id, name: it.name, image: it.image });
    }
  }
  return [...tray, ...pieces];
}

// eatPiece — remove the piece at `index`, returning a NEW tray (unchanged if oob).
export function eatPiece(tray, index) {
  if (index < 0 || index >= tray.length) return tray;
  return tray.filter((_, i) => i !== index);
}

export function trayCount(tray) { return tray.length; }
