// arena.js — canvas battle. Pure physics comes from physics.js; round/score
// state comes from match.js. This file is all DOM/canvas wiring + game feel.
import { stepBey, resolveCollision, decideOutcome, distance, aiSteer, tryXtremeDash } from "./physics.js";
import { newMatch, recordRound, WIN_TARGET } from "./match.js";
import * as sfx from "./sound.js";

const STADIUM_PARAMS = { dt: 1, friction: 0.012, spinDecay: 0.08, centering: 0.0016 };
const COLLISION = { restitution: 1.05, collisionSpinDrain: 1.5, superDrain: 25, oppositeSpinMult: 2.2, sameSpinMult: 0.7 };
const START_SPIN = 100;
const BURST_GAIN = 20;        // player burst-meter % gained per clash
const AI_BURST_GAIN = 17;     // rival charges its special a touch slower than you
const AI_SPIN_BONUS = 1.0;    // rival no longer launches with a stamina advantage
const AI_AGGRESSION = 0.7;    // rival steers less relentlessly (difficulty)
const SPECIAL_DASH = 8;       // velocity impulse added on special activation
const STREAK_KEY = "arena.streak";
// X-Celerator rail band (as fractions of the stadium radius) + dash cooldown.
const RAIL = { innerFrac: 0.62, outerFrac: 0.70, cooldown: 40 };
// Gear system: high gear dashes hard but burns stamina and engages easily;
// standard is gentler and needs more speed to engage.
const GEARS = {
  high:     { dashImpulse: 7.5, engageSpeed: 3.5, spinCost: 4 },
  standard: { dashImpulse: 4.0, engageSpeed: 5.0, spinCost: 1.5 },
};

function makeBey(name, x, y, color, dir = 1) {
  return {
    name, x, y, vx: 0, vy: 0, spin: START_SPIN, radius: 22, mass: 1,
    alive: true, color, special: false, dir, dashCd: 0,
    rot: 0,        // accumulated visual rotation (radians)
    wobble: 0,     // wobble phase for the low-spin death wobble
  };
}

export function mountArena(opts) {
  const {
    overlayEl, canvasEl, angleEl, powerFillEl, launchEl, rematchEl, bannerEl, onExit,
    meterYouEl, meterRivalEl, scoreYouEl, scoreRivalEl, streakEl,
    burstFillEl, specialEl, nextRoundEl, calloutEl, muteEl,
    spinDirEl, gearEl, rivalSetupEl,
  } = opts;
  const ctx = canvasEl.getContext("2d");
  const W = canvasEl.width, H = canvasEl.height;
  const stadium = { cx: W / 2, cy: H / 2, r: W / 2 - 16 };
  const rail = {
    inner: stadium.r * RAIL.innerFrac,
    outer: stadium.r * RAIL.outerFrac,
    cooldown: RAIL.cooldown,
  };

  let player, opponent, phase, raf, charging, power, wasColliding, bursts;
  let playerDir = 1, playerGear = "standard", rivalDir = 1, rivalGear = "standard";
  let bannerTimer, calloutTimer, shakeTimer;
  let match, burstMeter, specialReady, aiBurstMeter;

  // ---- streak persistence (tolerates unavailable/corrupt storage) ----
  function loadStreak() {
    try {
      const v = parseInt(localStorage.getItem(STREAK_KEY), 10);
      return Number.isFinite(v) && v >= 0 ? v : 0;
    } catch { return 0; }
  }
  function persistStreak(n) {
    try { localStorage.setItem(STREAK_KEY, String(n)); } catch { /* non-fatal */ }
  }

  // ---- scoreboard / meters ----
  function pips(n) {
    let s = "";
    for (let i = 0; i < WIN_TARGET; i++) s += i < n ? "●" : "○";
    return s;
  }
  function renderScore() {
    scoreYouEl.textContent = pips(match.you);
    scoreRivalEl.textContent = pips(match.rival);
    streakEl.textContent = "🔥 " + match.streak;
  }
  function updateMeters() {
    meterYouEl.style.width = (100 * Math.max(0, player.spin) / START_SPIN) + "%";
    meterRivalEl.style.width = (100 * Math.max(0, opponent.spin) / START_SPIN) + "%";
  }

  // ---- pre-match setup controls (spin direction + gear) ----
  function dirLabel(dir) { return dir === 1 ? "↻ RIGHT" : "↺ LEFT"; }

  function renderRivalSetup() {
    rivalSetupEl.textContent =
      `RIVAL  ${dirLabel(rivalDir)} · ${rivalGear.toUpperCase()} GEAR`;
  }

  // Reflect the player's current spinDir/gear in the toggle button states.
  function syncSetupControls() {
    spinDirEl.querySelectorAll(".seg-btn").forEach((b) => {
      const on = Number(b.dataset.dir) === playerDir;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    gearEl.querySelectorAll(".seg-btn").forEach((b) => {
      const on = b.dataset.gear === playerGear;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }

  function setSetupEnabled(on) {
    [...spinDirEl.querySelectorAll(".seg-btn"), ...gearEl.querySelectorAll(".seg-btn")]
      .forEach((b) => { b.disabled = !on; });
  }

  // ---- match / round lifecycle ----
  function startMatch() {
    match = newMatch(loadStreak());
    renderScore();
    startRound();
  }

  function startRound() {
    cancelAnimationFrame(raf);
    rivalDir = Math.random() < 0.5 ? 1 : -1;
    rivalGear = Math.random() < 0.5 ? "high" : "standard";
    player = makeBey("You", stadium.cx - 120, stadium.cy, "#2bf2ff", playerDir);
    opponent = makeBey("Rival", stadium.cx + 120, stadium.cy, "#ff2bd6", rivalDir);
    phase = "ready"; // ready -> spinning -> done
    charging = false;
    power = 0;
    wasColliding = false;
    bursts = [];
    burstMeter = 0;
    aiBurstMeter = 0;
    specialReady = false;
    clearTimeout(bannerTimer);
    clearTimeout(calloutTimer);
    powerFillEl.style.width = "0%";
    burstFillEl.style.width = "0%";
    launchEl.disabled = false;
    launchEl.textContent = "HOLD TO CHARGE";
    specialEl.disabled = true;
    specialEl.classList.remove("ready");
    rematchEl.hidden = true;
    nextRoundEl.hidden = true;
    bannerEl.hidden = true;
    calloutEl.hidden = true;
    setSetupEnabled(true);
    syncSetupControls();
    renderRivalSetup();
    draw();
  }

  // Show banner text, restarting the CSS pop animation each time.
  function showBanner(text) {
    bannerEl.hidden = true;
    void bannerEl.offsetWidth; // force reflow so banner-pop replays
    bannerEl.textContent = text;
    bannerEl.hidden = false;
  }

  function showCallout(text) {
    calloutEl.hidden = true;
    void calloutEl.offsetWidth; // replay callout-pop
    calloutEl.textContent = text;
    calloutEl.hidden = false;
    clearTimeout(calloutTimer);
    calloutTimer = setTimeout(() => { calloutEl.hidden = true; }, 700);
  }

  // ---- charge-launch input ----
  function startCharge() {
    if (phase !== "ready") return;
    sfx.unlockAudio(); // first user gesture: allow audio to play
    charging = true;
    chargeTick();
  }
  function chargeTick() {
    if (!charging) return;
    power = Math.min(100, power + 2.5);
    powerFillEl.style.width = power + "%";
    if (power >= 100) return; // cap; release to launch
    raf = requestAnimationFrame(chargeTick);
  }
  function release() {
    if (!charging || phase !== "ready") return;
    charging = false;
    cancelAnimationFrame(raf);
    launchPlayer();
  }
  function cancelCharge() {
    if (!charging) return;
    charging = false;
    cancelAnimationFrame(raf);
  }

  function launchPlayer() {
    const angle = (Number(angleEl.value) * Math.PI) / 180;
    const speed = 2 + (power / 100) * 9;
    player.vx = Math.cos(angle) * speed;
    player.vy = Math.sin(angle) * speed;
    player.spin = START_SPIN * (0.6 + 0.4 * (power / 100));
    sfx.launch(power / 100);

    // AI launches a committed strike toward the player, but its aim now carries
    // a wider spread and its speed is a bit lower, so it whiffs more often and
    // hits softer. It still steers during the round, just less relentlessly.
    const aiAngle = Math.atan2(player.y - opponent.y, player.x - opponent.x) + (Math.random() - 0.5) * 0.6;
    const aiSpeed = 6 + Math.random() * 3;
    opponent.vx = Math.cos(aiAngle) * aiSpeed;
    opponent.vy = Math.sin(aiAngle) * aiSpeed;
    opponent.spin = START_SPIN * AI_SPIN_BONUS;

    phase = "spinning";
    setSetupEnabled(false);
    launchEl.disabled = true;
    bannerEl.hidden = true;
    sfx.startSpinHum();
    loop();
  }

  // ---- burst special ----
  function fillBurst(amount) {
    if (specialReady) return;
    burstMeter = Math.min(100, burstMeter + amount);
    burstFillEl.style.width = burstMeter + "%";
    if (burstMeter >= 100) {
      specialReady = true;
      specialEl.disabled = false;
      specialEl.classList.add("ready");
    }
  }
  function activateSpecial() {
    if (!specialReady || phase !== "spinning") return;
    player.special = true; // consumed on next collision in resolveCollision
    const ang = Math.atan2(opponent.y - player.y, opponent.x - player.x);
    player.vx += Math.cos(ang) * SPECIAL_DASH;
    player.vy += Math.sin(ang) * SPECIAL_DASH;
    player.spin = Math.min(START_SPIN, player.spin + 10); // small spin kick
    specialReady = false;
    burstMeter = 0;
    burstFillEl.style.width = "0%";
    specialEl.disabled = true;
    specialEl.classList.remove("ready");
    sfx.special();
    showCallout("SPECIAL!");
  }

  // AI special: charges its own meter on every clash and unleashes a dash the
  // moment it's full. This is a big part of the added difficulty.
  function fillAiBurst(amount) {
    if (opponent.special) return;
    aiBurstMeter = Math.min(100, aiBurstMeter + amount);
    if (aiBurstMeter >= 100 && phase === "spinning") activateAiSpecial();
  }
  function activateAiSpecial() {
    opponent.special = true; // consumed on next collision in resolveCollision
    const ang = Math.atan2(player.y - opponent.y, player.x - opponent.x);
    opponent.vx += Math.cos(ang) * SPECIAL_DASH;
    opponent.vy += Math.sin(ang) * SPECIAL_DASH;
    opponent.spin = Math.min(START_SPIN * AI_SPIN_BONUS, opponent.spin + 10);
    aiBurstMeter = 0;
    sfx.special();
    showCallout("RIVAL SPECIAL!");
  }

  // ---- impact reaction (callout + shake + burst gain) ----
  function onImpact(impact, x, y) {
    spawnBurst(x, y, "#ffffff");
    fillBurst(BURST_GAIN);
    fillAiBurst(AI_BURST_GAIN);
    sfx.clash(Math.min(1, impact / 18));
    let tier, text;
    if (impact >= 16) { tier = "lg"; text = "MEGA HIT!"; }
    else if (impact >= 9) { tier = "md"; text = "SMASH!"; }
    else { tier = "sm"; text = "CLASH!"; }
    showCallout(text);
    triggerShake(tier);
  }

  // Xtreme Dash reaction: trailing afterimage along the heading + callout + sfx.
  function onXtremeDash(b) {
    const speed = Math.hypot(b.vx, b.vy) || 1;
    const ux = b.vx / speed, uy = b.vy / speed;
    for (let i = 1; i <= 3; i++) spawnBurst(b.x - ux * i * 14, b.y - uy * i * 14, b.color);
    showCallout("XTREME DASH!");
    triggerShake("sm");
    sfx.xtreme();
  }

  // ---- main loop ----
  function loop() {
    const pPrev = player.alive, oPrev = opponent.alive;

    // AI agency: steer the rival each frame (seek when ahead, survive when behind)
    const steer = aiSteer(opponent, player, stadium, AI_AGGRESSION);
    opponent.vx += steer.ax;
    opponent.vy += steer.ay;

    player = stepBey(player, stadium, STADIUM_PARAMS);
    opponent = stepBey(opponent, stadium, STADIUM_PARAMS);

    // X-Celerator rail: tick dash cooldowns, then try to engage the Xtreme Dash
    if (player.dashCd > 0) player = { ...player, dashCd: player.dashCd - 1 };
    if (opponent.dashCd > 0) opponent = { ...opponent, dashCd: opponent.dashCd - 1 };
    const pDash = tryXtremeDash(player, stadium, rail, GEARS[playerGear]);
    player = pDash.bey;
    if (pDash.fired) onXtremeDash(player);
    const oDash = tryXtremeDash(opponent, stadium, rail, GEARS[rivalGear]);
    opponent = oDash.bey;
    if (oDash.fired) onXtremeDash(opponent);

    // advance visual rotation + low-spin wobble from current spin speed
    spinVisuals(player);
    spinVisuals(opponent);

    // spin hum tracks combined remaining spin energy
    sfx.updateSpinHum((player.spin + opponent.spin) / (2 * START_SPIN));

    // impact burst on the frame the beys first make contact
    const touching = distance(player.x, player.y, opponent.x, opponent.y) <= player.radius + opponent.radius;
    if (touching && !wasColliding) {
      const impact = Math.hypot(player.vx - opponent.vx, player.vy - opponent.vy);
      onImpact(impact, (player.x + opponent.x) / 2, (player.y + opponent.y) / 2);
    }
    wasColliding = touching;

    [player, opponent] = resolveCollision(player, opponent, COLLISION);
    stepBursts();
    draw();

    const outcome = decideOutcome(player, opponent);
    if (outcome) {
      // ring-out vs spin-out is decided by where the bey ended up: a bey that
      // died outside the stadium radius was knocked out (ring-out); otherwise
      // its spin ran down (spin-out).
      const ringout =
        (pPrev && !player.alive && distance(player.x, player.y, stadium.cx, stadium.cy) > stadium.r) ||
        (oPrev && !opponent.alive && distance(opponent.x, opponent.y, stadium.cx, stadium.cy) > stadium.r);
      return finishRound(outcome, ringout ? "ringout" : "spinout");
    }
    raf = requestAnimationFrame(loop);
  }

  function finishRound(outcome, reason) {
    phase = "done";
    cancelAnimationFrame(raf);
    sfx.stopSpinHum();
    if (outcome !== "draw") {
      if (reason === "ringout") sfx.ringOut(); else sfx.spinOut();
    }
    launchEl.disabled = true;
    specialEl.disabled = true;
    specialEl.classList.remove("ready");

    match = recordRound(match, outcome);
    updateMeters();
    renderScore();

    if (outcome === "draw") {
      triggerShake("md");
      showBanner("DRAW");
      bannerTimer = setTimeout(() => {
        showBanner("REPLAY ROUND");
        nextRoundEl.textContent = "Replay Round";
        nextRoundEl.hidden = false;
      }, 800);
      return;
    }

    triggerShake(reason === "ringout" ? "lg" : "md");
    if (reason === "ringout") { spawnBurst(stadium.cx, stadium.cy, "#ff2bd6"); draw(); }
    showBanner(reason === "ringout" ? "RING OUT!" : "SPIN OUT!");

    bannerTimer = setTimeout(() => {
      if (match.matchOver) {
        const won = match.matchWinner === "player";
        persistStreak(match.streak);
        renderScore();
        if (won) sfx.win(); else sfx.lose();
        showBanner(won ? "MATCH WON!" : "MATCH LOST");
        rematchEl.textContent = "New Match";
        rematchEl.hidden = false;
      } else {
        showBanner(outcome === "player" ? "ROUND WON" : "ROUND LOST");
        nextRoundEl.textContent = "Next Round";
        nextRoundEl.hidden = false;
      }
    }, 800);
  }

  // Advance a bey's spin angle and wobble based on its remaining spin. Faster
  // spin -> faster rotation; as spin runs low the top wobbles like a real one.
  function spinVisuals(b) {
    if (!b.alive) return;
    const frac = Math.max(0, b.spin) / START_SPIN;
    b.rot += (b.dir ?? 1) * (0.25 + frac * 0.9); // direction-aware angular speed
    b.wobble += 0.3;
  }

  // ---- impact bursts (transient expanding rings) ----
  function spawnBurst(x, y, color) {
    bursts.push({ x, y, r: 6, life: 1, color });
  }
  function stepBursts() {
    bursts.forEach((p) => { p.r += 6; p.life -= 0.08; });
    bursts = bursts.filter((p) => p.life > 0);
  }

  // ---- rendering ----
  function draw() {
    updateMeters();
    ctx.clearRect(0, 0, W, H);

    // stadium bowl: dark dished floor with concentric guide rings
    const floor = ctx.createRadialGradient(
      stadium.cx, stadium.cy, stadium.r * 0.1,
      stadium.cx, stadium.cy, stadium.r
    );
    floor.addColorStop(0, "rgba(20,28,40,.9)");
    floor.addColorStop(0.7, "rgba(12,18,28,.85)");
    floor.addColorStop(1, "rgba(5,8,14,.95)");
    ctx.fillStyle = floor;
    ctx.beginPath();
    ctx.arc(stadium.cx, stadium.cy, stadium.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(43,242,255,.12)";
    ctx.lineWidth = 1.5;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(stadium.cx, stadium.cy, stadium.r * (i / 4), 0, Math.PI * 2);
      ctx.stroke();
    }

    // X-Celerator rail — a bright dashed gear-track band on the floor
    ctx.save();
    ctx.strokeStyle = "rgba(255,214,74,.5)";
    ctx.lineWidth = rail.outer - rail.inner;
    ctx.setLineDash([14, 10]);
    ctx.shadowColor = "rgba(255,214,74,.5)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(stadium.cx, stadium.cy, (rail.inner + rail.outer) / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.setLineDash([]);

    // stadium rim
    ctx.strokeStyle = "rgba(43,242,255,.5)";
    ctx.lineWidth = 4;
    ctx.shadowColor = "rgba(43,242,255,.6)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(stadium.cx, stadium.cy, stadium.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    drawBey(player);
    drawBey(opponent);
    drawBursts();
  }

  function drawBursts() {
    bursts.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  }

  // Draw a hex blade ring (the metal attack ring of a beyblade).
  function bladeRing(r, blades, color, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    for (let i = 0; i < blades; i++) {
      const a = (i / blades) * Math.PI * 2;
      const a2 = a + (Math.PI * 2) / blades;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      // swept trailing edge gives each blade a curved, aggressive look
      ctx.lineTo(Math.cos(a2 - 0.18) * r, Math.sin(a2 - 0.18) * r);
      ctx.lineTo(Math.cos(a2 - 0.18) * r * 0.62, Math.sin(a2 - 0.18) * r * 0.62);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawBey(b) {
    if (!b.alive) return;
    const frac = Math.max(0, b.spin) / START_SPIN;
    const r = b.radius * (0.82 + 0.18 * frac);
    // wobble grows as the top loses spin (a dying top tips and circles)
    const wob = (1 - frac) * 4;
    const wx = Math.cos(b.wobble) * wob;
    const wy = Math.sin(b.wobble * 1.3) * wob * 0.6;

    ctx.save();

    // contact shadow on the stadium floor for depth
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(b.x + 4, b.y + 8, r * 1.05, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.translate(b.x + wx, b.y + wy);

    // motion-blur energy ring: brighter/larger the faster it spins
    ctx.save();
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = b.color;
    ctx.globalAlpha = 0.18 + 0.32 * frac;
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const sweep = 0.7 + frac * 1.4;
      const off = b.rot * 0.5 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.22, off, off + sweep);
      ctx.stroke();
    }
    ctx.restore();

    // spinning metal attack ring — ghosted copies simulate motion blur
    ctx.save();
    ctx.rotate(b.rot);
    bladeRing(r, 6, b.color, 1);
    ctx.rotate(-0.18);
    bladeRing(r, 6, b.color, 0.35 * frac);
    ctx.rotate(-0.18);
    bladeRing(r, 6, b.color, 0.18 * frac);
    ctx.restore();
    ctx.globalAlpha = 1;

    // metallic disc body (radial gradient = brushed-metal sheen)
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 0.78);
    g.addColorStop(0, "#f4f7fa");
    g.addColorStop(0.45, "#aeb7c2");
    g.addColorStop(0.8, "#5b636e");
    g.addColorStop(1, "#2c3138");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    ctx.fill();

    // colored hub ring
    ctx.strokeStyle = b.color;
    ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    // center bolt with screw cross and specular highlight
    const bg = ctx.createRadialGradient(-r * 0.12, -r * 0.12, 1, 0, 0, r * 0.32);
    bg.addColorStop(0, "#ffffff");
    bg.addColorStop(0.6, "#c9d2dc");
    bg.addColorStop(1, "#6b7480");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(40,46,54,.8)";
    ctx.lineWidth = 2;
    ctx.save();
    ctx.rotate(b.rot * 0.4);
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, 0); ctx.lineTo(r * 0.2, 0);
    ctx.moveTo(0, -r * 0.2); ctx.lineTo(0, r * 0.2);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  function triggerShake(tier = "md") {
    const cls = "shake-" + tier;
    overlayEl.classList.remove("shake-sm", "shake-md", "shake-lg");
    void overlayEl.offsetWidth; // restart animation
    overlayEl.classList.add(cls);
    clearTimeout(shakeTimer);
    shakeTimer = setTimeout(() => overlayEl.classList.remove(cls), 600);
  }

  // ---- open/close ----
  function open() {
    cancelAnimationFrame(raf); // stop any ghost loop before re-initialising
    overlayEl.hidden = false;
    document.body.classList.add("battling");
    triggerShake("lg");
    startMatch();
    showBanner("BATTLE!");
    bannerTimer = setTimeout(() => { if (phase === "ready") bannerEl.hidden = true; }, 900);
  }
  function close() {
    cancelAnimationFrame(raf);
    sfx.stopSpinHum();
    clearTimeout(bannerTimer);
    clearTimeout(calloutTimer);
    clearTimeout(shakeTimer);
    overlayEl.hidden = true;
    document.body.classList.remove("battling");
    if (onExit) onExit();
  }

  // ---- listeners ----
  launchEl.addEventListener("mousedown", startCharge);
  launchEl.addEventListener("mouseup", release);
  launchEl.addEventListener("mouseleave", release);
  launchEl.addEventListener("touchstart", (e) => { e.preventDefault(); startCharge(); }, { passive: false });
  launchEl.addEventListener("touchend", (e) => { e.preventDefault(); release(); }, { passive: false });
  launchEl.addEventListener("touchcancel", cancelCharge, { passive: true });
  specialEl.addEventListener("click", activateSpecial);
  if (muteEl) {
    muteEl.addEventListener("click", () => {
      sfx.unlockAudio();
      const muted = !sfx.isMuted();
      sfx.setMuted(muted);
      muteEl.textContent = muted ? "🔇" : "🔊";
      muteEl.setAttribute("aria-pressed", String(muted));
      muteEl.title = muted ? "Unmute sound" : "Mute sound";
    });
  }
  nextRoundEl.addEventListener("click", startRound);
  rematchEl.addEventListener("click", startMatch);

  // pre-match toggles — only editable while a round hasn't launched
  spinDirEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn || phase !== "ready") return;
    playerDir = Number(btn.dataset.dir);
    if (player) player.dir = playerDir; // reflect on the idle pre-launch bey
    syncSetupControls();
    draw();
  });
  gearEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn || phase !== "ready") return;
    playerGear = btn.dataset.gear;
    syncSetupControls();
  });
  syncSetupControls();

  return { open, close };
}
