# Readability + Pinyin-on-Hover/Tap — Design

**Date:** 2026-06-07
**Status:** Approved, ready for implementation plan

## Summary

The bilingual text is hard to read because three layers (Chinese, pinyin,
English) show at once, with tiny low-contrast pinyin. Change it so **pinyin is
hidden by default and revealed on hover (desktop) or tap (all devices, which
also speaks)**, leaving Chinese + English as two clean, readable layers. Tune
type sizes/contrast and add responsive rules so it reads well on web and mobile.

## Goals

- Declutter: default view is Chinese (primary) + English gloss; pinyin on demand.
- One interaction model: desktop hover reveals; tap reveals **and** speaks.
- Readable on phones and desktop (responsive type, finger-friendly targets).
- No change to the pure render core or its tests.

## Non-Goals

- No global "show all pinyin" toggle (reveal is per-word).
- No change to which strings are bilingual, the audio engine, or `data.js`.
- No layout-jump on reveal (space is reserved).

## Decisions (from brainstorming)

- **Mobile reveal:** tap a term reveals its pinyin **and** plays audio; tap again
  hides. Desktop: hover reveals, click speaks.
- **Default view:** Chinese + English visible; pinyin hidden until hover/tap.
- **Cue:** a subtle dotted underline under the Chinese signals "hover/tap me."
- **Per-word:** each term's pinyin reveals independently.

## Interaction

The render markup is unchanged: every term is a `.bi` (carrying `data-speak`)
containing `.bi-zh` (ruby Chinese, or plain Chinese in the menu's phrase style),
optionally a `.bi-py` phrase line (menu), and an always-visible `.en-gloss`.

- **Hidden by default:** ruby `<rt>` and `.bi-py` get `visibility: hidden`. The
  ruby annotation space stays reserved, so revealing causes no layout shift.
- **Reveal:** CSS shows pinyin when the `.bi` is hovered **or** carries a
  `.show-py` class:
  `.bi:hover rt, .bi.show-py rt, .bi:hover .bi-py, .bi.show-py .bi-py { visibility: visible }`.
- **Tap (touch + desktop):** the existing delegated `click` listener in
  `initSpeech` already calls `speak(el.dataset.speak)`; it additionally toggles
  `el.classList.toggle("show-py")` (where `el = e.target.closest("[data-speak]")`,
  i.e. the `.bi`). So a tap reveals pinyin and speaks; tapping again hides it.
  This is the **only** JS change.

## Readability (`css/i18n.css`)

- **`.bi-zh`** (Chinese, primary): comfortable line-height; a subtle cue —
  `text-decoration: underline dotted; text-underline-offset: 3px;
  text-decoration-color: rgba(currentColor, .35)` (or an equivalent muted dotted
  underline) — to signal interactivity. Hover keeps the existing glow.
- **`.en-gloss`** (now a primary, always-visible layer): raise from `.62em`/`.6`
  opacity to ~`.74em`/`.82` opacity with a touch more letter-spacing.
- **Pinyin** (shown only on reveal): `rt` from `.55em` to ~`.66em`, opacity ~`.9`;
  `.bi-py` likewise larger/clearer. Since it's hidden until asked for, it can be
  crisp without adding default clutter.

## Responsive (`css/i18n.css`, `css/theme.css`, `css/arena.css`)

- A `@media (max-width: 640px)` block: scale the hero title, menu, and story type
  to legible mobile sizes; the menu grid to one comfortable column; ensure cards,
  buttons, and `.bi` tap targets are finger-friendly (adequate padding/spacing).
- Arena: callouts/banners/HUD already wrap (`white-space: normal`); add mobile
  sizing so they don't overflow the canvas frame on small screens.
- Desktop (`min-width` as needed): slightly larger, airier type for comfort.
- A one-time, unobtrusive **"tap any 字 for pinyin + sound"** hint near the menu on
  touch devices (small, dismiss-on-first-tap or auto-fade), so the on-demand
  model is discoverable.

## Files

- **Modified:** `css/i18n.css` (reveal rules, readability, responsive),
  `js/i18n.js` (`initSpeech` toggles `.show-py`), `css/theme.css` +
  `css/arena.css` (mobile touch-ups).

## Testing Strategy

- The pure render core (`rubyHtml`/`biHtmlEntry`/`phraseHtml`/`biHtml`) is
  **unchanged**; all 94 existing tests stay green.
- This change is CSS + a one-line interaction → **playtest-verified**: on desktop
  (hover reveals pinyin, click speaks), on a narrow viewport (legible, single
  column, finger targets), and on touch (tap reveals + speaks, tap again hides).

## Risks / Open Questions

- **Reserved pinyin space:** `visibility: hidden` keeps a blank gap above Chinese
  (and a blank menu pinyin line). This avoids layout jump but adds whitespace; if
  it looks too airy in playtest, tighten line-height or collapse `.bi-py` with a
  height transition instead.
- **Discoverability:** if users miss that pinyin is on hover/tap, strengthen the
  dotted-underline cue or the one-time hint.
- **Hover + speak on desktop:** hovering reveals pinyin without sound; a click is
  still required to hear — intended (hover = read, click = listen).
