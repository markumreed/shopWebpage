// tests/match.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { newMatch, recordRound, POINT_TARGET, FINISH_POINTS } from "../js/match.js";

test("POINT_TARGET is 4", () => assert.equal(POINT_TARGET, 4));

test("FINISH_POINTS: spin 1, over 2, burst 2, xtreme 3", () => {
  assert.deepEqual(FINISH_POINTS, { spin: 1, over: 2, burst: 2, xtreme: 3 });
});

test("newMatch starts 0-0, round 1, not over", () => {
  const m = newMatch();
  assert.equal(m.round, 1); assert.equal(m.you, 0); assert.equal(m.rival, 0);
  assert.equal(m.streak, 0); assert.equal(m.matchOver, false); assert.equal(m.matchWinner, null);
});

test("newMatch carries an incoming streak", () => assert.equal(newMatch(3).streak, 3));

test("a Spin finish scores 1 for the player and advances the round", () => {
  const m = recordRound(newMatch(), "player", "spin");
  assert.equal(m.you, 1); assert.equal(m.rival, 0); assert.equal(m.round, 2); assert.equal(m.matchOver, false);
});

test("an Over finish scores 2", () => assert.equal(recordRound(newMatch(), "player", "over").you, 2));
test("a Burst finish scores 2", () => assert.equal(recordRound(newMatch(), "opponent", "burst").rival, 2));
test("an Xtreme finish scores 3", () => assert.equal(recordRound(newMatch(), "player", "xtreme").you, 3));

test("draw changes nothing and keeps the round", () => {
  const m = recordRound(newMatch(), "draw");
  assert.equal(m.you, 0); assert.equal(m.rival, 0); assert.equal(m.round, 1); assert.equal(m.matchOver, false);
});

test("reaching 4 points ends the match and increments streak", () => {
  let m = newMatch(1);
  m = recordRound(m, "player", "over");   // 2
  m = recordRound(m, "player", "over");   // 4 -> over
  assert.equal(m.you, 4); assert.equal(m.matchOver, true);
  assert.equal(m.matchWinner, "player"); assert.equal(m.streak, 2);
});

test("an Xtreme can overshoot the target and still win (2 + 3 = 5)", () => {
  let m = newMatch(0);
  m = recordRound(m, "player", "over");    // 2
  m = recordRound(m, "player", "xtreme");  // 5 -> over
  assert.equal(m.you, 5); assert.equal(m.matchOver, true); assert.equal(m.matchWinner, "player");
});

test("rival reaching 4 ends the match and resets streak", () => {
  let m = newMatch(5);
  m = recordRound(m, "opponent", "xtreme"); // 3
  m = recordRound(m, "opponent", "spin");   // 4 -> over
  assert.equal(m.rival, 4); assert.equal(m.matchOver, true);
  assert.equal(m.matchWinner, "opponent"); assert.equal(m.streak, 0);
});

test("recordRound after match over returns state unchanged", () => {
  let m = newMatch();
  m = recordRound(m, "player", "over");
  m = recordRound(m, "player", "over"); // 4 -> over
  assert.deepEqual(recordRound(m, "player", "spin"), m);
});

test("recordRound does not mutate the input state", () => {
  const start = newMatch();
  recordRound(start, "player", "over");
  assert.equal(start.you, 0); assert.equal(start.round, 1);
});

test("a mixed-finish path to 4: spin + burst + spin", () => {
  let m = newMatch(0);
  m = recordRound(m, "player", "spin");   // 1
  m = recordRound(m, "player", "burst");  // 3
  m = recordRound(m, "player", "spin");   // 4 -> over
  assert.equal(m.you, 4); assert.equal(m.matchOver, true); assert.equal(m.round, 3);
});
