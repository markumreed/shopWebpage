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
