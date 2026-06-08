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

// The strings table — front-page strings (zh/py/en structured fields).
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
