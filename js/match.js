// js/match.js — pure Beyblade X scoring: points by finish type, first to 4. No DOM.

// First to this many points takes the match.
export const POINT_TARGET = 4;

// Points awarded by finish type (Beyblade X).
export const FINISH_POINTS = { spin: 1, over: 2, burst: 2, xtreme: 3 };

// Fresh match state. `you`/`rival` are POINT totals; `streak` carries the
// player's current match-win streak.
export function newMatch(streak = 0) {
  return { round: 1, you: 0, rival: 0, streak, matchOver: false, matchWinner: null };
}

// Apply a finished round and return a NEW state (input never mutated).
//   outcome: "player" | "opponent" | "draw"
//   finish:  a FINISH_POINTS key ("spin"|"over"|"burst"|"xtreme"); ignored on draw.
// draw → no score change, same round replays. Otherwise the winner gains
// FINISH_POINTS[finish]; reaching POINT_TARGET ends the match (streak +1 on a
// player match win, reset to 0 on a loss).
export function recordRound(state, outcome, finish) {
  if (state.matchOver) return state;
  if (outcome === "draw") return { ...state };

  const pts = FINISH_POINTS[finish] ?? 0;
  const you = state.you + (outcome === "player" ? pts : 0);
  const rival = state.rival + (outcome === "opponent" ? pts : 0);

  const matchOver = you >= POINT_TARGET || rival >= POINT_TARGET;
  const matchWinner = matchOver ? (you >= POINT_TARGET ? "player" : "opponent") : null;
  const streak = matchOver
    ? (matchWinner === "player" ? state.streak + 1 : 0)
    : state.streak;
  const round = matchOver ? state.round : state.round + 1;

  return { round, you, rival, streak, matchOver, matchWinner };
}
