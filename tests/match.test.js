// tests/match.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { newMatch, recordRound, WIN_TARGET } from "../js/match.js";

test("WIN_TARGET is 2 (best-of-3)", () => {
  assert.equal(WIN_TARGET, 2);
});

test("newMatch starts at round 1, 0-0, not over", () => {
  const m = newMatch();
  assert.equal(m.round, 1);
  assert.equal(m.you, 0);
  assert.equal(m.rival, 0);
  assert.equal(m.streak, 0);
  assert.equal(m.matchOver, false);
  assert.equal(m.matchWinner, null);
});

test("newMatch carries an incoming streak", () => {
  assert.equal(newMatch(3).streak, 3);
});

test("recordRound('player') scores you and advances the round", () => {
  const m = recordRound(newMatch(), "player");
  assert.equal(m.you, 1);
  assert.equal(m.rival, 0);
  assert.equal(m.round, 2);
  assert.equal(m.matchOver, false);
});

test("recordRound('draw') changes nothing and keeps the round", () => {
  const start = newMatch();
  const m = recordRound(start, "draw");
  assert.equal(m.you, 0);
  assert.equal(m.rival, 0);
  assert.equal(m.round, 1);
  assert.equal(m.matchOver, false);
});

test("reaching 2 player wins ends the match and increments streak", () => {
  let m = newMatch(1);
  m = recordRound(m, "player");
  m = recordRound(m, "player");
  assert.equal(m.you, 2);
  assert.equal(m.matchOver, true);
  assert.equal(m.matchWinner, "player");
  assert.equal(m.streak, 2);
});

test("reaching 2 rival wins ends the match and resets streak to 0", () => {
  let m = newMatch(5);
  m = recordRound(m, "opponent");
  m = recordRound(m, "opponent");
  assert.equal(m.rival, 2);
  assert.equal(m.matchOver, true);
  assert.equal(m.matchWinner, "opponent");
  assert.equal(m.streak, 0);
});

test("recordRound after match over returns state unchanged", () => {
  let m = newMatch();
  m = recordRound(m, "player");
  m = recordRound(m, "player"); // match over
  const after = recordRound(m, "player");
  assert.deepEqual(after, m);
});

test("recordRound does not mutate the input state", () => {
  const start = newMatch();
  recordRound(start, "player");
  assert.equal(start.you, 0);
  assert.equal(start.round, 1);
});
