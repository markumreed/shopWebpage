// tests/tray.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { addPieces, eatPiece, trayCount, loadTray } from "../js/tray.js";

const A = { id: "a", name: { zh: "甲", py: "jiǎ", en: "A" }, image: "a.webp", qty: 2 };
const B = { id: "b", name: { zh: "乙", py: "yǐ", en: "B" }, image: "b.webp", qty: 1 };

test("addPieces expands qty into one entry per piece", () => {
  const t = addPieces([], [A, B]);
  assert.equal(t.length, 3);
  assert.deepEqual(t[0], { id: "a", name: A.name, image: "a.webp" });
});

test("addPieces appends to an existing tray", () => {
  const t = addPieces([{ id: "x", name: {}, image: "x" }], [B]);
  assert.equal(t.length, 2);
  assert.equal(t[1].id, "b");
});

test("addPieces defaults a missing qty to 1", () => {
  assert.equal(addPieces([], [{ id: "c", name: {}, image: "c" }]).length, 1);
});

test("eatPiece removes the piece at the index", () => {
  assert.equal(eatPiece(addPieces([], [A]), 0).length, 1);
});

test("eatPiece does not mutate the input", () => {
  const t = addPieces([], [A]);
  eatPiece(t, 0);
  assert.equal(t.length, 2);
});

test("eatPiece is a no-op for an out-of-range index", () => {
  const t = addPieces([], [B]);
  assert.deepEqual(eatPiece(t, 5), t);
});

test("trayCount counts pieces", () => {
  assert.equal(trayCount(addPieces([], [A, B])), 3);
});

test("loadTray defaults to [] when storage is unavailable", () => {
  assert.deepEqual(loadTray(), []);
});
