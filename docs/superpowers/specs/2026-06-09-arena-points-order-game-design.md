# Arena-Points Ordering Game — Design

**Date:** 2026-06-09
**Status:** Approved, ready for implementation plan
**Supersedes:** `2026-06-08-8bit-points-shop-design.md` (same core loop; this version
keeps an order tray instead of instant-buy, starts the player at 0, and adds an
explicit "Battle in the Arena" call-to-action.)

## Summary

The front page becomes an interactive game. You **order food** from the menu by
spending **★ points**, and you **earn points by winning in the beyblade arena**.
A brand-new player starts with **0 points**, so the only way to order anything is
to battle first. Menu items cost whole points (1–3). You build an **order tray**
of affordable items, then **Place Order** to spend the points at once. When you
can't afford an item it locks (`🔒 need N`), and a prominent **⚔ Battle in the
Arena** button sends you into a fight to earn points.

## The loop

```
SHOP (front page)
  HUD:  ★ POINTS: 0     [⚔ Battle to earn]
  Menu: each card shows ★cost + [Add]
  Tray: items, total ★, [Place Order]
        │  no points
        ▼
  builder (pick beyblade) → ARENA → exit
        ▲                              │
        └────── points updated ────────┘
   win round +1 · win match +3
```

## Goals

- A real gameplay loop: battle → earn ★ points → order sushi.
- Keep a familiar "build an order, then place it" tray flow, gated on points.
- Always give the player a clear path to the arena when they're short on points.

## Non-Goals

- No persistent inventory of "owned" food — Place Order spends points and confirms;
  it does not track what you've eaten (YAGNI).
- No 8-bit restyle of the arena/builder this pass (front page only).
- No change to the bilingual render core or the pinyin-on-hover/tap behavior.

## Decisions (from brainstorming)

- **Order model:** build a tray, then **Place Order** spends the total at once
  (the existing cart is repurposed as the tray; it is **not** deleted).
- **Starting balance:** **0** — the shop is fully locked until the player wins a
  round. This is the core "battle for points" hook.
- **Locked CTA:** unaffordable cards dim and show `🔒 need N`; a prominent
  **⚔ Battle in the Arena** button (HUD + tray locked/empty state) jumps straight
  to the fight.
- **Affordability invariant:** a card's **Add** is enabled only when the remaining
  budget (`balance − trayTotal`) covers the item. The tray is therefore always
  payable and **Place Order** never fails.
- **Prices:** whole numbers 1–3 by tier (below).

## Points economy

### `js/points.js` (new, pure + unit-tested)
- `POINTS_KEY = "arena.points"`.
- `loadPoints()` → integer balance (0 if unset/corrupt; tolerant of a missing or
  throwing `localStorage`).
- `savePoints(n)` → persists (no-op if `localStorage` unavailable).
- `pointsForRound(wonRound, wonMatch)` → `(wonRound ? 1 : 0) + (wonMatch ? 3 : 0)`.
- `canAfford(balance, cost)` → `balance >= cost`.
- `spend(balance, cost)` → `canAfford(balance, cost) ? balance - cost : balance`
  (never negative; no-op when short).

### Flow
- `main.js` owns the live `points` balance (`loadPoints()` at startup), renders the
  topbar HUD and the menu's affordability, and owns spending.
- `mountArena` gains an `awardPoints(n)` option. In `finishRound`, after
  `recordRound`, the arena computes
  `pointsForRound(outcome === "player", match.matchOver && match.matchWinner === "player")`
  and, if `> 0`, calls `awardPoints(that)`.
- `main.js`'s `awardPoints` callback adds the points, `savePoints`, and re-renders
  the HUD + menu — so points earned mid-battle are reflected the moment the player
  returns to the shop.
- The existing 🔥 streak HUD inside the arena is unchanged.

## Order tray (`js/cart.js` reused, `js/main.js`, `index.html`)

`cart.js` stays as-is (pure add/setQty/subtotal + localStorage). Its `subtotal`
is now interpreted as a **point cost**. The drawer is relabeled **"Order"**.

- **Menu card** renders the trilingual name/desc (existing `phraseHtml`), the
  image, and a footer with **★ cost** and an **Add** control.
  - Add enabled when `balance − trayTotal >= price`.
  - Otherwise the card gets `is-locked` (dimmed) and Add shows `🔒 need N`
    (where `N = price − (balance − trayTotal)`), disabled.
- **Tray drawer:** the order lines (qty −/+), the **total ★**, and **Place Order**.
  - `Place Order`: `points = spend(points, trayTotal)`, `savePoints`, clear tray,
    flash a confirm (`已下单 yǐ xiàdān · Order up! 🥢`), re-render HUD + menu.
  - Empty/all-locked state shows the **⚔ Battle in the Arena** button.
- Adding/placing/qty changes re-evaluate every card's afford state.

## Topbar HUD + battle CTA (`index.html`, `css/theme.css`)

The topbar gains a pixel **★ POINTS <span id="points-count">0</span>** readout and
a **⚔ Battle** button (`builder.open()` — same entry as the hidden red button).
The existing `#cart-toggle` is relabeled the **Order** toggle (its ◎ badge now
shows the tray item count) so the player can still open their order. Nav keeps
Wares/Story links.

## 8-bit styling + readability (`css/theme.css`, maybe `css/i18n.css`)

- **Pixel font** (Press Start 2P, already loaded) for UI chrome: the points HUD,
  `★ cost`, Add / locked / Place Order / Battle buttons, totals.
- **Chinese stays legible:** the loaded Zen Kaku Gothic New 900 at a larger size,
  strong dark-on-light contrast; each term's Chinese gets `white-space: nowrap` so
  names don't break mid-word. English gloss bumped to clearly legible.
- **Cards:** chunky pixel borders (thick solid + hard box-shadow), framed image,
  footer with `★ cost` + Add; `is-locked` dims and shows the lock.
- The pinyin-on-hover/tap mechanic and `phraseHtml` markup are unchanged.

## Prices → 1–3 (`js/data.js`)

Replace each item's `price` with a whole number by tier:
- **Drinks → 1** (green tea, lemon soda, mango juice, water).
- **Classic Sushi → 2**, **Hot Snacks → 2**.
- **Signature Rolls → 3**, **Sweet Bites → 3**.
All integers, all within 1–3. Structured `{zh,py,en}` name/desc/category and
`image` are unchanged; only `price` changes. Float formatting (`.toFixed(2)`) is
removed; costs render as plain integers with a ★.

## i18n keys (`js/i18n.js`)

Add bilingual keys (reusing the existing `{zh,py,en}` dictionary shape):
`hud.points`, `hud.battle` (⚔ Battle), `menu.add`, `menu.locked` (need), `order.title`,
`order.total`, `order.place` (Place Order), `order.empty`, `order.battle`
(Battle in the Arena), `order.confirm` (Order up!). Existing cart keys that no
longer apply are repurposed or removed.

## Files

- **New:** `js/points.js`, `tests/points.test.js`,
  `docs/superpowers/specs/2026-06-09-arena-points-order-game-design.md`.
- **Modified:** `js/data.js` (1–3 prices), `js/main.js` (points HUD + tray gated on
  points + battle CTA + `awardPoints` wiring), `js/arena.js` (award on round/match
  win), `js/i18n.js` (new keys), `index.html` (points HUD + battle button + Order
  drawer), `css/theme.css` (8-bit shop + readability).
- **Kept (not deleted):** `js/cart.js`, `tests/cart.test.js` — repurposed as the
  order tray.

## Testing Strategy

- **Pure (unit-tested)** `tests/points.test.js`: `pointsForRound` (round only,
  match bonus, both, neither), `canAfford` (boundary), `spend` (deducts, never
  below 0 / no-op when short), `loadPoints` default-on-missing.
- Existing render-core tests (`i18n`, `build`, `physics`, `match`, `cart`) stay green.
- **DOM / canvas (playtested):** earning points in the arena and seeing the HUD +
  menu update on exit; the afford/lock invariant (can't add past your budget);
  Place Order deducting and confirming; the ⚔ battle CTA reaching the arena; the
  8-bit look and no mid-word Chinese wrap on desktop + mobile.

## Risks / Open Questions

- **Cold start at 0:** new players can't order until they win a round. This is the
  intended hook; the ⚔ Battle CTA makes the next step obvious.
- **Pixel font + Chinese:** Press Start 2P can't render Han; Chinese must use the
  bold CJK font. Mixed-font rows need care so baselines/sizes read well.
- **Cross-screen refresh:** points earned in the arena must show on the shop;
  handled by re-rendering HUD + menu in `awardPoints` (and again when the builder
  closes back to the shop).
