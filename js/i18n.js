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

// The strings table — front-page strings (zh/py/en structured fields).
export const STRINGS = {
  // ---- topbar / nav ----
  "brand":      { zh: "旋转寿司", py: ["xuán", "zhuàn", "shòu", "sī"], en: "Spin Sushi" },
  "nav.menu":   { zh: "菜单", py: ["cài", "dān"], en: "Menu" },
  "nav.story":  { zh: "故事", py: ["gù", "shi"], en: "Story" },
  "nav.bag":    { zh: "订单", py: ["dìng", "dān"], en: "Order" },
  "hud.points": { zh: "积分", py: ["jī", "fēn"], en: "Points" },
  "hud.battle": { zh: "去对战", py: ["qù", "duì", "zhàn"], en: "Battle" },
  "menu.need":  { zh: "还差", py: ["hái", "chà"], en: "need" },
  // ---- hero ----
  "hero.kana":  { zh: "回转寿司", py: ["huí", "zhuàn", "shòu", "sī"], en: "Conveyor-belt sushi" },
  "hero.title": { zh: "旋转寿司", py: ["xuán", "zhuàn", "shòu", "sī"], en: "Spin Sushi" },
  "hero.tag":   { zh: "街角的小小寿司店。手捏握寿司，匠心独运。还有一个绝对不能按的按钮。",
    py: ["jiē","jiǎo","de","xiǎo","xiǎo","shòu","sī","diàn","shǒu","niē","wò","shòu","sī","jiàng","xīn","dú","yùn","hái","yǒu","yí","gè","jué","duì","bù","néng","àn","de","àn","niǔ"],
    en: "A hole-in-the-wall sushi bar. Hand-pressed nigiri. One very forbidden button." },
  // ---- chef dialogue ----
  "chef.name":  { zh: "银次郎师傅", py: ["yín", "cì", "láng", "shī", "fu"], en: "Master Ginjiro" },
  "chef.l1":    { zh: "欢迎，饥肠辘辘的旅人。你找到了旋转寿司。",
    py: ["huān","yíng","jī","cháng","lù","lù","de","lǚ","rén","nǐ","zhǎo","dào","le","xuán","zhuàn","shòu","sī"],
    en: "Welcome, hungry traveler. You've found Spin Sushi." },
  "chef.l2":    { zh: "这里，美食不用钱买，要用积分。",
    py: ["zhè","lǐ","měi","shí","bù","yòng","qián","mǎi","yào","yòng","jī","fēn"],
    en: "Here, food isn't bought with coin — only with ★ points." },
  "chef.l3":    { zh: "没有积分？按上面的「对战」，去竞技场旋转取胜。",
    py: ["méi","yǒu","jī","fēn","àn","shàng","miàn","de","duì","zhàn","qù","jìng","jì","chǎng","xuán","zhuàn","qǔ","shèng"],
    en: "No points? Hit ⚔ Battle up top and spin to win in the arena." },
  "chef.l4":    { zh: "每赢一回合得一分，赢下整场再加三分。",
    py: ["měi","yíng","yì","huí","hé","dé","yì","fēn","yíng","xià","zhěng","chǎng","zài","jiā","sān","fēn"],
    en: "Each round won earns 1 ★; win the whole match for 3 more." },
  "chef.l5":    { zh: "积分到手，就能点下面的美食啦。",
    py: ["jī","fēn","dào","shǒu","jiù","néng","diǎn","xià","miàn","de","měi","shí","la"],
    en: "With ★ in hand, you can order any dish below." },
  "chef.l6":    { zh: "对了——那个红色按钮，你就当没看见。",
    py: ["duì","le","nà","gè","hóng","sè","àn","niǔ","nǐ","jiù","dāng","méi","kàn","jiàn"],
    en: "Oh — and that red button? Best you never saw it." },
  "press.start":{ zh: "开始游戏", py: ["kāi", "shǐ", "yóu", "xì"], en: "Press Start" },
  "do.not.press": { zh: "请勿按下", py: ["qǐng", "wù", "àn", "xià"], en: "Do Not Press" },
  // ---- menu section ----
  "menu.title": { zh: "菜单", py: ["cài", "dān"], en: "The Wares" },
  "menu.kana":  { zh: "品目", py: ["pǐn", "mù"], en: "Bill of fare" },
  "menu.sub":   { zh: "旅人啊，用积分明智地点餐吧。",
    py: ["lǚ","rén","a","yòng","jī","fēn","míng","zhì","de","diǎn","cān","ba"],
    en: "Spend your ★ points wisely, traveler." },
  "menu.buy":   { zh: "加入", py: ["jiā", "rù"], en: "Add" },
  // ---- about / story ----
  "story.title":{ zh: "我们的故事", py: ["wǒ", "men", "de", "gù", "shi"], en: "Our Story" },
  "story.kana": { zh: "传说", py: ["chuán", "shuō"], en: "Legend" },
  "story.p1":   { zh: "白天，旋转寿司供应着全城最利落的握寿司。米饭一气呵成地捏成，刀工干净利落。常客们说，柜台总在微微嗡鸣，仿佛底下有什么东西一直在旋转。",
    py: ["bái","tiān","xuán","zhuàn","shòu","sī","gōng","yìng","zhe","quán","chéng","zuì","lì","luo","de","wò","shòu","sī","mǐ","fàn","yí","qì","hē","chéng","de","niē","chéng","dāo","gōng","gān","jìng","lì","luo","cháng","kè","men","shuō","guì","tái","zǒng","zài","wēi","wēi","wēng","míng","fǎng","fú","dǐ","xià","yǒu","shén","me","dōng","xi","yì","zhí","zài","xuán","zhuàn"],
    en: "By day, Spin Sushi serves the sharpest nigiri in the city. The rice is pressed in a single motion. The cuts are clean. Regulars say the counter hums faintly, like something underneath is always spinning." },
  "story.p2":   { zh: "他们没说错。地板之下，沉睡着一座正规的 Beyblade X 战斗盘。银次郎师傅绝口不提那个红色按钮。你不该按下它。",
    py: ["tā","men","méi","shuō","cuò","dì","bǎn","zhī","xià","chén","shuì","zhe","yí","zuò","zhèng","guī","de","zhàn","dòu","pán","yín","cì","láng","shī","fu","jué","kǒu","bù","tí","nà","gè","hóng","sè","àn","niǔ","nǐ","bù","gāi","àn","xià","tā"],
    en: "They're not wrong. Beneath the floor sleeps a regulation Beyblade X stadium. Master Ginjiro won't speak of the red button. You shouldn't press it." },
  // ---- cart drawer ----
  "cart.title": { zh: "你的订单", py: ["nǐ", "de", "dìng", "dān"], en: "Your Order" },
  "cart.total": { zh: "合计", py: ["hé", "jì"], en: "Total" },
  "cart.checkout": { zh: "下单", py: ["xià", "dān"], en: "Place Order" },
  "cart.confirm": { zh: "已下单！开动啦", py: ["yǐ","xià","dān","kāi","dòng","la"], en: "Order up! Itadakimasu 🥢" },
  "cart.empty": { zh: "你的托盘空空如也。", py: ["nǐ","de","tuō","pán","kōng","kōng","rú","yě"], en: "Your tray is empty." },
  // ---- arena ----
  "arena.you":   { zh: "你", py: ["nǐ"], en: "You" },
  "arena.rival": { zh: "对手", py: ["duì", "shǒu"], en: "Rival" },
  "arena.spin.right": { zh: "右旋", py: ["yòu", "xuán"], en: "Right" },
  "arena.spin.left":  { zh: "左旋", py: ["zuǒ", "xuán"], en: "Left" },
  "arena.spin.label": { zh: "旋向", py: ["xuán", "xiàng"], en: "Spin" },
  "arena.charge": { zh: "蓄力发射", py: ["xù", "lì", "fā", "shè"], en: "Hold to Charge" },
  "arena.special": { zh: "必杀技", py: ["bì", "shā", "jì"], en: "Special" },
  "arena.next":   { zh: "下一回合", py: ["xià", "yì", "huí", "hé"], en: "Next Round" },
  "arena.replay": { zh: "重打本回合", py: ["chóng", "dǎ", "běn", "huí", "hé"], en: "Replay Round" },
  "arena.rematch": { zh: "再来一局", py: ["zài", "lái", "yì", "jú"], en: "New Match" },
  "arena.exit":   { zh: "返回车库", py: ["fǎn", "huí", "chē", "kù"], en: "Exit to Garage" },
  "arena.angle":  { zh: "角度", py: ["jiǎo", "dù"], en: "Angle" },
  "arena.power":  { zh: "力量", py: ["lì", "liàng"], en: "Power" },
  "arena.burst":  { zh: "爆气", py: ["bào", "qì"], en: "Burst" },
  "arena.battle": { zh: "开战！", py: ["kāi", "zhàn"], en: "Battle!" },
  "arena.ringout": { zh: "出界！", py: ["chū", "jiè"], en: "Ring Out!" },
  "arena.spinout": { zh: "停转！", py: ["tíng", "zhuàn"], en: "Spin Out!" },
  "arena.draw":   { zh: "平局", py: ["píng", "jú"], en: "Draw" },
  "arena.round.won":  { zh: "本回合胜", py: ["běn", "huí", "hé", "shèng"], en: "Round Won" },
  "arena.round.lost": { zh: "本回合负", py: ["běn", "huí", "hé", "fù"], en: "Round Lost" },
  "arena.match.won":  { zh: "比赛胜利！", py: ["bǐ", "sài", "shèng", "lì"], en: "Match Won!" },
  "arena.match.lost": { zh: "比赛失败", py: ["bǐ", "sài", "shī", "bài"], en: "Match Lost" },
  "arena.clash":  { zh: "碰撞！", py: ["pèng", "zhuàng"], en: "Clash!" },
  "arena.smash":  { zh: "猛击！", py: ["měng", "jī"], en: "Smash!" },
  "arena.megahit": { zh: "超强一击！", py: ["chāo", "qiáng", "yì", "jī"], en: "Mega Hit!" },
  "arena.special.go": { zh: "必杀技！", py: ["bì", "shā", "jì"], en: "Special!" },
  "arena.rival.special": { zh: "对手必杀技！", py: ["duì", "shǒu", "bì", "shā", "jì"], en: "Rival Special!" },
  "arena.xtreme": { zh: "极速冲刺！", py: ["jí", "sù", "chōng", "cì"], en: "Xtreme Dash!" },
  "arena.rules":  { zh: "把对手撞出场地（出界），或耗尽其旋转（停转）。先赢两回合者获胜。",
    py: ["bǎ","duì","shǒu","zhuàng","chū","chǎng","dì","chū","jiè","huò","hào","jìn","qí","xuán","zhuàn","tíng","zhuàn","xiān","yíng","liǎng","huí","hé","zhě","huò","shèng"],
    en: "Knock the rival out of the ring (RING OUT), or outspin them (SPIN OUT). First to 2 round wins takes the match." },
  "arena.title": { zh: "陀螺竞技场", py: ["tuó", "luó", "jìng", "jì", "chǎng"], en: "Beyblade Arena" },
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
    if (el) { speak(el.dataset.speak); el.classList.toggle("show-py"); }
  });
}
