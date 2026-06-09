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
