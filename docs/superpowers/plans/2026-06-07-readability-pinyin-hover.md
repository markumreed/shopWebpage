# Readability + Pinyin-on-Hover/Tap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide pinyin by default and reveal it on hover (desktop) or tap (which also speaks), leaving Chinese + English as two readable layers, and tune type/spacing so it reads well on web and mobile.

**Architecture:** Pure CSS drives the reveal (`<rt>`/`.bi-py` transparent/collapsed by default; shown on `.bi:hover` or a `.bi.show-py` class) and the readability/responsive tuning. The only JS change is one line in `initSpeech` to toggle `.show-py` on tap. The render core and its tests are untouched.

**Tech Stack:** Vanilla CSS (`css/i18n.css`, `css/theme.css`, `css/arena.css`), one-line JS in `js/i18n.js`.

Current test baseline: **94 passing** (unchanged by this feature).

---

## File Structure

- `css/i18n.css` — **modify**: reveal rules + readability + a mobile `@media` block.
- `js/i18n.js` — **modify**: `initSpeech` toggles `.show-py` on tap (one line).
- `css/theme.css` — **modify**: mobile menu/type touch-ups (existing `@media` blocks).
- `css/arena.css` — **modify**: mobile callout/HUD sizing.
- `index.html` — **modify**: a touch-only "tap for pinyin" hint near the menu.

---

## Task 1: Pinyin reveal + readability

**Files:**
- Modify: `css/i18n.css`, `js/i18n.js`

- [ ] **Step 1: `initSpeech` toggles `.show-py` on tap**

In `js/i18n.js`, replace the `initSpeech` body:
```javascript
export function initSpeech(root = document) {
  root.addEventListener("click", (e) => {
    const el = e.target.closest("[data-speak]");
    if (el) speak(el.dataset.speak);
  });
}
```
with:
```javascript
export function initSpeech(root = document) {
  root.addEventListener("click", (e) => {
    const el = e.target.closest("[data-speak]");
    if (el) { speak(el.dataset.speak); el.classList.toggle("show-py"); }
  });
}
```

- [ ] **Step 2: Hide pinyin by default + reveal on hover/tap (`css/i18n.css`)**

Replace the `ruby > rt` rule:
```css
ruby > rt { font-size: .55em; opacity: .75; letter-spacing: 0; font-weight: 600; }
```
with (transparent by default — space stays reserved, so no layout jump — and a smooth fade in on reveal):
```css
ruby > rt { font-size: .66em; opacity: 0; letter-spacing: 0; font-weight: 600; transition: opacity .12s ease; }
```

Replace the `.bi-py` rule:
```css
.bi-py { display: block; font-size: .72em; opacity: .7; font-style: italic; margin-top: 1px; }
```
with (the menu phrase line collapses by default and expands on reveal — animated, no blank gap):
```css
.bi-py { display: block; font-size: .8em; opacity: 0; font-style: italic; max-height: 0; overflow: hidden;
  transition: max-height .15s ease, opacity .15s ease; }
```

Add the reveal rules (after the `.bi-py` rule):
```css
/* pinyin appears on hover (desktop) or when the term carries .show-py (tap) */
.bi:hover rt, .bi.show-py rt { opacity: .92; }
.bi:hover .bi-py, .bi.show-py .bi-py { opacity: .8; max-height: 2.2em; }
```

- [ ] **Step 3: Readability — Chinese cue + brighter gloss (`css/i18n.css`)**

Replace the `.bi-zh` rule:
```css
.bi-zh { line-height: 1.9; }
```
with (a subtle dotted underline signals "hover/tap me" for pinyin + sound):
```css
.bi-zh { line-height: 1.9; text-decoration: underline dotted; text-underline-offset: 3px;
  text-decoration-color: rgba(127, 127, 127, .4); text-decoration-thickness: 1px; }
```

Replace the `.en-gloss` rule:
```css
.en-gloss { display: block; font-size: .62em; opacity: .6; font-weight: 400;
  text-transform: none; letter-spacing: .3px; margin-top: 2px; }
```
with (now an always-visible primary layer — larger, more legible):
```css
.en-gloss { display: block; font-size: .74em; opacity: .82; font-weight: 400;
  text-transform: none; letter-spacing: .2px; margin-top: 3px; }
```

- [ ] **Step 4: Verify**

Run: `node --check js/i18n.js` → exit 0.
Run: `node --test` → 94 pass, 0 fail (render core unchanged).
Playtest (desktop): the Chinese shows with a faint dotted underline and the English gloss below; **no** pinyin until you hover a term, when its pinyin fades in (ruby above each char; menu phrase line expands). Clicking still speaks. Tapping toggles the pinyin on/off and speaks.

- [ ] **Step 5: Commit**

```bash
git add css/i18n.css js/i18n.js
git commit -m "feat: pinyin on hover/tap; brighter gloss + dotted cue for readability"
```

---

## Task 2: Responsive (web + mobile) + touch hint

**Files:**
- Modify: `css/i18n.css`, `css/theme.css`, `css/arena.css`, `index.html`

- [ ] **Step 1: Mobile bilingual sizing (`css/i18n.css`)**

Append to `css/i18n.css`:
```css
/* mobile: keep the two-layer text legible and finger-friendly */
@media (max-width: 640px) {
  .en-gloss { font-size: .8em; opacity: .85; }
  ruby > rt { font-size: .7em; }
  .bi { line-height: 1.6; }
  /* on touch, reveal pinyin only via tap (no hover) — keep the dotted cue */
}
/* touch devices have no hover; the dotted cue + tap drives reveal */
@media (hover: none) {
  .bi:hover rt { opacity: 0; }            /* don't reveal on phantom hover */
  .bi:hover .bi-py { opacity: 0; max-height: 0; }
  .bi.show-py rt { opacity: .92; }
  .bi.show-py .bi-py { opacity: .8; max-height: 2.2em; }
}
```

- [ ] **Step 2: Mobile menu + type touch-ups (`css/theme.css`)**

In `css/theme.css`, inside the existing `@media (max-width: 640px) { ... }` block (currently `.nav a { display:none } .dialogue { ... }`), add these rules before its closing `}`:
```css
  .menu-grid { grid-template-columns: 1fr; gap: 14px; }
  .menu-card { padding: 14px; }
  .menu-card h3 { font-size: 18px; }
  .menu-cat { font-size: 17px; margin-top: 16px; }
  .hero-title { font-size: clamp(40px, 16vw, 72px); }
```

- [ ] **Step 3: Mobile arena sizing (`css/arena.css`)**

Append to `css/arena.css`:
```css
/* mobile: keep callouts/banners/controls inside the frame */
@media (max-width: 640px) {
  .arena-banner { font-size: clamp(32px, 11vw, 72px); }
  .arena-callout { font-size: clamp(22px, 7vw, 48px); }
  .arena-controls { gap: 10px; }
  .arena-title { font-size: 16px; }
  .rival-setup { font-size: 11px; }
}
```

- [ ] **Step 4: Touch-only "tap for pinyin" hint (`index.html` + `css/i18n.css`)**

In `index.html`, inside the `<section id="menu" class="menu">`, immediately AFTER the `<p class="menu-sub" ...></p>` line, add:
```html
      <p class="pinyin-hint" aria-hidden="true">👆 tap any 字 for pinyin + sound</p>
```
Append to `css/i18n.css`:
```css
/* hint shown only on touch devices, auto-fades after a few seconds */
.pinyin-hint { display: none; margin: 4px 0 0; font-size: 12px; letter-spacing: 1px;
  color: #2bf2ff; text-align: center; }
@media (hover: none) {
  .pinyin-hint { display: block; animation: hint-fade .8s ease 6s forwards; }
}
@keyframes hint-fade { to { opacity: 0; visibility: hidden; } }
```

- [ ] **Step 5: Verify**

Run: `node --check js/i18n.js` (no JS change here, sanity) and `node --test` → 94 pass, 0 fail.
Playtest at a narrow viewport (~375px, or device emulation): the menu is a single comfortable column with finger-friendly cards; hero/menu/story type is legible; the arena callouts/HUD fit the frame; the "tap any 字" hint shows on touch and fades; tapping a term reveals its pinyin and speaks (no hover dependency).

- [ ] **Step 6: Commit**

```bash
git add css/i18n.css css/theme.css css/arena.css index.html
git commit -m "feat: responsive readability for web/mobile + touch pinyin hint"
```

---

## Task 3: Final verification

- [ ] **Step 1: Tests + parse**

Run: `node --test` → `# pass 94`, `# fail 0`.
Run: `node --check js/i18n.js && node --check js/main.js && node --check js/arena.js` → exit 0.

- [ ] **Step 2: Reveal-rule sanity (grep)**

Run: `grep -n "show-py\|:hover rt\|hover: none" css/i18n.css js/i18n.js`
Expected: `js/i18n.js` toggles `.show-py`; `css/i18n.css` has the `.bi:hover rt` / `.bi.show-py rt` reveal rules and the `@media (hover: none)` overrides.

- [ ] **Step 3: Playtest the whole experience**

Desktop: front page, menu, arena, builder — Chinese + English read cleanly with no pinyin clutter; hovering a term fades its pinyin in; clicking speaks. Narrow viewport: single-column menu, legible type, arena fits, touch hint + tap-to-reveal/speak. Confirm nothing reflows/jumps when pinyin reveals (ruby space is reserved; the menu phrase animates).

- [ ] **Step 4: Tune (optional, after playtest)**

If the reserved ruby space feels too airy, lower `.bi-zh` line-height; if the dotted underline is too strong/weak, adjust `text-decoration-color`; if a breakpoint needs work, tweak the `@media` values. Re-run `node --test`; commit separately.

---

## Notes for the implementer

- **No render-core or test change.** `rubyHtml`/`biHtmlEntry`/`phraseHtml`/`biHtml` and `STRINGS`/`data.js` are untouched; the 94 tests stay green. This feature is CSS + one JS line, verified by playtest.
- **No layout jump on reveal:** ruby `<rt>` uses `opacity` (space stays reserved); only the menu's block `.bi-py` collapses/expands (animated, contained to its card).
- **Touch vs hover:** `@media (hover: none)` neutralizes phantom `:hover` on touch so pinyin reveals only via tap (`.show-py`), which also speaks.
- **The `.show-py` toggle is per-term** — tapping one term doesn't affect others.
- **Existing `@media` blocks:** `css/theme.css` already has `max-width: 760px` and `max-width: 640px` blocks — add the menu/type rules inside the existing `640px` block, don't create a duplicate.
