// js/match.js — pure best-of-3 round/score/streak state. No DOM, no canvas.

// First to this many round wins takes the match.
export const WIN_TARGET = 2;

// Fresh match state. `streak` carries the player's current match-win streak.
export function newMatch(streak = 0) {
  return { round: 1, you: 0, rival: 0, streak, matchOver: false, matchWinner: null };
}

// Apply a round outcome and return a NEW state (input is never mutated).
// outcome: "player" | "opponent" | "draw"
//   - "draw": no score change, same round replays.
//   - otherwise: the winner's tally increments and the round advances.
// When a side reaches WIN_TARGET the match ends: matchOver=true, matchWinner set,
// and the streak increments on a player match win or resets to 0 on a loss.
export function recordRound(state, outcome) {
  if (state.matchOver) return state;
  if (outcome === "draw") return { ...state };

  const you = state.you + (outcome === "player" ? 1 : 0);
  const rival = state.rival + (outcome === "opponent" ? 1 : 0);

  const matchOver = you >= WIN_TARGET || rival >= WIN_TARGET;
  const matchWinner = matchOver ? (you >= WIN_TARGET ? "player" : "opponent") : null;
  const streak = matchOver
    ? (matchWinner === "player" ? state.streak + 1 : 0)
    : state.streak;
  const round = matchOver ? state.round : state.round + 1;

  return { round, you, rival, streak, matchOver, matchWinner };
}
