# Spinning Dragon Sushi Menu — Design

**Date:** 2026-06-07
**Status:** Approved, ready for implementation plan

## Summary

Replace the 8-item placeholder menu with the 21-item **Spinning Dragon Sushi**
menu supplied in `~/Downloads/spinning_dragon_sushi_web_assets/`. The data is
already trilingual (Chinese / pinyin / English) with categories, prices, and one
image per item. The menu renders **grouped by category** with each card showing
its **optimized image**, a trilingual name + description (Chinese primary,
phrase pinyin line, muted English gloss, tap-to-hear audio), and a ◎-coin price.

## Goals

- Use the provided menu data and images, integrated with the existing bilingual
  learning UI (tap-to-hear, gloss styling).
- Keep the page fast: optimize the 37MB of PNGs to ~1MB of WebP.
- Reuse the supplied pinyin verbatim (no per-character authoring).

## Non-Goals

- No per-character ruby for the menu items — they use a **phrase-pinyin line**
  (user choice). The rest of the site keeps its ruby rendering.
- No currency change — prices stay ◎ coins (the USD value shown as a coin
  amount).
- No change to `cart.js` or its tests.

## Decisions (from brainstorming)

- **Images:** optimize → resize to ~600px + WebP into `assets/menu/<id>.webp`.
- **Pinyin:** phrase line (verbatim from the data), not per-character ruby.
- **Layout:** replace the placeholder menu; group the 21 items under their 5
  category headers (Signature Rolls, Classic Sushi, Hot Snacks, Sweet Bites,
  Drinks), each card showing its image.
- **Currency:** keep ◎ coins; support decimals (`◎2.80`, total `◎14.30`).
- **Cards:** show the trilingual description (tappable) in addition to the name.
- The 8 old placeholder items are fully replaced (nothing kept).

## Source data

`spinning_dragon_sushi_menu.json` (21 objects) fields per item:
`id, category_zh/pinyin/en, name_zh/pinyin/en, description_zh/pinyin/en,
price_usd, image_file, image_alt_en`. Categories (in order): Signature Rolls (4),
Classic Sushi (6), Hot Snacks (4), Sweet Bites (3), Drinks (4). Prices $1.00–$2.90.
IDs are unique, underscore-form (e.g. `watermelon_extreme_roll`).

## Images (`assets/menu/`)

A one-time optimization step converts each `images/<id>.png` (~1.8MB) to
`assets/menu/<id>.webp` resized to ~600px on the long edge (~40–80KB each).
Tooling preference, picked by what's installed:
1. `cwebp -resize 600 0 -q 80 in.png -o out.webp` (best), or
2. `sips --resampleWidth 600 -s format webp in.png --out out.webp` (newer macOS),
3. fallback: `sips --resampleWidth 600 -s format jpeg` → `<id>.jpg` (and the data
   uses `.jpg` paths in that case).
The card `<img>` carries `onerror` to hide a missing image (so a failed asset
never shows a broken icon). Total committed assets ≈ 1MB.

## Menu data (`js/data.js`, replaced)

```
export const MENU = [
  { id, price /* number */, image /* "assets/menu/<id>.webp" */,
    category: { zh, py /* phrase string */, en },
    name:     { zh, py, en },
    desc:     { zh, py, en } },
  // ... 21 items, in the source order (already category-grouped)
];
```
`py` holds the supplied `*_pinyin` strings verbatim. `price` is `Number(price_usd)`.
Categories repeat across items in a group (used to detect group boundaries while
rendering, preserving first-seen order).

## `phraseHtml` (`js/i18n.js`, pure + tested)

A sibling of `biHtmlEntry` for the phrase style (pinyin on its own line, not ruby):

```
phraseHtml({ zh, py, en }) →
  <span class="bi" data-speak="{esc zh}">
    <span class="bi-zh">{esc zh}</span>
    <span class="bi-py">{esc py}</span>
    <span class="en-gloss">{esc en}</span>
  </span>
```
All three fields HTML-escaped. Falsy entry → `<span class="bi"></span>`. The
`data-speak="{zh}"` reuses the existing delegated speech listener (tap to hear).
Unit-tested: composition (the three spans + `data-speak`), escaping, falsy guard.

`css/i18n.css` gains a `.bi-py` rule (small, slightly muted, its own line, like
the pinyin tier of the ruby style).

## Menu render + layout (`js/main.js`, `css/theme.css`)

`renderMenu` walks `MENU` in order, tracking the current `category.en`; when it
changes, it emits a **category header** (`phraseHtml(item.category)` inside an
`<h3 class="menu-cat">`). Each item is a card:

```
<article class="menu-card">
  <img class="mc-img" src="{image}" alt="{name.en}" loading="lazy" onerror hide>
  <h3>{phraseHtml(name)}</h3>
  <p class="mc-desc">{phraseHtml(desc)}</p>
  <div class="mc-foot">
    <span class="mc-price">◎{price.toFixed(2)}</span>
    <button class="mc-add" data-id="{id}">{biHtml("menu.buy")}</button>
  </div>
</article>
```
Everything renders into the existing `#menu-grid` (a CSS grid): for each
category, one `<h3 class="menu-cat">` (styled `grid-column: 1 / -1` so it spans a
full row) followed by that category's cards. No extra wrapper — headers and cards
are siblings in the grid. `css/theme.css` gets `.menu-cat` (full-row header) and
`.mc-img` (`width:100%; aspect-ratio:1; object-fit:cover; border-radius`) rules;
existing `.menu-card`/`.mc-*` styles are reused and adjusted for the image.

The add-to-cart handler is unchanged (`data-id` → `MENU.find` → `addItem`).

## Cart + currency (`js/main.js`)

- Cart line name renders via `phraseHtml(line.name)` (was `biHtmlEntry`); the
  structured `{zh,py,en}` object flows through `cart.js` unchanged.
- Card price and cart line/total display `◎` + `value.toFixed(2)`. `renderCart`
  formats `cartSubtotal(cart)` with `.toFixed(2)`; the per-line price likewise.
- `cart.js` and `tests/cart.test.js` are untouched (their integer fixtures still
  pass; `cartSubtotal` already sums `price*qty` numerically).

## Files

- **New:** `assets/menu/*.webp` (21), `assets/menu/SOURCE.md` (note: from the
  provided Spinning Dragon Sushi asset pack).
- **Modified:** `js/data.js` (21 items), `js/i18n.js` (`phraseHtml` + `.bi-py`
  usage), `tests/i18n.test.js` (`phraseHtml` tests), `js/main.js` (grouped
  render + ◎ formatting + cart phraseHtml), `css/i18n.css` (`.bi-py`),
  `css/theme.css` (menu card/category/image styles).

## Testing Strategy

- **Pure (unit-tested):** `phraseHtml` — the three spans + `data-speak`, escaping,
  falsy guard. Existing `rubyHtml`/`biHtml` tests stay green.
- **DOM / images / audio (playtested):** category grouping, image loading +
  onerror fallback, ◎ decimal formatting, cart rendering, tap-to-hear on menu
  Chinese.

## Risks / Open Questions

- **Image tooling:** if neither `cwebp` nor a WebP-capable `sips` is available,
  the step falls back to resized JPEG and the data uses `.jpg` paths. Either way
  the committed assets stay ~1MB.
- **Decimal coins:** floating-point sums (e.g. `2.8+2.6`) are formatted with
  `.toFixed(2)` at display; the underlying `cartSubtotal` math is unchanged.
- **Phrase vs ruby inconsistency:** menu items show phrase pinyin while the rest
  of the site uses ruby — an accepted, deliberate choice. The `.bi`/`.en-gloss`/
  `data-speak` styling and audio stay consistent.
- **Card height:** image + trilingual name + trilingual description is tall;
  tune card sizing/clamping in playtest if needed.
