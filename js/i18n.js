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
