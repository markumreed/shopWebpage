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

// ★ awarded to the shop wallet when a player wins a finish, plus a bonus when
// that finish clinches the match.
export const MATCH_BONUS = 2;
export function shopPointsForFinish(outcome, finishValue, matchWon) {
  return (outcome === "player" ? finishValue : 0) + (matchWon ? MATCH_BONUS : 0);
}

export function canAfford(balance, cost) {
  return balance >= cost;
}

// spend — deduct cost when affordable, otherwise leave the balance untouched.
export function spend(balance, cost) {
  return canAfford(balance, cost) ? balance - cost : balance;
}
