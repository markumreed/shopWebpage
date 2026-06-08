# Spinning Dragon Sushi Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 8-item placeholder menu with the supplied 21-item Spinning Dragon Sushi menu — optimized WebP images, grouped-by-category cards, trilingual name+description (phrase-pinyin + tap-to-hear audio), and ◎-coin decimal prices.

**Architecture:** A new pure `phraseHtml` in `js/i18n.js` renders the phrase style (Chinese + pinyin line + English gloss + `data-speak`). A build step converts the supplied PNGs to `assets/menu/*.webp`. `js/data.js` is regenerated from the supplied JSON into structured `{zh,py,en}` items. `js/main.js`'s `renderMenu` groups by category and renders image cards; the cart and prices use ◎ decimals.

**Tech Stack:** Vanilla ES modules, `cwebp` (image conversion), Node's built-in test runner.

**Source assets:** `~/Downloads/spinning_dragon_sushi_web_assets/` — `spinning_dragon_sushi_menu.json` (21 items) and `images/<id>.png`.

Current test baseline: **92 passing**.

---

## File Structure

- `js/i18n.js` — **modify**: add pure `phraseHtml`.
- `tests/i18n.test.js` — **modify**: `phraseHtml` tests.
- `css/i18n.css` — **modify**: `.bi-py` rule.
- `assets/menu/*.webp` — **new**: 21 optimized images + `SOURCE.md`.
- `js/data.js` — **replace**: 21 structured menu items (generated).
- `js/main.js` — **modify**: grouped image render + cart `phraseHtml` + ◎ decimals.
- `css/theme.css` — **modify**: `.menu-cat` header + `.mc-img` styles.

---

## Task 1: `phraseHtml` render helper

**Files:**
- Modify: `js/i18n.js`, `css/i18n.css`
- Test: `tests/i18n.test.js`

- [ ] **Step 1: Write the failing tests**

Append to the END of `tests/i18n.test.js`:

```javascript
import { phraseHtml } from "../js/i18n.js";

test("phraseHtml composes zh + phrase pinyin line + gloss with data-speak", () => {
  const html = phraseHtml({ zh: "西瓜卷", py: "Xīguā Juǎn", en: "Watermelon Roll" });
  assert.match(html, /<span class="bi" data-speak="西瓜卷">/);
  assert.match(html, /<span class="bi-zh">西瓜卷<\/span>/);
  assert.match(html, /<span class="bi-py">Xīguā Juǎn<\/span>/);
  assert.match(html, /<span class="en-gloss">Watermelon Roll<\/span>/);
});

test("phraseHtml escapes html-special chars and guards a falsy entry", () => {
  assert.match(phraseHtml({ zh: "<", py: "a", en: "b" }), /data-speak="&lt;"/);
  assert.equal(phraseHtml(null), '<span class="bi"></span>');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test 2>&1 | grep -E "phraseHtml|# fail"`
Expected: FAIL — `phraseHtml is not a function`.

- [ ] **Step 3: Implement `phraseHtml`**

In `js/i18n.js`, add this export immediately AFTER the `biHtmlEntry` function:

```javascript
// phraseHtml — like biHtmlEntry but the pinyin is shown as one phrase line
// (not ruby per character). Used for the menu, whose pinyin is phrase-level.
// entry = { zh, py (phrase string), en }. Tappable for audio via data-speak.
export function phraseHtml(entry) {
  if (!entry) return `<span class="bi"></span>`;
  const { zh = "", py = "", en = "" } = entry;
  return `<span class="bi" data-speak="${escapeHtml(zh)}">`
    + `<span class="bi-zh">${escapeHtml(zh)}</span> `
    + `<span class="bi-py">${escapeHtml(py)}</span> `
    + `<span class="en-gloss">${escapeHtml(en)}</span></span>`;
}
```

(`escapeHtml` is already defined at the top of `i18n.js`.)

- [ ] **Step 4: Add the `.bi-py` style**

Append to `css/i18n.css`:

```css
/* phrase-pinyin line (menu items): its own line under the Chinese */
.bi-py { display: block; font-size: .72em; opacity: .7; font-style: italic; margin-top: 1px; }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test`
Expected: PASS — 92 + 2 = 94 tests, 0 fail.

- [ ] **Step 6: Commit**

```bash
git add js/i18n.js css/i18n.css tests/i18n.test.js
git commit -m "feat: phraseHtml — phrase-pinyin bilingual render for the menu"
```

---

## Task 2: Optimize the menu images → WebP

**Files:**
- Create: `assets/menu/*.webp`, `assets/menu/SOURCE.md`

- [ ] **Step 1: Convert + resize all 21 PNGs**

Run (uses the supplied asset pack in `~/Downloads`):

```bash
mkdir -p assets/menu
SRC="$HOME/Downloads/spinning_dragon_sushi_web_assets"
for f in "$SRC"/images/*.png; do
  id=$(basename "$f" .png)
  cwebp -quiet -resize 600 0 -q 80 "$f" -o "assets/menu/$id.webp"
done
```

- [ ] **Step 2: Verify the output**

```bash
ls assets/menu/*.webp | wc -l    # expect 21
du -sh assets/menu               # expect roughly 1–2 MB total
file assets/menu/*.webp | head   # confirm "Web/P image"
```
If `cwebp` is missing or a conversion fails, STOP and report BLOCKED (the controller will adjust the tooling). Expected: 21 files, ~1–2MB total.

- [ ] **Step 3: Write `assets/menu/SOURCE.md`**

```markdown
# Menu images

Optimized (resized to 600px, WebP) from the supplied **Spinning Dragon Sushi**
web asset pack. One image per menu item, named `<menu id>.webp`.
```

- [ ] **Step 4: Commit**

```bash
git add assets/menu
git commit -m "feat: optimized Spinning Dragon menu images (webp)"
```

---

## Task 3: Regenerate `js/data.js` from the supplied menu

**Files:**
- Replace: `js/data.js`

- [ ] **Step 1: Generate `js/data.js` from the source JSON**

Run this generator (reads the supplied JSON, writes the structured menu verbatim — pinyin is used as-is):

```bash
node -e '
const fs = require("fs");
const src = JSON.parse(fs.readFileSync(process.env.HOME + "/Downloads/spinning_dragon_sushi_web_assets/spinning_dragon_sushi_menu.json", "utf8"));
const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
const tri = (z, p, e) => `{ zh: "${esc(z)}", py: "${esc(p)}", en: "${esc(e)}" }`;
const items = src.map((it) =>
`  { id: "${it.id}", price: ${Number(it.price_usd)}, image: "assets/menu/${it.id}.webp",
    category: ${tri(it.category_zh, it.category_pinyin, it.category_en)},
    name:     ${tri(it.name_zh, it.name_pinyin, it.name_en)},
    desc:     ${tri(it.description_zh, it.description_pinyin, it.description_en)} }`
).join(",\n");
const out = `// data.js — Spinning Dragon Sushi menu (pure data, no DOM).
// Each text field is { zh, py (phrase pinyin), en }. Generated from the supplied asset pack.
export const MENU = [
${items},
];
`;
fs.writeFileSync("js/data.js", out);
console.log("wrote", src.length, "items");
'
```
Expected output: `wrote 21 items`.

- [ ] **Step 2: Verify the generated file**

```bash
node --check js/data.js
node -e "import('./js/data.js').then(m=>{const a=m.MENU; console.log('items:',a.length); const k=new Set(a.flatMap(i=>['category','name','desc'].map(f=>Object.keys(i[f]).join(',')))); console.log('field shapes:',[...k]); console.log('cats:',[...new Set(a.map(i=>i.category.en))].join(' | ')); console.log('sample:',JSON.stringify(a[0]));})"
```
Expected: `items: 21`; every field shape `zh,py,en`; cats `Signature Rolls | Classic Sushi | Hot Snacks | Sweet Bites | Drinks`; the sample item has `price` (number) and `image: "assets/menu/watermelon_extreme_roll.webp"`.

```bash
# every item image resolves to a committed file
node -e "import('./js/data.js').then(m=>{const fs=require('fs');const miss=m.MENU.filter(i=>!fs.existsSync(i.image));console.log(miss.length?'MISSING:'+miss.map(i=>i.image):'all 21 images present')})"
```
Expected: `all 21 images present`.

- [ ] **Step 3: Run the suite**

Run: `node --test`
Expected: 94 pass, 0 fail (tests don't import `data.js`; `cart.test.js` uses its own fixtures).

- [ ] **Step 4: Commit**

```bash
git add js/data.js
git commit -m "feat: 21-item Spinning Dragon menu data (trilingual, categories)"
```

---

## Task 4: Grouped image menu render + cart + ◎ decimals

**Files:**
- Modify: `js/main.js`, `css/theme.css`

- [ ] **Step 1: Update the main.js import**

In `js/main.js`, the i18n import is currently:
```javascript
import { biHtmlEntry, biHtml, applyI18n, initSpeech } from "./i18n.js";
```
Change it to (drop `biHtmlEntry`, add `phraseHtml`):
```javascript
import { biHtml, phraseHtml, applyI18n, initSpeech } from "./i18n.js";
```

- [ ] **Step 2: Rewrite `renderMenu` (grouped + images + phrase)**

Replace the whole `renderMenu` function with:

```javascript
function renderMenu() {
  const grid = $("#menu-grid");
  let lastCat = null;
  grid.innerHTML = MENU.map((item) => {
    let head = "";
    if (item.category.en !== lastCat) {
      lastCat = item.category.en;
      head = `<h3 class="menu-cat">${phraseHtml(item.category)}</h3>`;
    }
    return head + `
    <article class="menu-card">
      <img class="mc-img" src="${item.image}" alt="${item.name.en}" loading="lazy"
           onerror="this.style.display='none'" />
      <h3>${phraseHtml(item.name)}</h3>
      <p class="mc-desc">${phraseHtml(item.desc)}</p>
      <div class="mc-foot">
        <span class="mc-price">${item.price.toFixed(2)}</span>
        <button class="mc-add" data-id="${item.id}">${biHtml("menu.buy")}</button>
      </div>
    </article>`;
  }).join("");

  grid.querySelectorAll(".mc-add").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = MENU.find((m) => m.id === btn.dataset.id);
      cart = addItem(cart, item);
      persistAndRender();
      openCart();
    });
  });
}
```

(The `.mc-price` CSS already prepends a ◎ via `::before`, so the text is just the number. `addItem` copies `id`/`name`/`price` — the structured `name` flows through.)

- [ ] **Step 3: Cart uses phraseHtml + ◎ decimals**

In `renderCart`, change the subtotal display line:
```javascript
  $("#cart-total").textContent = cartSubtotal(cart);
```
to:
```javascript
  $("#cart-total").textContent = "◎" + cartSubtotal(cart).toFixed(2);
```
change the empty-line name render `${biHtmlEntry(line.name)}` to `${phraseHtml(line.name)}` (the cart line `<span class="cl-name">`), and change the line price:
```javascript
      <span class="cl-price">◎${line.price * line.qty}</span>
```
to:
```javascript
      <span class="cl-price">◎${(line.price * line.qty).toFixed(2)}</span>
```

- [ ] **Step 4: Add the category + image styles to `css/theme.css`**

After the `.menu-card .mc-add:active { ... }` rule (end of the menu-card block), add:

```css
.menu-cat { grid-column: 1 / -1; font-family: var(--display); font-style: italic;
  text-transform: uppercase; color: var(--red); font-size: 20px; letter-spacing: 1px;
  margin: 22px 0 2px; padding-bottom: 6px; border-bottom: 3px solid var(--ink-2); }
.menu-card .mc-img { display: block; width: 100%; aspect-ratio: 1 / 1; object-fit: cover;
  border-radius: 8px; margin-bottom: 10px; background: rgba(0,0,0,.05); }
```

- [ ] **Step 5: Verify**

Run: `node --check js/main.js` → exit 0.
Run: `node --test` → 94 pass, 0 fail.
Run: `grep -n "biHtmlEntry" js/main.js` → no matches (fully replaced by phraseHtml).
Playtest: open `index.html` — the menu shows 5 category headers (each trilingual + tappable), each with image cards; names/descriptions show Chinese + phrase pinyin + English; tapping the Chinese speaks it; prices show `◎2.80`; adding to cart shows the bilingual name and a `◎` decimal total. A missing image just hides (no broken icon).

- [ ] **Step 6: Commit**

```bash
git add js/main.js css/theme.css
git commit -m "feat: grouped image menu render, cart phraseHtml, ◎ decimal prices"
```

---

## Task 5: Final verification

- [ ] **Step 1: Full test run**

Run: `node --test`
Expected: `# pass 94`, `# fail 0`.

- [ ] **Step 2: Parse all modules**

Run: `node --check js/i18n.js && node --check js/data.js && node --check js/main.js && node --check js/build.js && node --check js/builder.js && node --check js/parts.js && node --check js/physics.js && node --check js/arena.js && node --check js/sound.js`
Expected: no output (exit 0).

- [ ] **Step 3: Asset integrity**

Run: `node -e "import('./js/data.js').then(m=>{const fs=require('fs');const miss=m.MENU.filter(i=>!fs.existsSync(i.image));console.log(miss.length?'MISSING '+miss.length:'all images present');console.log('assets size:'); })" && du -sh assets/menu`
Expected: `all images present`; assets/menu ~1–2MB.

- [ ] **Step 4: Playtest the whole flow**

Open `index.html`: the front page menu is the 21-item Spinning Dragon menu, grouped by category with images and trilingual text; tap-to-hear works on menu Chinese; add several items and confirm the cart shows bilingual names and a `◎` decimal total; checkout clears it. Confirm the arena/builder still work (unchanged).

- [ ] **Step 5: Tune (optional, after playtest)**

If cards are too tall, clamp `.mc-desc` (e.g. `-webkit-line-clamp`); if images look soft, raise `cwebp -q` or the resize width and re-run Task 2; adjust `.menu-cat` spacing. Re-run `node --test`; commit separately.

---

## Notes for the implementer

- **Only `phraseHtml` is unit-tested** (pure). The menu data is generated deterministically from the supplied JSON; images are a build artifact; the render/layout is playtested.
- **`data.js` is generated, not hand-written** — run the Task 3 generator verbatim so the pinyin is copied exactly from the source (no manual transcription).
- **`cart.js` and its tests are untouched** — the structured `{zh,py,en}` `name` flows through `addItem` (which copies `id`/`name`/`price`), and `phraseHtml(line.name)` renders it in the cart.
- **The menu deliberately uses phrase pinyin** (one line) while the rest of the site uses ruby; both share `.bi`/`.en-gloss`/`data-speak` so audio and gloss styling stay consistent.
- **Prices are ◎ coins with decimals** — `.mc-price` text is the number (CSS adds ◎); cart line/total use a literal `◎` + `.toFixed(2)`.
