# Bilingual Learning UI (Ruby Pinyin + Audio) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the whole app (front page, arena, builder) into a Chinese-learning UI where every string shows ruby pinyin over the characters (Chinese primary), a muted English gloss, and tap-to-hear audio.

**Architecture:** A new `js/i18n.js` holds a pure render core (`rubyHtml`, `biHtmlEntry`, `biHtml`) plus a `STRINGS` table `{zh, py[], en}`, an `applyI18n` pass for static HTML (`data-i18n` attributes), and `speak`/`initSpeech` for browser TTS. Static HTML, `main.js`, `data.js`, `arena.js`, and `builder.js` all render through it. `css/i18n.css` styles ruby + gloss + wrapping.

**Tech Stack:** Vanilla ES modules, HTML5 `<ruby>`, Web Speech API (`speechSynthesis`), Node's built-in test runner.

**Pinyin rule (applies to every entry):** `py` is an array with exactly one tone-marked syllable per **Han character** in `zh`, in order. Punctuation, spaces, digits, and Latin runs (e.g. "Beyblade X") get **no** `py` entry — the render passes them through.

Current test baseline: **85 passing**.

---

## File Structure

- `js/i18n.js` — **new**: render core + `STRINGS` table + `applyI18n` + `speak`/`initSpeech`.
- `tests/i18n.test.js` — **new**: unit tests for `rubyHtml`/`biHtmlEntry`/`biHtml`.
- `css/i18n.css` — **new**: ruby/gloss/wrapping styles. Linked in `index.html`.
- `index.html` — **modify**: `data-i18n` attributes; link `i18n.css`.
- `js/main.js` — **modify**: `applyI18n` + `initSpeech`; render menu/dialogue/cart via i18n.
- `js/data.js` — **modify**: structured `{zh,py[],en}` menu fields.
- `js/arena.js` — **modify**: all runtime strings via `biHtml`.
- `js/builder.js` — **modify**: all labels via `biHtml`.

---

## Task 1: i18n render core + styles + tests

**Files:**
- Create: `js/i18n.js`, `css/i18n.css`
- Test: `tests/i18n.test.js`
- Modify: `index.html` (css link)

- [ ] **Step 1: Write the failing tests**

Create `tests/i18n.test.js`:

```javascript
// tests/i18n.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { rubyHtml, biHtmlEntry, biHtml, STRINGS } from "../js/i18n.js";

test("rubyHtml wraps each Han character with its pinyin syllable", () => {
  assert.equal(
    rubyHtml("你好", ["nǐ", "hǎo"]),
    "<ruby>你<rt>nǐ</rt></ruby><ruby>好<rt>hǎo</rt></ruby>"
  );
});

test("rubyHtml passes punctuation and Latin through without rt, consuming py only for Han", () => {
  assert.equal(
    rubyHtml("打 Beyblade X！", ["dǎ"]),
    "<ruby>打<rt>dǎ</rt></ruby> Beyblade X！"
  );
});

test("rubyHtml escapes HTML-special characters in both text and pinyin", () => {
  assert.equal(rubyHtml("<", []), "&lt;");
  assert.equal(rubyHtml("你", ["a<b"]), "<ruby>你<rt>a&lt;b</rt></ruby>");
});

test("rubyHtml renders a Han char without rt when py runs short", () => {
  assert.equal(rubyHtml("你好", ["nǐ"]), "<ruby>你<rt>nǐ</rt></ruby>好");
});

test("rubyHtml on empty input returns empty string", () => {
  assert.equal(rubyHtml("", []), "");
});

test("biHtmlEntry composes ruby + gloss + data-speak from a {zh,py,en} entry", () => {
  const html = biHtmlEntry({ zh: "你好", py: ["nǐ", "hǎo"], en: "Hello" });
  assert.match(html, /<span class="bi" data-speak="你好">/);
  assert.match(html, /<span class="bi-zh"><ruby>你<rt>nǐ<\/rt><\/ruby>/);
  assert.match(html, /<span class="en-gloss">Hello<\/span>/);
});

test("biHtml looks up a STRINGS key; unknown key returns a visible fallback", () => {
  STRINGS.__test = { zh: "测试", py: ["cè", "shì"], en: "Test" };
  assert.match(biHtml("__test"), /data-speak="测试"/);
  assert.match(biHtml("does.not.exist"), /<span class="bi">does\.not\.exist<\/span>/);
  delete STRINGS.__test;
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test 2>&1 | grep -E "rubyHtml|biHtml|# fail"`
Expected: FAIL — import error / not a function.

- [ ] **Step 3: Implement `js/i18n.js`**

```javascript
// i18n.js — bilingual learning render layer. Every UI string is { zh, py[], en }:
// zh = Chinese, py = one tone-marked pinyin syllable per Han character (in order;
// punctuation/Latin get none), en = English gloss. Renders ruby (pinyin over each
// character) + a muted English gloss, tappable for zh-CN speech.

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ESC[c]);
}

function isHan(ch) {
  const c = ch.codePointAt(0);
  return c >= 0x4e00 && c <= 0x9fff;
}

// rubyHtml — wrap each Han character with its pinyin; pass everything else through.
export function rubyHtml(zh, py = []) {
  let out = "";
  let pi = 0;
  for (const ch of String(zh)) {
    if (isHan(ch)) {
      const syl = py[pi++];
      out += syl != null
        ? `<ruby>${escapeHtml(ch)}<rt>${escapeHtml(syl)}</rt></ruby>`
        : escapeHtml(ch);
    } else {
      out += escapeHtml(ch);
    }
  }
  return out;
}

// biHtmlEntry — a renderable group from a {zh,py,en} object (used for non-table
// strings like menu items). Tagged data-speak for tap-to-hear audio.
export function biHtmlEntry(entry) {
  if (!entry) return `<span class="bi"></span>`;
  const { zh = "", py = [], en = "" } = entry;
  return `<span class="bi" data-speak="${escapeHtml(zh)}">`
    + `<span class="bi-zh">${rubyHtml(zh, py)}</span> `
    + `<span class="en-gloss">${escapeHtml(en)}</span></span>`;
}

// The strings table (filled in by later tasks).
export const STRINGS = {};

export function t(key) { return STRINGS[key]; }

export function biHtml(key) {
  const entry = STRINGS[key];
  if (!entry) return `<span class="bi">${escapeHtml(key)}</span>`;
  return biHtmlEntry(entry);
}

// Fill every [data-i18n] element under root with its rendered string.
export function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.innerHTML = biHtml(el.dataset.i18n);
  });
}

// Speak a Chinese string via the Web Speech API (zh-CN). No-op if unavailable.
export function speak(zh) {
  const synth = window.speechSynthesis;
  if (!synth || !zh) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(zh);
  u.lang = "zh-CN";
  const voice = synth.getVoices().find((v) => /^zh/i.test(v.lang));
  if (voice) u.voice = voice;
  synth.speak(u);
}

// One delegated listener: tap anything carrying data-speak to hear it.
export function initSpeech(root = document) {
  root.addEventListener("click", (e) => {
    const el = e.target.closest("[data-speak]");
    if (el) speak(el.dataset.speak);
  });
}
```

- [ ] **Step 4: Create `css/i18n.css`**

```css
/* Bilingual learning text: ruby pinyin over characters + muted English gloss */
.bi { display: inline-block; }
.bi-zh { line-height: 1.9; }
ruby { ruby-position: over; }
ruby > rt { font-size: .55em; opacity: .75; letter-spacing: 0; font-weight: 600; }
.en-gloss { display: block; font-size: .62em; opacity: .6; font-weight: 400;
  text-transform: none; letter-spacing: .3px; margin-top: 2px; }
/* tap-to-hear affordance */
[data-speak] { cursor: pointer; }
[data-speak]:hover .bi-zh { text-shadow: 0 0 10px currentColor; }
/* the taller content needs room to wrap in buttons, callouts, banners */
.btn-launch, .btn-special, .btn-primary, .seg-btn, .arena-callout, .arena-banner,
.arena-rules, .rival-setup, .press-start, .dialogue-text { white-space: normal; }
.arena-callout, .arena-banner { line-height: 1.05; }
```

- [ ] **Step 5: Link the stylesheet in `index.html`**

In `<head>`, after the `css/builder.css` link, add:

```html
  <link rel="stylesheet" href="css/i18n.css" />
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test`
Expected: PASS — 85 + 7 = 92 tests, 0 fail.

- [ ] **Step 7: Commit**

```bash
git add js/i18n.js css/i18n.css tests/i18n.test.js index.html
git commit -m "feat: i18n render core (ruby pinyin + gloss + tts) with tests"
```

---

## Task 2: Front page — strings + wiring

**Files:**
- Modify: `js/i18n.js` (add front-page + menu STRINGS), `index.html`, `js/main.js`, `js/data.js`

- [ ] **Step 1: Add the front-page STRINGS entries**

In `js/i18n.js`, replace `export const STRINGS = {};` with the populated table below (later tasks append arena/builder keys):

```javascript
export const STRINGS = {
  // ---- topbar / nav ----
  "brand":      { zh: "旋转寿司", py: ["xuán", "zhuǎn", "shòu", "sī"], en: "Spin Sushi" },
  "nav.menu":   { zh: "菜单", py: ["cài", "dān"], en: "Menu" },
  "nav.story":  { zh: "故事", py: ["gù", "shi"], en: "Story" },
  "nav.bag":    { zh: "购物袋", py: ["gòu", "wù", "dài"], en: "Bag" },
  // ---- hero ----
  "hero.kana":  { zh: "回转寿司", py: ["huí", "zhuǎn", "shòu", "sī"], en: "Conveyor-belt sushi" },
  "hero.title": { zh: "旋转寿司", py: ["xuán", "zhuǎn", "shòu", "sī"], en: "Spin Sushi" },
  "hero.tag":   { zh: "街角的小小寿司店。手捏握寿司，匠心独运。还有一个绝对不能按的按钮。",
    py: ["jiē","jiǎo","de","xiǎo","xiǎo","shòu","sī","diàn","shǒu","niē","wò","shòu","sī","jiàng","xīn","dú","yùn","hái","yǒu","yí","gè","jué","duì","bù","néng","àn","de","àn","niǔ"],
    en: "A hole-in-the-wall sushi bar. Hand-pressed nigiri. One very forbidden button." },
  // ---- chef dialogue ----
  "chef.name":  { zh: "银次郎师傅", py: ["yín", "cì", "láng", "shī", "fu"], en: "Master Ginjiro" },
  "chef.l1":    { zh: "欢迎，饥肠辘辘的旅人。你找到了旋转寿司。",
    py: ["huān","yíng","jī","cháng","lù","lù","de","lǚ","rén","nǐ","zhǎo","dào","le","xuán","zhuǎn","shòu","sī"],
    en: "Welcome, hungry traveler. You've found Spin Sushi." },
  "chef.l2":    { zh: "米饭一气呵成地捏好，刀工干净利落。",
    py: ["mǐ","fàn","yì","qì","hē","chéng","de","niē","hǎo","dāo","gōng","gān","jìng","lì","luo"],
    en: "The rice is pressed in a single motion. The cuts, clean." },
  "chef.l3":    { zh: "从下面的菜单里挑一道菜吧……",
    py: ["cóng","xià","miàn","de","cài","dān","lǐ","tiāo","yí","dào","cài","ba"],
    en: "Choose your dish from my wares below…" },
  "chef.l4":    { zh: "还有，无论如何——千万别按那个红色按钮。",
    py: ["hái","yǒu","wú","lùn","rú","hé","qiān","wàn","bié","àn","nà","gè","hóng","sè","àn","niǔ"],
    en: "And whatever you do — do NOT press the red button." },
  "press.start":{ zh: "开始游戏", py: ["kāi", "shǐ", "yóu", "xì"], en: "Press Start" },
  "do.not.press": { zh: "请勿按下", py: ["qǐng", "wù", "àn", "xià"], en: "Do Not Press" },
  // ---- menu section ----
  "menu.title": { zh: "菜单", py: ["cài", "dān"], en: "The Wares" },
  "menu.kana":  { zh: "品目", py: ["pǐn", "mù"], en: "Bill of fare" },
  "menu.sub":   { zh: "旅人啊，把你的金币花得明智些。",
    py: ["lǚ","rén","a","bǎ","nǐ","de","jīn","bì","huā","de","míng","zhì","xiē"],
    en: "Spend your coins wisely, traveler." },
  "menu.buy":   { zh: "购买", py: ["gòu", "mǎi"], en: "Buy" },
  // ---- about / story ----
  "story.title":{ zh: "我们的故事", py: ["wǒ", "men", "de", "gù", "shi"], en: "Our Story" },
  "story.kana": { zh: "传说", py: ["chuán", "shuō"], en: "Legend" },
  "story.p1":   { zh: "白天，旋转寿司供应着全城最利落的握寿司。米饭一气呵成地捏成，刀工干净利落。常客们说，柜台总在微微嗡鸣，仿佛底下有什么东西一直在旋转。",
    py: ["bái","tiān","xuán","zhuǎn","shòu","sī","gōng","yìng","zhe","quán","chéng","zuì","lì","luo","de","wò","shòu","sī","mǐ","fàn","yì","qì","hē","chéng","de","niē","chéng","dāo","gōng","gān","jìng","lì","luo","cháng","kè","men","shuō","guì","tái","zǒng","zài","wēi","wēi","wēng","míng","fǎng","fú","dǐ","xià","yǒu","shén","me","dōng","xi","yì","zhí","zài","xuán","zhuǎn"],
    en: "By day, Spin Sushi serves the sharpest nigiri in the city. The rice is pressed in a single motion. The cuts are clean. Regulars say the counter hums faintly, like something underneath is always spinning." },
  "story.p2":   { zh: "他们没说错。地板之下，沉睡着一座正规的 Beyblade X 战斗盘。银次郎师傅绝口不提那个红色按钮。你不该按下它。",
    py: ["tā","men","méi","shuō","cuò","dì","bǎn","zhī","xià","chén","shuì","zhe","yí","zuò","zhèng","guī","de","zhàn","dòu","pán","yín","cì","láng","shī","fu","jué","kǒu","bù","tí","nà","gè","hóng","sè","àn","niǔ","nǐ","bù","gāi","àn","xià","tā"],
    en: "They're not wrong. Beneath the floor sleeps a regulation Beyblade X stadium. Master Ginjiro won't speak of the red button. You shouldn't press it." },
  // ---- cart drawer ----
  "cart.title": { zh: "你的购物袋", py: ["nǐ", "de", "gòu", "wù", "dài"], en: "Your Bag" },
  "cart.total": { zh: "合计", py: ["hé", "jì"], en: "Total" },
  "cart.checkout": { zh: "结账", py: ["jié", "zhàng"], en: "Checkout" },
  "cart.confirm": { zh: "下单成功！开动啦", py: ["xià","dān","chéng","gōng","kāi","dòng","la"], en: "Order in! Itadakimasu 🥢" },
  "cart.empty": { zh: "你的托盘空空如也。", py: ["nǐ","de","tuō","pán","kōng","kōng","rú","yě"], en: "Your tray is empty." },
};
```

- [ ] **Step 2: Add `data-i18n` attributes to `index.html`**

Apply these exact replacements:

`<span class="rb-label">请勿按下</span>` → `<span class="rb-label" data-i18n="do.not.press"></span>`

`<div class="brand">旋转<span>寿司</span></div>` → `<div class="brand" data-i18n="brand"></div>`

```html
      <a href="#menu">菜单</a>
      <a href="#about">故事</a>
```
→
```html
      <a href="#menu" data-i18n="nav.menu"></a>
      <a href="#about" data-i18n="nav.story"></a>
```

In the cart toggle, replace the text node `购物袋` so the button reads:
```html
      <button id="cart-toggle" class="cart-toggle" aria-label="打开购物袋">
        <span class="coin-ico" aria-hidden="true">◎</span> <span data-i18n="nav.bag"></span>
        <span id="cart-count" class="cart-badge">0</span>
      </button>
```

```html
          <p class="hero-kana">回转寿司</p>
          <h1 class="hero-title">旋转<br />寿司</h1>
          <p class="hero-tag">街角的小小寿司店。手捏握寿司，匠心独运。还有一个绝对不能按的按钮。</p>
```
→
```html
          <p class="hero-kana" data-i18n="hero.kana"></p>
          <h1 class="hero-title" data-i18n="hero.title"></h1>
          <p class="hero-tag" data-i18n="hero.tag"></p>
```

`<span class="dialogue-name">银次郎师傅</span>` → `<span class="dialogue-name" data-i18n="chef.name"></span>`

`<span class="ps-blip">▶</span> 开始游戏` → `<span class="ps-blip">▶</span> <span data-i18n="press.start"></span>`

```html
      <h2 class="section-title">菜单 <span class="kana">品目</span></h2>
      <p class="menu-sub">旅人啊，把你的金币花得明智些。</p>
```
→
```html
      <h2 class="section-title"><span data-i18n="menu.title"></span> <span class="kana" data-i18n="menu.kana"></span></h2>
      <p class="menu-sub" data-i18n="menu.sub"></p>
```

```html
        <h2 class="section-title">我们的故事 <span class="kana">传说</span></h2>
        <p>By day, ...spinning.</p>
        <p>They're not wrong. ...<em>You shouldn't press it.</em></p>
```
The two `<p>` story paragraphs currently hold Chinese text (from the prior commit). Replace the whole Story panel inner so it reads:
```html
        <h2 class="section-title"><span data-i18n="story.title"></span> <span class="kana" data-i18n="story.kana"></span></h2>
        <p data-i18n="story.p1"></p>
        <p data-i18n="story.p2"></p>
```

Cart drawer:
```html
      <h2>你的购物袋</h2>
```
→ `<h2 data-i18n="cart.title"></h2>`

```html
      <div class="cart-total">合计 <span id="cart-total">0</span></div>
      <button id="checkout" class="btn-primary btn-block">结账</button>
      <p id="cart-confirm" class="cart-confirm" hidden>下单成功！开动啦 🥢</p>
```
→
```html
      <div class="cart-total"><span data-i18n="cart.total"></span> <span id="cart-total">0</span></div>
      <button id="checkout" class="btn-primary btn-block" data-i18n="cart.checkout"></button>
      <p id="cart-confirm" class="cart-confirm" hidden data-i18n="cart.confirm"></p>
```

- [ ] **Step 3: Restructure `js/data.js` menu items**

Replace the `MENU` array with structured fields (`name`/`desc` become `{zh,py,en}`; `kana` likewise):

```javascript
// data.js — sushi menu (pure data, no DOM). Each text field is { zh, py[], en }.
export const MENU = [
  { id: "tuna-nigiri",  price: 6,
    name: { zh: "金枪鱼握寿司", py: ["jīn","qiāng","yú","wò","shòu","sī"], en: "Tuna Nigiri" },
    kana: { zh: "金枪鱼", py: ["jīn","qiāng","yú"], en: "Maguro" },
    desc: { zh: "蓝鳍金枪鱼，盖在手捏米饭上。", py: ["lán","qí","jīn","qiāng","yú","gài","zài","shǒu","niē","mǐ","fàn","shàng"], en: "Bluefin over hand-pressed rice." } },
  { id: "salmon-nigiri", price: 5,
    name: { zh: "三文鱼握寿司", py: ["sān","wén","yú","wò","shòu","sī"], en: "Salmon Nigiri" },
    kana: { zh: "三文鱼", py: ["sān","wén","yú"], en: "Sake" },
    desc: { zh: "肥美三文鱼，刷上一层甜酱油。", py: ["féi","měi","sān","wén","yú","shuā","shàng","yì","céng","tián","jiàng","yóu"], en: "Buttery salmon, brushed with nikiri." } },
  { id: "dragon-roll", price: 14,
    name: { zh: "龙卷", py: ["lóng","juǎn"], en: "Dragon Roll" },
    kana: { zh: "龙", py: ["lóng"], en: "Ryu" },
    desc: { zh: "鳗鱼与牛油果，鳞片状如游龙。", py: ["mán","yú","yǔ","niú","yóu","guǒ","lín","piàn","zhuàng","rú","yóu","lóng"], en: "Eel & avocado, scaled like a dragon." } },
  { id: "spicy-tuna", price: 9,
    name: { zh: "辣金枪鱼卷", py: ["là","jīn","qiāng","yú","juǎn"], en: "Spicy Tuna Roll" },
    kana: { zh: "微辣", py: ["wēi","là"], en: "Pirikara" },
    desc: { zh: "金枪鱼碎、辣油，口感爽脆。", py: ["jīn","qiāng","yú","suì","là","yóu","kǒu","gǎn","shuǎng","cuì"], en: "Chopped tuna, chili oil, crunch." } },
  { id: "uni-gunkan", price: 12,
    name: { zh: "海胆军舰", py: ["hǎi","dǎn","jūn","jiàn"], en: "Uni Gunkan" },
    kana: { zh: "海胆", py: ["hǎi","dǎn"], en: "Uni" },
    desc: { zh: "海胆军舰卷——再合适不过。", py: ["hǎi","dǎn","jūn","jiàn","juǎn","zài","hé","shì","bú","guò"], en: "Sea urchin battleship — fitting." } },
  { id: "tamago", price: 4,
    name: { zh: "玉子烧", py: ["yù","zǐ","shāo"], en: "Tamago" },
    kana: { zh: "玉子", py: ["yù","zǐ"], en: "Tamago" },
    desc: { zh: "层层叠叠的甜味厚蛋烧。", py: ["céng","céng","dié","dié","de","tián","wèi","hòu","dàn","shāo"], en: "Sweet layered omelette." } },
  { id: "edamame", price: 5,
    name: { zh: "毛豆", py: ["máo","dòu"], en: "Edamame" },
    kana: { zh: "毛豆", py: ["máo","dòu"], en: "Edamame" },
    desc: { zh: "海盐风味毛豆。", py: ["hǎi","yán","fēng","wèi","máo","dòu"], en: "Sea-salted soybeans." } },
  { id: "miso-soup", price: 3,
    name: { zh: "味噌汤", py: ["wèi","cēng","tāng"], en: "Miso Soup" },
    kana: { zh: "味噌", py: ["wèi","cēng"], en: "Miso" },
    desc: { zh: "高汤、豆腐、葱花。", py: ["gāo","tāng","dòu","fu","cōng","huā"], en: "Dashi, tofu, scallion." } },
];
```

- [ ] **Step 4: Wire `js/main.js`**

(a) Add to the imports at the top:
```javascript
import { biHtmlEntry, biHtml, applyI18n, initSpeech } from "./i18n.js";
```

(b) In the menu card template (`renderMenu`), replace the three text lines + button:
```javascript
      <span class="mc-kana">${item.kana}</span>
      <h3>${item.name}</h3>
      <p class="mc-desc">${item.desc}</p>
      <div class="mc-foot">
        <span class="mc-price">${item.price}</span>
        <button class="mc-add" data-id="${item.id}">购买</button>
      </div>
```
with:
```javascript
      <span class="mc-kana">${biHtmlEntry(item.kana)}</span>
      <h3>${biHtmlEntry(item.name)}</h3>
      <p class="mc-desc">${biHtmlEntry(item.desc)}</p>
      <div class="mc-foot">
        <span class="mc-price">${item.price}</span>
        <button class="mc-add" data-id="${item.id}">${biHtml("menu.buy")}</button>
      </div>
```

(c) In `renderCart`, the empty-tray line and the cart line name. Replace:
```javascript
    lines.innerHTML = `<li class="cart-empty">你的托盘空空如也。</li>`;
```
with:
```javascript
    lines.innerHTML = `<li class="cart-empty">${biHtml("cart.empty")}</li>`;
```
and replace `<span class="cl-name">${line.name}</span>` with:
```javascript
      <span class="cl-name">${biHtmlEntry(line.name)}</span>
```
(`line.name` is now the structured `{zh,py,en}` object carried through `cart.js`.)

(d) The cart toggle text and a delegated speak click can interfere — the cart `+`/`−` buttons live inside cart lines that now contain `[data-speak]`. That's fine; the speak listener only fires on `[data-speak]` ancestors, and the qty buttons have their own handlers. No change needed.

(e) Replace the dialogue typewriter with a ruby fade-in. Replace the `LINES` constant and the `mountDialogue` function body so it renders full ruby lines and advances on click:
```javascript
const LINE_KEYS = ["chef.l1", "chef.l2", "chef.l3", "chef.l4"];

function mountDialogue() {
  const box = $("#dialogue");
  const textEl = $("#dialogue-text");
  const nextEl = $("#dialogue-next");
  if (!box || !textEl) return;

  let idx = 0;
  function show(i) {
    textEl.innerHTML = biHtml(LINE_KEYS[i]);
    textEl.classList.remove("fade-in");
    void textEl.offsetWidth;        // restart the fade animation
    textEl.classList.add("fade-in");
    nextEl.classList.add("show");
  }
  function advance() { idx = (idx + 1) % LINE_KEYS.length; show(idx); }

  show(0);
  box.addEventListener("click", advance);
  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); advance(); }
  });
}
```
(Delete the old `LINES` array and the old typewriter `type`/`advance` internals it replaces. Keep the `mountDialogue()` call site in `init()`.)

(f) In `init()`, after the menu/cart/dialogue are mounted and listeners wired, add the i18n passes. Find the end of `init()` (before `init();` at the bottom) and add:
```javascript
  applyI18n(document);
  initSpeech(document);
```
Place these AFTER `renderMenu()`/`renderCart()`/`mountDialogue()` so dynamic nodes also carry `data-speak` (the delegated speak listener covers nodes added later anyway).

- [ ] **Step 5: Add the dialogue fade animation to `css/i18n.css`**

Append to `css/i18n.css`:
```css
.fade-in { animation: bi-fade .25s ease-out; }
@keyframes bi-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
```

- [ ] **Step 6: Verify**

Run: `node --check js/i18n.js && node --check js/main.js && node --check js/data.js` → exit 0.
Run: `node --test` → 92 pass, 0 fail (cart.test.js uses its own fixtures, unaffected).
Run: `grep -n "data-i18n" index.html | wc -l` → ~16 (every front-page string wired).
Playtest: front page shows ruby pinyin over every label/heading/paragraph, an English gloss under each, and tapping a Chinese term speaks it (zh-CN). The menu cards, chef dialogue (fade-in, advances on click), and cart all render bilingually.

- [ ] **Step 7: Commit**

```bash
git add js/i18n.js index.html js/main.js js/data.js css/i18n.css
git commit -m "feat: bilingual front page — ruby pinyin, gloss, audio, menu/dialogue/cart"
```

---

## Task 3: Arena strings

**Files:**
- Modify: `js/i18n.js` (append arena keys), `js/arena.js`

- [ ] **Step 1: Append arena STRINGS entries**

In `js/i18n.js`, add these keys inside the `STRINGS` object (before its closing `};`):

```javascript
  // ---- arena ----
  "arena.you":   { zh: "你", py: ["nǐ"], en: "You" },
  "arena.rival": { zh: "对手", py: ["duì", "shǒu"], en: "Rival" },
  "arena.spin.right": { zh: "右旋", py: ["yòu", "xuán"], en: "Right" },
  "arena.spin.left":  { zh: "左旋", py: ["zuǒ", "xuán"], en: "Left" },
  "arena.spin.label": { zh: "旋向", py: ["xuán", "xiàng"], en: "Spin" },
  "arena.charge": { zh: "蓄力发射", py: ["xù", "lì", "fā", "shè"], en: "Hold to Charge" },
  "arena.special": { zh: "必杀技", py: ["bì", "shā", "jì"], en: "Special" },
  "arena.next":   { zh: "下一回合", py: ["xià", "yī", "huí", "hé"], en: "Next Round" },
  "arena.replay": { zh: "重打本回合", py: ["chóng", "dǎ", "běn", "huí", "hé"], en: "Replay Round" },
  "arena.rematch": { zh: "再来一局", py: ["zài", "lái", "yì", "jú"], en: "New Match" },
  "arena.exit":   { zh: "返回车库", py: ["fǎn", "huí", "chē", "kù"], en: "Exit to Garage" },
  "arena.power":  { zh: "力量", py: ["lì", "liàng"], en: "Power" },
  "arena.burst":  { zh: "爆气", py: ["bào", "qì"], en: "Burst" },
  // banners
  "arena.battle": { zh: "开战！", py: ["kāi", "zhàn"], en: "Battle!" },
  "arena.ringout": { zh: "出界！", py: ["chū", "jiè"], en: "Ring Out!" },
  "arena.spinout": { zh: "停转！", py: ["tíng", "zhuàn"], en: "Spin Out!" },
  "arena.draw":   { zh: "平局", py: ["píng", "jú"], en: "Draw" },
  "arena.round.won":  { zh: "本回合胜", py: ["běn", "huí", "hé", "shèng"], en: "Round Won" },
  "arena.round.lost": { zh: "本回合负", py: ["běn", "huí", "hé", "fù"], en: "Round Lost" },
  "arena.match.won":  { zh: "比赛胜利！", py: ["bǐ", "sài", "shèng", "lì"], en: "Match Won!" },
  "arena.match.lost": { zh: "比赛失败", py: ["bǐ", "sài", "shī", "bài"], en: "Match Lost" },
  // callouts
  "arena.clash":  { zh: "碰撞！", py: ["pèng", "zhuàng"], en: "Clash!" },
  "arena.smash":  { zh: "猛击！", py: ["měng", "jī"], en: "Smash!" },
  "arena.megahit": { zh: "超强一击！", py: ["chāo", "qiáng", "yì", "jī"], en: "Mega Hit!" },
  "arena.special.go": { zh: "必杀技！", py: ["bì", "shā", "jì"], en: "Special!" },
  "arena.rival.special": { zh: "对手必杀技！", py: ["duì", "shǒu", "bì", "shā", "jì"], en: "Rival Special!" },
  "arena.xtreme": { zh: "极速冲刺！", py: ["jí", "sù", "chōng", "cì"], en: "Xtreme Dash!" },
  "arena.rules":  { zh: "把对手撞出场地（出界），或耗尽其旋转（停转）。先赢两回合者获胜。",
    py: ["bǎ","duì","shǒu","zhuàng","chū","chǎng","dì","chū","jiè","huò","hào","jìn","qí","xuán","zhuǎn","tíng","zhuàn","xiān","yíng","liǎng","huí","hé","zhě","huò","shèng"],
    en: "Knock the rival out of the ring (RING OUT), or outspin them (SPIN OUT). First to 2 round wins takes the match." },
  "arena.title": { zh: "陀螺竞技场", py: ["tuó", "luó", "jìng", "jì", "chǎng"], en: "Beyblade Arena" },
```

- [ ] **Step 2: Wire `js/arena.js`**

(a) Add to the physics/sound imports at the top of `arena.js`:
```javascript
import { biHtml, t } from "./i18n.js";
```

(b) `showBanner` and `showCallout` must render HTML. Change `bannerEl.textContent = text;` to `bannerEl.innerHTML = text;` in `showBanner`, and `calloutEl.textContent = text;` to `calloutEl.innerHTML = text;` in `showCallout`.

(c) Replace each banner/callout/label string with `biHtml("key")`. Apply these:
- `showBanner("BATTLE!")` → `showBanner(biHtml("arena.battle"))`
- `showBanner(reason === "ringout" ? "RING OUT!" : "SPIN OUT!")` → `showBanner(reason === "ringout" ? biHtml("arena.ringout") : biHtml("arena.spinout"))`
- `showBanner("DRAW")` → `showBanner(biHtml("arena.draw"))`
- `showBanner("REPLAY ROUND")` → `showBanner(biHtml("arena.replay"))`
- `showBanner(won ? "MATCH WON!" : "MATCH LOST")` → `showBanner(won ? biHtml("arena.match.won") : biHtml("arena.match.lost"))`
- `showBanner(outcome === "player" ? "ROUND WON" : "ROUND LOST")` → `showBanner(outcome === "player" ? biHtml("arena.round.won") : biHtml("arena.round.lost"))`
- In `onImpact`, the three callout texts: replace `text = "MEGA HIT!"` / `"SMASH!"` / `"CLASH!"` so the call becomes `showCallout(biHtml(tier === "lg" ? "arena.megahit" : tier === "md" ? "arena.smash" : "arena.clash"))`. Concretely, set `let tier;` from the impact thresholds as today, then `showCallout(biHtml(tier === "lg" ? "arena.megahit" : tier === "md" ? "arena.smash" : "arena.clash"));` and `triggerShake(tier);` (drop the old `text` variable).
- `showCallout("SPECIAL!")` → `showCallout(biHtml("arena.special.go"))`
- `showCallout("RIVAL SPECIAL!")` → `showCallout(biHtml("arena.rival.special"))`
- `showCallout("XTREME DASH!")` → `showCallout(biHtml("arena.xtreme"))`

(d) Button text + labels set in JS: `launchEl.textContent = "HOLD TO CHARGE";` → `launchEl.innerHTML = biHtml("arena.charge");`. The `nextRoundEl.textContent = "Replay Round"` / `"Next Round"` → `nextRoundEl.innerHTML = biHtml("arena.replay")` / `biHtml("arena.next")`. `rematchEl.textContent = "New Match"` → `rematchEl.innerHTML = biHtml("arena.rematch")`.

(e) The rival readout (`renderRivalSetup`) currently builds a plain string with `dirLabel`. Replace its body so the spin label uses the bilingual zh/en and keeps the part names:
```javascript
  function renderRivalSetup() {
    const dir = rivalDir === 1 ? t("arena.spin.right") : t("arena.spin.left");
    rivalSetupEl.innerHTML =
      `${biHtml("arena.rival")} · <span class="bi" data-speak="${dir.zh}">${dir.zh}</span> · `
      + `${biHtmlEntry(rivalBuild.blade.name)} / ${biHtmlEntry(rivalBuild.ratchet.name)} / ${biHtmlEntry(rivalBuild.bit.name)}`;
  }
```
Add `biHtmlEntry` to the i18n import in (a): `import { biHtml, biHtmlEntry, t } from "./i18n.js";`. (Part names are structured objects once Task 4 of the prior builder feature is in place — they already are, from `parts.js`? No — `parts.js` names are plain strings. See Step 3 below.)

- [ ] **Step 3: Make `parts.js` names structured (needed by arena readout + builder)**

`js/parts.js` part `name` fields are plain strings (e.g. `"Samurai Saber"`, `"3-60"`, `"Zap"`). For bilingual rendering, give each part a structured `name: {zh, py[], en}` while keeping `id`/`image`/stats. Author Chinese + pinyin for the 18 parts. Example for the first of each (apply the same shape to all 18, authoring zh/py for each):

```javascript
  { id: "samurai-saber", name: { zh: "武士剑", py: ["wǔ","shì","jiàn"], en: "Samurai Saber" }, image: "assets/parts/BladeSamuraiSaber.webp", attack: 65, defense: 20, stamina: 25 },
```
Ratchets are numeric codes (e.g. `3-60`) — keep them as-is in a structured entry with the code as both zh and en and empty `py`:
```javascript
  { id: "3-60", name: { zh: "3-60", py: [], en: "3-60" }, image: "assets/parts/Ratchet3-60.webp", attack: 15, defense: 9, stamina: 6 },
```
**Important:** `combineStats`/`statsToPhysics` read only the numeric stat fields, so structuring `name` does not affect physics or the 92 tests. The builder's `fillSelect`/`renderPreview` and the arena readout must read `name.en` (or render via `biHtmlEntry(name)`) instead of the bare string — handled in Task 4 and Step 2(e) above.

(Author all 18 names. Blades: 武士剑 Samurai Saber, 爆裂破坏者 Dran Buster, 骑士铠甲 Knight Mail, 时钟幻影 Clock Mirage, 地狱之锤 HellsHammer, 巨人岩石 Golem Rock. Ratchets keep their codes. Bits: 电击 Zap, 点火 Ignition, 下针 Under Needle, 缓冲 Yield, 齿轮冲刺 Gear Rush, 齿轮球 Gear Ball — author pinyin per character.)

- [ ] **Step 4: Verify**

Run: `node --check js/arena.js && node --check js/parts.js && node --check js/i18n.js` → exit 0.
Run: `node --test` → 92 pass, 0 fail (physics/build read only numeric stats; unaffected).
Playtest: open a battle — banners, callouts, the rules blurb, buttons, the rival readout, and HUD labels all render ruby+gloss; tapping a callout/term speaks it.

- [ ] **Step 5: Commit**

```bash
git add js/i18n.js js/arena.js js/parts.js
git commit -m "feat: bilingual arena strings + structured part names"
```

---

## Task 4: Builder strings

**Files:**
- Modify: `js/i18n.js` (append builder keys), `index.html` (builder markup), `js/builder.js`

- [ ] **Step 1: Append builder STRINGS entries**

Add to `STRINGS` in `js/i18n.js`:
```javascript
  // ---- builder ----
  "build.title": { zh: "组装你的陀螺", py: ["zǔ", "zhuāng", "nǐ", "de", "tuó", "luó"], en: "Build Your Beyblade" },
  "build.blade": { zh: "刀环", py: ["dāo", "huán"], en: "Blade" },
  "build.ratchet": { zh: "棘齿", py: ["jí", "chǐ"], en: "Ratchet" },
  "build.bit": { zh: "轴尖", py: ["zhóu", "jiān"], en: "Bit" },
  "build.battle": { zh: "出战", py: ["chū", "zhàn"], en: "To Battle" },
  "build.close": { zh: "返回商店", py: ["fǎn", "huí", "shāng", "diàn"], en: "Back to Shop" },
  "stat.atk": { zh: "攻击", py: ["gōng", "jī"], en: "ATK" },
  "stat.def": { zh: "防御", py: ["fáng", "yù"], en: "DEF" },
  "stat.sta": { zh: "耐力", py: ["nài", "lì"], en: "STA" },
  "stat.x":   { zh: "冲刺", py: ["chōng", "cì"], en: "X" },
  "stat.br":  { zh: "抗爆", py: ["kàng", "bào"], en: "BR" },
```

- [ ] **Step 2: Builder markup `data-i18n`**

In the `#builder` overlay in `index.html`, wire the title, field labels, and buttons:
- `<h2 class="builder-title">BUILD YOUR <span>BEYBLADE</span></h2>` → `<h2 class="builder-title" data-i18n="build.title"></h2>`
- The three field labels `Blade`/`Ratchet`/`Bit` text becomes a span: e.g. `<label class="builder-field"><span data-i18n="build.blade"></span> <select id="sel-blade" ...></select></label>` (same for ratchet/bit).
- `<button id="builder-battle" class="btn-launch builder-battle">⚔&nbsp;TO&nbsp;BATTLE</button>` → `<button id="builder-battle" class="btn-launch builder-battle">⚔ <span data-i18n="build.battle"></span></button>`
- `<button id="builder-close" class="builder-close" aria-label="Back to shop">✕</button>` keeps the ✕ (aria-label can stay English; it's not visible).

Since the builder overlay is in the static DOM, the Task 2 `applyI18n(document)` call already fills these on load. No extra apply pass needed.

- [ ] **Step 3: Wire `js/builder.js`**

(a) Add to the imports: `import { biHtml, biHtmlEntry, t } from "./i18n.js";`

(b) `fillSelect` uses `p.name` (now a structured object) as the option text — `<option>` can't hold ruby HTML, so use the English + Chinese plainly: change `o.textContent = p.name;` to `o.textContent = p.name.zh + " " + p.name.en;`.

(c) `renderPreview` uses `build.blade.name` (now structured). Change:
```javascript
    previewEl.alt = build.blade.name;
    nameEl.textContent = `${build.blade.name} / ${build.ratchet.name} / ${build.bit.name}`;
```
to:
```javascript
    previewEl.alt = build.blade.name.en;
    nameEl.innerHTML = `${biHtmlEntry(build.blade.name)} / ${biHtmlEntry(build.ratchet.name)} / ${biHtmlEntry(build.bit.name)}`;
```

(d) `renderGraph` uses the bar label from `buildBars` (`bar.label` = "ATK" etc.). Map those to the bilingual stat keys. Change `label.textContent = bar.label;` to:
```javascript
    const STAT_KEY = { ATK: "stat.atk", DEF: "stat.def", STA: "stat.sta", X: "stat.x", BR: "stat.br" };
    label.innerHTML = biHtml(STAT_KEY[bar.label]);
```
(Define `STAT_KEY` once at module scope, not inside the loop.)

- [ ] **Step 4: Verify**

Run: `node --check js/builder.js && node --check js/i18n.js` → exit 0.
Run: `node --test` → 92 pass, 0 fail.
Playtest: the builder screen title, field labels, stat-bar labels, TO BATTLE, the blade name/preview, and the dropdown options all render bilingually; tapping a label speaks it.

- [ ] **Step 5: Commit**

```bash
git add js/i18n.js index.html js/builder.js
git commit -m "feat: bilingual builder screen strings"
```

---

## Task 5: Final verification + tune

- [ ] **Step 1: Full test run**

Run: `node --test`
Expected: `# pass 92`, `# fail 0`.

- [ ] **Step 2: Parse all modules**

Run: `node --check js/i18n.js && node --check js/build.js && node --check js/builder.js && node --check js/parts.js && node --check js/physics.js && node --check js/arena.js && node --check js/sound.js && node --check js/main.js && node --check js/data.js`
Expected: no output (exit 0).

- [ ] **Step 3: Pinyin alignment sanity check**

Run this to flag any entry whose `py` length ≠ its Han-character count (a likely typo):
```bash
node -e "import('./js/i18n.js').then(m=>{for(const[k,v]of Object.entries(m.STRINGS)){const han=[...v.zh].filter(c=>{const x=c.codePointAt(0);return x>=0x4e00&&x<=0x9fff}).length;if(han!==v.py.length)console.log('MISMATCH',k,'han',han,'py',v.py.length)}console.log('checked',Object.keys(m.STRINGS).length)})"
```
Expected: only `checked N` (no MISMATCH lines). Fix any flagged entry's `py`.

- [ ] **Step 4: Playtest the whole app**

Open `index.html`: front page (nav, hero, dialogue fade-in, menu, story, cart) all show ruby pinyin + English gloss; tapping any Chinese term speaks it. Red button → builder (bilingual labels + bar stats) → TO BATTLE → arena (bilingual banners/callouts/buttons/readout). Confirm audio works on a click, and that the taller content still fits (callouts may wrap — acceptable).

- [ ] **Step 5: Tune (optional, after playtest)**

If a flashing arena callout is unreadable, drop its `py` to just the most useful syllables or shorten the `en`. If ruby pinyin is too small/large, adjust `rt`/`.en-gloss` sizes in `css/i18n.css`. Re-run `node --test`; commit separately.

---

## Notes for the implementer

- **The render core is the only tested unit.** `rubyHtml`/`biHtmlEntry`/`biHtml` are pure and covered; everything else is content + DOM wiring, verified by the alignment check (Step 3 of Task 5) and playtest.
- **`py` must have one syllable per Han character.** The Task 5 alignment script catches mismatches — run it after each content task, not just at the end.
- **`innerHTML`, not `textContent`,** wherever a bilingual string is shown (banners, callouts, buttons, dialogue, cart, menu) — the rendered string contains `<ruby>` markup. The strings come only from our own `STRINGS`/`data.js`/`parts.js` (not user input) and are HTML-escaped by `rubyHtml`/`biHtmlEntry`, so this is safe.
- **`<option>` and `aria-label` can't hold ruby** — use plain `zh + " " + en` text there (builder dropdowns) and leave aria-labels in English.
- **Physics/cart are untouched:** `combineStats`/`statsToPhysics` read only numeric stats; `cart.js` carries the structured `name` object through unchanged; the 92 tests stay green.
- **Audio needs a user gesture:** the tap that triggers `speak` supplies it; `speechSynthesis` voices load async, so `speak` picks a `zh-*` voice if present and otherwise relies on `lang="zh-CN"`.
