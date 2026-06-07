# Bilingual Learning UI (Chinese + Pinyin + English) — Design

**Date:** 2026-06-07
**Status:** Approved, ready for implementation plan

## Summary

Make the entire app — front page, arena, and builder — a Chinese-learning UI.
Every UI string renders with **ruby pinyin over the characters** (pinyin small,
above each glyph), the **Chinese primary**, a **quiet always-visible English
gloss**, and **tap-to-hear audio** (browser speech synthesis). All strings live
in one central table; a small render layer fills both static HTML and dynamic
JS-set text.

This optimizes for *learning* (character↔sound mapping, target-language-first,
audio for tones), per the user's goal — superseding the earlier inline sketch.

## Goals

- One source of truth for every UI string as `{ zh, py[], en }`.
- Ruby rendering that aligns one pinyin syllable per Chinese character and
  passes punctuation / Latin (e.g. "Beyblade X") through untouched.
- Tap any Chinese term to hear it (zh-CN), no dependencies or assets.
- Keep the pure rendering core unit-tested; DOM/audio playtested.

## Non-Goals

- No language toggle / locale switching — both languages are always shown.
- No active-recall hiding (English is always visible, per the chosen option).
- No server, no i18n framework, no build step — vanilla ES modules only.
- The chef **typewriter effect is dropped** (ruby is HTML, can't type
  char-by-char) in favor of a fade-in; this is an accepted tradeoff.

## Decisions (from brainstorming)

- **Format:** ruby (`<ruby>字<rt>zì</rt></ruby>`), Chinese primary, English a
  muted gloss, all visible at once.
- **Pinyin scope:** everywhere, including paragraphs (per-character ruby).
- **Order:** Chinese first; English keeps its existing wording as the gloss.
- **Audio:** yes — tap-to-speak via `window.speechSynthesis`, `lang="zh-CN"`.
- **Architecture:** central strings table + `data-i18n` apply pass for static
  HTML + `biHtml(key)`/`t(key)` for dynamic JS.

## Architecture

### `js/i18n.js` (new)

The single strings table and the render/audio layer.

- `STRINGS` — object keyed by dotted ids (e.g. `nav.menu`, `arena.callout.clash`).
  Each entry: `{ zh: string, py: string[], en: string }`, where `py` has **one
  syllable per Chinese (Han) character in `zh`, in order** (punctuation/Latin in
  `zh` get no `py` entry).

- `escapeHtml(s)` — pure helper, escapes `& < > "`.

- `rubyHtml(zh, py)` → string — **pure, unit-tested**. Walks `zh` char by char,
  keeping a `py` index. For each character: if it is a CJK ideograph (Unicode
  range U+4E00–U+9FFF), emit `<ruby>{escaped char}<rt>{escaped py[i++]}</rt></ruby>`;
  otherwise emit the escaped character as-is (so commas, spaces, "Beyblade X",
  digits pass through). If `py` runs short, characters render without `<rt>`
  (graceful).

- `biHtmlEntry(entry)` → string — composes a renderable group from a
  `{ zh, py, en }` object (used directly for non-table strings like menu items):
  `<span class="bi" data-speak="{zh}"><span class="bi-zh">{rubyHtml}</span> <span class="en-gloss">{escaped en}</span></span>`.

- `biHtml(key)` → string — `biHtmlEntry(STRINGS[key])`. Unknown key → a visible
  plain-span fallback (non-fatal).

- `t(key)` → `{ zh, py, en }` — raw entry accessor for callers that build their
  own DOM.

- `applyI18n(root = document)` — for every `[data-i18n]` under `root`, set
  `el.innerHTML = biHtml(el.dataset.i18n)`.

- `speak(zh)` — speaks `zh` via `window.speechSynthesis`: cancel any current
  utterance, create `SpeechSynthesisUtterance(zh)`, set `lang = "zh-CN"` and a
  `zh-*` voice if one is available, then `speak`. No-op if the API is missing.

- `initSpeech()` — installs ONE delegated `click` listener on `document` that, on
  a click whose `target.closest("[data-speak]")` matches, calls
  `speak(el.dataset.speak)`. Called once at startup.

### `css/i18n.css` (new)

- `ruby { ... }` / `rt { font-size: .6em; opacity: .8; ... }` — pinyin small,
  above, slightly muted.
- `.bi` is an inline-block group; `.bi-zh` is the primary (inherits the element's
  size); `.en-gloss { display: block; font-size: .7em; opacity: .6; ... }` — the
  quiet gloss below.
- `[data-speak] { cursor: pointer; }` plus a subtle speaker cue on hover.
- Wrapping rules so the taller, multi-line content fits buttons, the arena
  callouts/banners (which may wrap to several lines), and the HUD.

Linked from `index.html` after `arena.css`/`builder.css`.

## Static front page (`index.html`, `js/main.js`)

- Text elements get `data-i18n="key"`. `applyI18n(document)` runs at startup
  (in `init()`), then `initSpeech()`.
- Markup-containing elements handled explicitly:
  - **Brand wordmark**: `data-i18n="brand"` → ruby `旋转寿司` + gloss "Spin Sushi".
  - **Cart toggle**: keeps the coin icon and `#cart-count` badge; the label text
    is a `data-i18n` span between them.
  - **Story `<em>` emphasis**: folded into the English gloss wording (the `<em>`
    is dropped from the structured string; emphasis via the gloss styling).
- The Story paragraphs and the chef dialogue are full ruby blocks (per-character
  pinyin), each tappable for audio.

## Dynamic strings

- **`js/data.js`** — each MENU item carries structured fields:
  `{ id, price, name: {zh,py[],en}, desc: {zh,py[],en}, kana: {zh,py[],en} }`.
  The menu card renders each field via `biHtmlEntry(...)`. The structured `name`
  object flows through `cart.js` unchanged (it spreads/copies item fields), and
  `renderCart` composes the cart line name via `biHtmlEntry(line.name)` — so
  `cart.js` itself needs no changes.
- **`js/main.js`** — the menu card template, the "Buy" button, cart "empty"
  message, checkout confirm, and the dialogue all use `biHtml`/`t`. Dialogue:
  replace the typewriter with a fade-in of the full ruby line; advance on click;
  each line tappable for audio.
- **`js/arena.js`** — every runtime string via `biHtml`/`t`: banners (`BATTLE!`,
  `RING OUT!`, `SPIN OUT!`, `DRAW`, `REPLAY ROUND`, `MATCH WON!`, `MATCH LOST`,
  `ROUND WON`, `ROUND LOST`), callouts (`CLASH!`, `SMASH!`, `MEGA HIT!`,
  `SPECIAL!`, `RIVAL SPECIAL!`, `XTREME DASH!`), the rules blurb, the rival
  readout, button labels (`HOLD TO CHARGE`, `SPECIAL`, `Next Round`, `Rematch`,
  `Replay Round`, `New Match`, `Exit to Garage`), HUD labels (YOU / RIVAL), and
  the Spin toggle (Right / Left). `showBanner`/`showCallout` set `innerHTML`.
- **`js/builder.js` + builder markup** — title, field labels (Blade/Ratchet/Bit),
  the stat bar labels (ATK/DEF/STA/X/BR), TO BATTLE, and the part/blade names
  (reuse the parts' structured names) via `biHtml`.

## Testing Strategy

- **Pure (unit-tested)** in `tests/i18n.test.js`:
  - `rubyHtml`: CJK characters wrapped with the matching `py` syllable in order;
    punctuation and Latin passed through; HTML-escaping; short-`py` graceful
    fallback (no `<rt>`); empty input.
  - `biHtml`: composes `.bi`/`.bi-zh`/`.en-gloss` with `data-speak` = `zh`;
    unknown key returns a visible fallback.
- **DOM / audio / canvas** (`applyI18n`, `speak`, dialogue fade, arena/builder
  rendering, layout density) — playtested per the existing convention.

## Files

- **New:** `js/i18n.js`, `css/i18n.css`, `tests/i18n.test.js`.
- **Modified:** `index.html` (data-i18n + css link), `js/main.js` (apply pass,
  menu/dialogue/cart render), `js/data.js` (structured fields), `js/arena.js`
  (all strings), `js/builder.js` (all strings), and CSS for wrapping.

## Phasing (for the plan)

1. i18n core (`rubyHtml`, `biHtml`, `t`, `applyI18n`, `speak`, `initSpeech`) +
   `css/i18n.css` + `tests/i18n.test.js`.
2. Front page (HTML `data-i18n`, `main.js` apply + menu/dialogue/cart,
   `data.js` structured items).
3. Arena strings.
4. Builder strings.
5. Final tune (layout density, callout wrapping, audio voice selection).

## Risks / Open Questions

- **Density:** three layers per term makes the page much taller and flashing
  arena callouts long (`终极冲刺 / XTREME DASH!`). Callouts/banners wrap and
  shrink; tune in playtest. If a callout is unreadable at speed, that specific
  string can drop pinyin.
- **Pinyin authoring:** every Han character needs a correct tone-marked syllable;
  paragraphs are sizable. Authored during implementation; `py` length must equal
  the Han-character count (the render tolerates mismatch but it should be right).
- **Typewriter removed:** accepted; dialogue fades in instead.
- **Speech availability/voices:** `speechSynthesis` and zh-CN voices vary by
  browser/OS; `speak` degrades to no-op or default voice if absent. Requires a
  user gesture (the tap supplies it).
- **`cart.js` untouched:** items carry a precomposed display name so the tested
  cart module needs no changes.
