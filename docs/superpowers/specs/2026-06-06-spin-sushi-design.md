# Spin Sushi — Design Spec

**Date:** 2026-06-06
**Status:** Approved (design phase)

## Concept

A sushi restaurant website that is secretly a Beyblade X arena. The site presents
as a calm-ish, manga-styled sushi shop. A hidden red button violently transforms
the page into a glowing neon battle stadium with a playable Beyblade mini-game.

- **Shop aesthetic:** Beyblade X "official" look — ink black, racing red, electric blue.
- **Arena aesthetic:** neon arena — dark with glowing cyan/magenta.
- The transformation from shop → arena is a deliberate visual spectacle.

## Tech constraints

- **Plain HTML / CSS / JS only.** No framework, no build step, no bundler.
- Single `index.html`; restaurant is scroll sections; arena is a full-screen overlay.
- Runnable by opening `index.html` (or via a trivial static server).
- Cart state persisted in `localStorage`.

## Working name

**Spin Sushi** (placeholder, easily changed in one place).

## Site structure (the sushi shop)

### Hero
- Manga-panel hero: restaurant name in italic chrome display type, tagline, speed lines.
- Primary CTA: "View Menu" (scrolls to menu).
- **Hidden red button:** disguised as a glowing red "⚠ DO NOT PRESS" cap tucked in a
  corner. Subtle pulse on hover so it is discoverable but not obvious. Pressing it
  triggers the arena transformation.

### Menu showcase
- Sushi items rendered as manga panels: name, illustration/photo, price, "Add" button.
- Data-driven from a JS array (`js/data.js`) so items are easy to edit.

### About / story
- Short lore section that hints the restaurant is secretly an arena.

### Cart drawer
- Slide-in panel: line items, quantity steppers (+/-), remove, subtotal/total.
- Fake "Checkout" that shows an order-confirmation state (no backend).
- State held in memory and mirrored to `localStorage` (survives refresh).

## The arena (red button)

### Transformation sequence
On red-button press:
1. Screen shake + lights dim.
2. Sushi sections slide/fade away.
3. Neon stadium rises with an FX burst and a "BATTLE!" title card.
4. Game UI appears.

### Gameplay — charge-launch only
- Player holds to fill a **power meter** and sets a **launch angle**, then releases.
- Player bey and an **AI opponent** bey drop into a circular stadium (HTML `<canvas>`).
- After launch, physics plays out hands-off (no steering).

### Physics model
- Beys move in a circular bowl with friction and wall bounces.
- Bey-vs-bey collisions transfer momentum and drain **spin (stamina)**.
- Spin depletes gradually over time; collisions drain it faster.
- Launch quality (power) sets initial velocity and starting spin.

### Win/lose conditions
- **Win:** opponent's spin reaches 0 (stops) OR opponent is knocked out of the ring.
- **Lose:** the same happens to the player's bey.
- Draw handling: if both stop within the same frame window, higher remaining spin wins;
  exact tie → rematch prompt.

### Manga FX
- Impact bursts on collision, "BURST!" text on a knockout, screen shake.

### Controls
- **Rematch** button (re-run a battle).
- **Exit** button (snap back to the restaurant, restore shop view).

## File layout

```
index.html
css/
  theme.css     # shop styling (style A: black / red / blue)
  arena.css     # arena styling (style C: neon cyan / magenta)
js/
  data.js       # menu item data
  cart.js       # cart state + math (add/remove/qty/totals, localStorage)
  arena.js      # game: physics, AI, render loop, win logic
  main.js       # page wiring: nav, menu render, red button, transitions
assets/         # images, icons
```

Each JS module has one responsibility. Cart math, game logic, and DOM wiring stay
separate so each can be reasoned about and tested independently.

## Visual identity

### Shop (style A)
- Colors: ink black `#0b0c10`, racing red `#e3001b`, electric blue `#00b3ff`, paper white.
- Type: bold italic uppercase display (e.g. Anton / Archivo Black) + clean body
  (e.g. Inter / Manrope). Katakana accents.
- Motifs: diagonal skews, halftone dots, speed lines.

### Arena (style C)
- Dark background with neon cyan `#2bf2ff` and magenta `#ff2bd6` glow.

## Testing

No-build static site, so verification is primarily manual. In addition:
- Small unit checks for **pure functions** that carry real logic:
  - cart totals (subtotal, quantity changes, removal),
  - core physics helpers (collision response, spin decay).
- These are kept free of DOM dependencies so they can be exercised in isolation.

## Out of scope (YAGNI)

- No real backend, payments, or accounts.
- No multiplayer / second-player controls (single player vs AI).
- No bey selection or stat variety (single charge-launch model).
- No steering or special-move meter.
