// parts.js — curated beyblade parts (data only, no DOM). Stats + images are a
// curated subset adapted from beybrew (see assets/parts/SOURCE.md). Each blade /
// ratchet carries { attack, defense, stamina }; each bit additionally carries
// { xDash, burstResistance }. `image` is a path under assets/parts/.

export const BLADES = [
  { id: "samurai-saber",  name: { zh: "武士剑", py: ["wǔ","shì","jiàn"], en: "Samurai Saber" }, image: "assets/parts/BladeSamuraiSaber.webp", attack: 65, defense: 20, stamina: 25 },
  { id: "dran-buster",    name: { zh: "爆裂破坏者", py: ["bào","liè","pò","huài","zhě"], en: "Dran Buster" }, image: "assets/parts/BladeDranBuster.webp",   attack: 75, defense: 25, stamina: 15 },
  { id: "knight-mail",    name: { zh: "骑士铠甲", py: ["qí","shì","kǎi","jiǎ"], en: "Knight Mail" }, image: "assets/parts/BladeKnightMail.webp",   attack: 15, defense: 70, stamina: 40 },
  { id: "clock-mirage",   name: { zh: "时钟幻影", py: ["shí","zhōng","huàn","yǐng"], en: "Clock Mirage" }, image: "assets/parts/BladeClockMirage.webp",  attack: 10, defense: 10, stamina: 80 },
  { id: "hellshammer",    name: { zh: "地狱之锤", py: ["dì","yù","zhī","chuí"], en: "HellsHammer" }, image: "assets/parts/BladeHellsHammer.webp",  attack: 50, defense: 25, stamina: 25 },
  { id: "golem-rock",     name: { zh: "巨人岩石", py: ["jù","rén","yán","shí"], en: "Golem Rock" }, image: "assets/parts/BladeGolemRock.webp",    attack: 35, defense: 65, stamina: 15 },
];

export const RATCHETS = [
  { id: "3-60", name: { zh: "3-60", py: [], en: "3-60" }, image: "assets/parts/Ratchet3-60.webp", attack: 15, defense:  9, stamina:  6 },
  { id: "1-80", name: { zh: "1-80", py: [], en: "1-80" }, image: "assets/parts/Ratchet1-80.webp", attack: 17, defense:  4, stamina:  9 },
  { id: "3-85", name: { zh: "3-85", py: [], en: "3-85" }, image: "assets/parts/Ratchet3-85.webp", attack:  5, defense: 15, stamina: 10 },
  { id: "0-80", name: { zh: "0-80", py: [], en: "0-80" }, image: "assets/parts/Ratchet0-80.webp", attack:  3, defense: 12, stamina: 15 },
  { id: "6-60", name: { zh: "6-60", py: [], en: "6-60" }, image: "assets/parts/Ratchet6-60.webp", attack: 14, defense:  8, stamina:  8 },
  { id: "m-85", name: { zh: "M-85", py: [], en: "M-85" }, image: "assets/parts/RatchetM-85.webp", attack:  8, defense: 19, stamina: 13 },
];

export const BITS = [
  { id: "zap",          name: { zh: "电击", py: ["diàn","jī"], en: "Zap" }, image: "assets/parts/BitZap.webp",         attack: 30, defense: 20, stamina: 15, xDash: 35, burstResistance: 80 },
  { id: "ignition",     name: { zh: "点火", py: ["diǎn","huǒ"], en: "Ignition" }, image: "assets/parts/BitIgnition.webp",    attack: 50, defense: 15, stamina:  5, xDash: 30, burstResistance: 80 },
  { id: "under-needle", name: { zh: "下针", py: ["xià","zhēn"], en: "Under Needle" }, image: "assets/parts/BitUnderNeedle.webp", attack: 10, defense: 60, stamina: 20, xDash: 10, burstResistance: 30 },
  { id: "yield",        name: { zh: "缓冲", py: ["huǎn","chōng"], en: "Yield" }, image: "assets/parts/BitYielding.webp",    attack: 10, defense: 15, stamina: 65, xDash: 10, burstResistance: 30 },
  { id: "gear-rush",    name: { zh: "齿轮冲刺", py: ["chǐ","lún","chōng","cì"], en: "Gear Rush" }, image: "assets/parts/BitGearRush.webp",    attack: 45, defense: 10, stamina: 10, xDash: 35, burstResistance: 80 },
  { id: "gear-ball",    name: { zh: "齿轮球", py: ["chǐ","lún","qiú"], en: "Gear Ball" }, image: "assets/parts/BitGearBall.webp",    attack: 10, defense: 15, stamina: 45, xDash: 30, burstResistance: 30 },
];
