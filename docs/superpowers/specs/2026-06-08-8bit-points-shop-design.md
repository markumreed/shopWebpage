# 8-Bit Points Shop — Design

**Date:** 2026-06-08
**Status:** Approved, ready for implementation plan

## Summary

Turn the front-page menu into an 8-bit game shop. You **earn points** by winning
in the beyblade arena (+1 per round won, +3 bonus per match won) and **spend
them** on menu items priced **1–3 points**. Buying is instant: afford it → BUY
deducts points; can't afford → the item is locked. The menu + topbar are
restyled as a chunky, high-contrast 8-bit shop, and the cramped/low-contrast
bilingual text is fixed (bigger, bolder Chinese that doesn't break mid-word).
The cart is removed.

## Goals

- A real gameplay loop: play the arena → earn points → buy sushi.
- Fix readability: legible, high-contrast text; Chinese terms never wrap mid-word.
- 8-bit shop aesthetic on the front page (topbar HUD + menu), keeping the
  bilingual learning text (Chinese + English, pinyin on hover/tap).

## Non-Goals

- No persistent inventory — buying spends points and confirms; it doesn't track
  "owned" items (YAGNI).
- No 8-bit restyle of the arena/builder this pass (front page only).
- No change to the bilingual render core or the pinyin-on-hover behavior.

## Decisions (from brainstorming)

- **Earning:** +1 point per round won, +3 bonus on a match win (best-of-3).
- **Spending:** instant buy; locked + "🔒 need N" when the balance is short.
- **8-bit scope:** front page (topbar + menu) only.
- **Cart removed:** bag/cart drawer, `cart.js`, and its tests are deleted; the
  points HUD replaces the bag.
- **Prices:** whole numbers 1–3 by tier (below).

## Points economy

### `js/points.js` (new, pure + tested)
- `POINTS_KEY = "arena.points"`.
- `loadPoints()` → integer balance (0 if unset/corrupt; tolerant of missing
  `localStorage`).
- `savePoints(n)` → persists (no-op if `localStorage` unavailable).
- `pointsForRound(playerWonRound, matchWon)` → `(playerWonRound ? 1 : 0) +
  (matchWon ? 3 : 0)` — points awarded when a round finishes.
- `canAfford(balance, cost)` → `balance >= cost`.
- `spend(balance, cost)` → `canAfford ? balance - cost : balance` (never negative).

### Flow
- `main.js` holds the live `points` balance (`loadPoints()` at startup), renders
  the topbar HUD and the menu's affordability, and owns spending.
- `mountArena` gains an `awardPoints(n)` option. In `finishRound`, after
  `recordRound`, the arena computes `pointsForRound(outcome === "player",
  match.matchOver && match.matchWinner === "player")` and, if > 0, calls
  `awardPoints(that)`. `main.js`'s callback adds it, `savePoints`, and re-renders
  the HUD.
- On arena **exit** (the existing `onExit` → `builder.open()` path) and at
  startup, `main.js` re-renders the HUD + menu so the shop reflects the latest
  balance.
- The existing 🔥 streak HUD inside the arena is unchanged.

## Instant-buy menu (`js/main.js`, `index.html`)

The cart is gone. Each menu card renders the trilingual name/desc (via the
existing `phraseHtml`), the image, and a footer with the **cost** and a **buy
control**:
- Afford (`points >= price`): an enabled `BUY` button. Click → `points =
  spend(points, price)`, `savePoints`, re-render HUD + all cards, and flash a
  confirm (`已购买 yǐ gòumǎi · Got it 🥢`).
- Can't afford: the card gets a `is-locked` class (dimmed); the button shows
  `🔒 need {price - points}` and is disabled.
- Cost shows as `★ {price}` (pixel font).

`renderMenu` re-runs (or each card's afford state re-evaluates) after any
purchase and on HUD refresh. The add-to-cart handler/`openCart`/`closeCart`/
`checkout` and the `cart` state are removed from `main.js`; `cart.js` and
`tests/cart.test.js` are deleted.

## Topbar HUD (`index.html`, `css/theme.css`)

The bag toggle (`#cart-toggle` + badge) and the whole cart drawer (`#cart-drawer`,
`#cart-scrim`) are removed. In the bag's place: a pixel **POINTS ★ <span
id="points-count">0</span>** readout. Nav keeps Wares/Story links. The topbar is
restyled chunky/high-contrast (8-bit).

## 8-bit styling + readability (`css/theme.css`, maybe `css/i18n.css`)

- **Pixel font** (Press Start 2P, already loaded) for UI chrome: the points HUD,
  the cost `★ N`, BUY/locked buttons, category banners, numbers.
- **Chinese stays legible:** a bold non-pixel font (the loaded Zen Kaku Gothic
  New 900, which renders these Han characters) at a **larger size with strong
  dark-on-light contrast**. Each term's Chinese gets `white-space: nowrap` so
  names **don't break mid-word**; cards are wide enough to fit (single column on
  mobile). The English gloss is bumped to clearly legible (size/opacity).
- **Cards:** chunky pixel borders (thick solid + hard box-shadow), limited
  high-contrast palette, the image framed, the footer holding `★ cost` + BUY.
- **Category headers** styled as shop banners.
- This supersedes the parts of the recent readability pass that were too
  small/light; the pinyin-on-hover/tap mechanic and `phraseHtml` markup remain.

## Prices → 1–3 (`js/data.js`)

Replace each item's `price` with a whole number by tier:
- **Drinks → 1** (green tea, lemon soda, mango juice, water).
- **Classic Sushi → 2**, **Hot Snacks → 2**.
- **Signature Rolls → 3**, **Sweet Bites → 3**.
All integers, all within 1–3. (Structured `{zh,py,en}` name/desc/category and
`image` are unchanged; only `price` changes.)

## Files

- **New:** `js/points.js`, `tests/points.test.js`.
- **Modified:** `js/data.js` (1–3 prices), `js/main.js` (points HUD + instant-buy
  + `awardPoints` wiring, remove cart), `js/arena.js` (award on round/match win),
  `index.html` (points HUD, shop card markup, remove cart drawer/toggle),
  `css/theme.css` (8-bit shop + readability), possibly `css/i18n.css` (gloss/wrap).
- **Removed:** `js/cart.js`, `tests/cart.test.js`.

## Testing Strategy

- **Pure (unit-tested)** `tests/points.test.js`: `pointsForRound` (round only,
  match bonus, neither), `canAfford` (boundary), `spend` (deducts, never below 0
  / no-op when short), and `loadPoints` default. Existing render-core tests
  (`i18n`, `build`, `physics`, `match`) stay green; the removed `cart.test.js`
  drops with the module.
- **DOM / canvas (playtested):** earning points in the arena and seeing the HUD
  update on exit; buy/lock affordability; the 8-bit look and the readability
  (no mid-word Chinese wrap) on desktop + mobile.

## Risks / Open Questions

- **Starting balance:** new players have 0 points and can't buy anything until
  they win a round. Acceptable (it's the loop) — but consider seeding a small
  starting balance (e.g., 2) so the shop isn't fully locked on first visit;
  defaulting to **0** unless playtest says otherwise.
- **Pixel font + Chinese:** Press Start 2P can't render Han; Chinese must use the
  bold CJK font. Mixed-font rows need care so the baseline/sizes read well.
- **Cross-screen refresh:** points earned in the arena must show on the shop;
  handled by re-rendering on `onExit` + after each award.
- **Float prices gone:** all prices are integers now, so the old `.toFixed(2)`
  formatting is removed; costs render as plain integers with a ★.
