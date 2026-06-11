// arena.js — canvas battle. Pure physics comes from physics.js; round/score
// state comes from match.js. This file is all DOM/canvas wiring + game feel.
import { stepBey, resolveCollision, decideOutcome, distance, aiSteer, stepRail, tryCatchRail, cardioidPoint, CARDIOID_MAX_R } from "./physics.js";
import { newMatch, recordRound, POINT_TARGET, FINISH_POINTS } from "./match.js";
import { shopPointsForFinish } from "./points.js";
import * as sfx from "./sound.js";
import { combineStats, statsToPhysics } from "./build.js";
import { BLADES, RATCHETS, BITS } from "./parts.js";
import { biHtml, biHtmlEntry } from "./i18n.js";

const STADIUM_PARAMS = { dt: 1, friction: 0.012, spinDecay: 0.08, centering: 0.0016, wobbleSpin: 28, burstDecay: 0.25 };
const COLLISION = { restitution: 1.05, collisionSpinDrain: 1.5, superDrain: 25, oppositeSpinMult: 2.2, sameSpinMult: 0.7,
  spinSteal: 0.12, scrapeCoupling: 1.1, burstGain: 0.6 };
const START_SPIN = 100;
const BURST_GAIN = 20;        // player burst-meter % gained per clash
const AI_BURST_GAIN = 17;     // rival charges its special a touch slower than you
const AI_AGGRESSION = 0.7;    // rival steers less relentlessly (difficulty)
const SPECIAL_DASH = 8;       // velocity impulse added on special activation
const STREAK_KEY = "arena.streak";
// X-Celerator cardioid rail: how much of the bowl it fills, plus tuning for
// catching and riding it.
const RAIL_FIT = 0.72;        // cardioid max radius as a fraction of bowl radius
const RAIL_COOLDOWN = 60;     // frames after a release before a bey can re-catch
const RAIL_CATCH_DIST = 18;   // how close (px) a bey must pass to catch the rail
const RAIL_ARC_SCALE = 90;    // larger → less theta advanced per unit ride speed
// Fallback rail gear when a bey has no build profile (real beys derive theirs
// from the Bit's xDash via statsToPhysics).
const STANDARD_GEAR = { engageSpeed: 4.5, rideAccel: 0.5, rideCap: 10, spinCost: 1.5, rideSpinDrain: 0.10, minRideSpeed: 5 };

function makeBey(name, x, y, color, dir = 1, profile = {}) {
  const {
    spin0 = START_SPIN, mass = 1, atkMult = 1, defMult = 1,
    launchMult = 1, spinDecayMult = 1, centeringMult = 1, gear = STANDARD_GEAR,
  } = profile;
  return {
    name, x, y, vx: 0, vy: 0, spin: spin0, spin0, radius: 22, mass,
    inertia: mass,                       // heavier beys hold spin longer
    burstStress: 0, burst: false,
    // burst resistance is encoded in centeringMult (1..1.8); map it to a stress cap
    burstThreshold: 70 + 100 * Math.min(1, Math.max(0, (centeringMult - 1) / 0.8)),
    alive: true, color, special: false, dir, dashCd: 0,
    railed: false, railTheta: 0, railDir: 1, railSpeed: 0,
    atkMult, defMult, spinDecayMult, centeringMult, launchMult, gear,
    rot: 0,        // accumulated visual rotation (radians)
    wobble: 0,     // wobble phase for the low-spin death wobble
  };
}

export function mountArena(opts) {
  const {
    overlayEl, canvasEl, angleEl, powerFillEl, launchEl, rematchEl, bannerEl, onExit,
    meterYouEl, meterRivalEl, scoreYouEl, scoreRivalEl, streakEl,
    burstFillEl, specialEl, nextRoundEl, calloutEl, muteEl,
    spinDirEl, rivalSetupEl, buildYouEl, buildRivalEl,
  } = opts;
  const ctx = canvasEl.getContext("2d");
  const W = canvasEl.width, H = canvasEl.height;
  const stadium = { cx: W / 2, cy: H / 2, r: W / 2 - 16 };
  const rail = {
    cx: stadium.cx, cy: stadium.cy,
    scale: (RAIL_FIT * stadium.r) / CARDIOID_MAX_R,
    rot: Math.PI / 2,            // cusp points downward
    cooldown: RAIL_COOLDOWN,
    catchDist: RAIL_CATCH_DIST,
    arcScale: RAIL_ARC_SCALE,
  };

  // blade-image cache: the bowl draws each bey's blade render, preloaded so it's
  // ready by battle. imgFor returns a cached HTMLImageElement per src.
  const imgCache = new Map();
  function imgFor(src) {
    let im = imgCache.get(src);
    if (!im) { im = new Image(); im.src = src; imgCache.set(src, im); }
    return im;
  }
  BLADES.forEach((b) => imgFor(b.image)); // warm the cache

  let player, opponent, phase, raf, charging, power, wasColliding, bursts;
  let playerDir = 1, rivalDir = 1;
  let playerBuild = { blade: BLADES[0], ratchet: RATCHETS[0], bit: BITS[0] };
  let rivalBuild = { blade: BLADES[0], ratchet: RATCHETS[0], bit: BITS[0] };

  const buildProfile = (b) => statsToPhysics(combineStats(b.blade, b.ratchet, b.bit));
  const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randomBuild = () => ({ blade: randomPick(BLADES), ratchet: randomPick(RATCHETS), bit: randomPick(BITS) });
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
    const filled = Math.min(n, POINT_TARGET);
    for (let i = 0; i < POINT_TARGET; i++) s += i < filled ? "●" : "○";
    return s;
  }
  function renderScore() {
    scoreYouEl.textContent = pips(match.you);
    scoreRivalEl.textContent = pips(match.rival);
    streakEl.textContent = "🔥 " + match.streak;
  }
  function updateMeters() {
    meterYouEl.style.width = (100 * Math.max(0, player.spin) / player.spin0) + "%";
    meterRivalEl.style.width = (100 * Math.max(0, opponent.spin) / opponent.spin0) + "%";
  }

  // ---- pre-match setup controls (spin direction) ----
  function renderRivalSetup() {
    const dirKey = rivalDir === 1 ? "arena.spin.right" : "arena.spin.left";
    rivalSetupEl.innerHTML =
      `${biHtml("arena.rival")} · ${biHtml(dirKey)} · `
      + `${biHtmlEntry(rivalBuild.blade.name)} / ${biHtmlEntry(rivalBuild.ratchet.name)} / ${biHtmlEntry(rivalBuild.bit.name)}`;
  }

  // Reflect the player's current spin direction in the toggle button states.
  function syncSetupControls() {
    spinDirEl.querySelectorAll(".seg-btn").forEach((b) => {
      const on = Number(b.dataset.dir) === playerDir;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }

  function setSetupEnabled(on) {
    spinDirEl.querySelectorAll(".seg-btn").forEach((b) => { b.disabled = !on; });
  }

  // ---- build HUD part images ----
  function renderBuildImages(container, build) {
    container.innerHTML = "";
    [build.blade, build.ratchet, build.bit].forEach((p) => {
      const img = document.createElement("img");
      img.className = "build-img";
      img.src = p.image;
      img.alt = p.name.en;
      img.title = p.name.en;
      img.onerror = () => { img.style.visibility = "hidden"; }; // tolerate missing assets
      container.appendChild(img);
    });
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
    rivalBuild = randomBuild();
    player = makeBey("You", stadium.cx - 120, stadium.cy, "#2bf2ff", playerDir, buildProfile(playerBuild));
    opponent = makeBey("Rival", stadium.cx + 120, stadium.cy, "#ff2bd6", rivalDir, buildProfile(rivalBuild));
    player.img = imgFor(playerBuild.blade.image);
    opponent.img = imgFor(rivalBuild.blade.image);
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
    launchEl.innerHTML = biHtml("arena.charge");
    specialEl.disabled = true;
    specialEl.classList.remove("ready");
    rematchEl.hidden = true;
    nextRoundEl.hidden = true;
    bannerEl.hidden = true;
    calloutEl.hidden = true;
    setSetupEnabled(true);
    syncSetupControls();
    renderRivalSetup();
    renderBuildImages(buildYouEl, playerBuild);
    renderBuildImages(buildRivalEl, rivalBuild);
    draw();
  }

  // Show banner text, restarting the CSS pop animation each time.
  function showBanner(text) {
    bannerEl.hidden = true;
    void bannerEl.offsetWidth; // force reflow so banner-pop replays
    bannerEl.innerHTML = text;
    bannerEl.hidden = false;
  }

  function showCallout(text) {
    calloutEl.hidden = true;
    void calloutEl.offsetWidth; // replay callout-pop
    calloutEl.innerHTML = text;
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
    const speed = (2 + (power / 100) * 9) * player.launchMult;
    player.vx = Math.cos(angle) * speed;
    player.vy = Math.sin(angle) * speed;
    player.spin = player.spin0 * (0.6 + 0.4 * (power / 100));
    sfx.launch(power / 100);

    // AI launches a committed strike toward the player, but its aim now carries
    // a wider spread and its speed is a bit lower, so it whiffs more often and
    // hits softer. It still steers during the round, just less relentlessly.
    const aiAngle = Math.atan2(player.y - opponent.y, player.x - opponent.x) + (Math.random() - 0.5) * 0.6;
    const aiSpeed = (6 + Math.random() * 3) * opponent.launchMult;
    opponent.vx = Math.cos(aiAngle) * aiSpeed;
    opponent.vy = Math.sin(aiAngle) * aiSpeed;
    opponent.spin = opponent.spin0;

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
    player.spin = Math.min(player.spin0, player.spin + 10); // small spin kick
    specialReady = false;
    burstMeter = 0;
    burstFillEl.style.width = "0%";
    specialEl.disabled = true;
    specialEl.classList.remove("ready");
    sfx.special();
    showCallout(biHtml("arena.special.go"));
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
    opponent.spin = Math.min(opponent.spin0, opponent.spin + 10);
    aiBurstMeter = 0;
    sfx.special();
    showCallout(biHtml("arena.rival.special"));
  }

  // ---- impact reaction (callout + shake + burst gain) ----
  function onImpact(impact, x, y) {
    spawnBurst(x, y, "#ffffff");
    fillBurst(BURST_GAIN);
    fillAiBurst(AI_BURST_GAIN);
    sfx.clash(Math.min(1, impact / 18));
    let tier;
    if (impact >= 16) tier = "lg";
    else if (impact >= 9) tier = "md";
    else tier = "sm";
    showCallout(biHtml(tier === "lg" ? "arena.megahit" : tier === "md" ? "arena.smash" : "arena.clash"));
    triggerShake(tier);
  }

  // Xtreme Dash reaction: trailing afterimage along the heading + callout + sfx.
  function onXtremeDash(b) {
    const speed = Math.hypot(b.vx, b.vy) || 1;
    const ux = b.vx / speed, uy = b.vy / speed;
    for (let i = 1; i <= 3; i++) spawnBurst(b.x - ux * i * 14, b.y - uy * i * 14, b.color);
    showCallout(biHtml("arena.xtreme"));
    triggerShake("sm");
    sfx.xtreme();
  }

  // Advance one bey for a frame. A railed bey rides the cardioid (and on release
  // slingshots toward the foe); a free bey moves under normal physics, ticks its
  // cooldown, and may catch the rail.
  function advanceRail(bey, foe) {
    const gear = bey.gear;
    if (bey.railed) {
      let { bey: next, released } = stepRail(bey, rail, gear);
      if (released) {
        // slingshot off the cusp aimed at the foe (the pure layer doesn't know
        // the opponent's position, so we set the release velocity here). A bey
        // that ran its spin out on the rail isn't flagged dead until the next
        // free-physics frame — a one-frame delay that's invisible in play.
        const ang = Math.atan2(foe.y - next.y, foe.x - next.x);
        next = { ...next, vx: Math.cos(ang) * next.railSpeed, vy: Math.sin(ang) * next.railSpeed };
        onXtremeDash(next);
      }
      return next;
    }
    let next = stepBey(bey, stadium, STADIUM_PARAMS);
    if (next.dashCd > 0) next = { ...next, dashCd: next.dashCd - 1 };
    return tryCatchRail(next, rail, gear).bey;
  }

  // ---- main loop ----
  function loop() {
    // AI agency: steer the rival each frame — but only while it's free, not
    // while it's locked onto the rail (the rail dictates its motion).
    if (!opponent.railed) {
      const steer = aiSteer(opponent, player, stadium, AI_AGGRESSION);
      opponent.vx += steer.ax;
      opponent.vy += steer.ay;
    }

    // X-Celerator cardioid rail: railed beys ride the curve and slingshot off the
    // cusp at the foe; free beys move under physics and may catch the rail. Aim
    // uses each foe's start-of-frame position so the two advances stay symmetric.
    const pStart = { x: player.x, y: player.y };
    const oStart = { x: opponent.x, y: opponent.y };
    player = advanceRail(player, oStart);
    opponent = advanceRail(opponent, pStart);

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
      return finishRound(outcome, classifyFinish(outcome));
    }
    raf = requestAnimationFrame(loop);
  }

  // Map the just-finished round to a Beyblade X finish type. Precedence:
  // burst > xtreme > over > spin. The loser is the bey that just died; on a
  // draw the finish is irrelevant (no points awarded).
  function classifyFinish(outcome) {
    if (outcome === "draw") return "spin";
    const loser = outcome === "player" ? opponent : player;
    const winner = outcome === "player" ? player : opponent;
    if (loser.burst) return "burst";
    const outside = distance(loser.x, loser.y, stadium.cx, stadium.cy) > stadium.r;
    if (outside) {
      // a ring-out delivered while the attacker is riding / just released the
      // Xtreme rail (or mid-special) is an Xtreme Finish.
      const xtreme = winner.railed || (winner.dashCd ?? 0) > 0 || winner.special;
      return xtreme ? "xtreme" : "over";
    }
    return "spin";
  }

  function finishRound(outcome, finish) {
    phase = "done";
    cancelAnimationFrame(raf);
    sfx.stopSpinHum();
    if (outcome !== "draw") {
      if (finish === "xtreme") sfx.xtreme();
      else if (finish === "over") sfx.ringOut();
      else if (finish === "burst") sfx.ringOut();
      else sfx.spinOut();
    }
    launchEl.disabled = true;
    specialEl.disabled = true;
    specialEl.classList.remove("ready");

    match = recordRound(match, outcome, finish);
    updateMeters();
    renderScore();

    // Award ★: the finish's point value when the player scored it, plus a
    // bonus on the clinching win.
    const matchWon = match.matchOver && match.matchWinner === "player";
    const earned = shopPointsForFinish(outcome, FINISH_POINTS[finish] ?? 0, matchWon);
    if (earned > 0 && typeof opts.awardPoints === "function") opts.awardPoints(earned);

    if (outcome === "draw") {
      triggerShake("md");
      showBanner(biHtml("arena.draw"));
      bannerTimer = setTimeout(() => {
        showBanner(biHtml("arena.replay"));
        nextRoundEl.innerHTML = biHtml("arena.replay");
        nextRoundEl.hidden = false;
      }, 800);
      return;
    }

    const big = finish === "over" || finish === "xtreme" || finish === "burst";
    triggerShake(big ? "lg" : "md");
    if (big) { spawnBurst(stadium.cx, stadium.cy, "#ff2bd6"); draw(); }
    showBanner(biHtml("arena.finish." + finish));

    bannerTimer = setTimeout(() => {
      if (match.matchOver) {
        const won = match.matchWinner === "player";
        persistStreak(match.streak);
        renderScore();
        if (won) sfx.win(); else sfx.lose();
        showBanner(won ? biHtml("arena.match.won") : biHtml("arena.match.lost"));
        rematchEl.innerHTML = biHtml("arena.rematch");
        rematchEl.hidden = false;
      } else {
        showBanner(outcome === "player" ? biHtml("arena.round.won") : biHtml("arena.round.lost"));
        nextRoundEl.innerHTML = biHtml("arena.next");
        nextRoundEl.hidden = false;
      }
    }, 800);
  }

  // Advance a bey's spin angle and wobble based on its remaining spin. Faster
  // spin -> faster rotation; as spin runs low the top wobbles like a real one.
  function spinVisuals(b) {
    if (!b.alive) return;
    const frac = Math.max(0, b.spin) / b.spin0;
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

    // X-Celerator rail — a glowing cardioid track; beys catch it and slingshot
    // off the cusp at the foe.
    ctx.save();
    ctx.strokeStyle = "rgba(255,214,74,.55)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(255,214,74,.6)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    const RAIL_STEPS = 140;
    for (let i = 0; i <= RAIL_STEPS; i++) {
      const th = (i / RAIL_STEPS) * Math.PI * 2;
      const p = cardioidPoint(th, rail);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();

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
    const frac = Math.max(0, b.spin) / b.spin0;
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

    // motion-blur energy ring: brighter/larger the faster it spins (both looks)
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
      ctx.arc(0, 0, r * 1.3, off, off + sweep);
      ctx.stroke();
    }
    ctx.restore();

    const img = b.img;
    if (img && img.complete && img.naturalWidth > 0) {
      // the actual blade render, rotated by its spin angle; fades as spin runs
      // down so the image path "winds down" like the procedural top.
      ctx.save();
      ctx.globalAlpha = 0.4 + 0.6 * frac;
      ctx.rotate(b.rot);
      const s = r * 2.4;
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.restore();
      ctx.restore();
      return;
    }

    // ---- fallback: procedural metal top (when the image isn't ready) ----
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
  function open(build) {
    if (build) playerBuild = build;
    cancelAnimationFrame(raf); // stop any ghost loop before re-initialising
    overlayEl.hidden = false;
    document.body.classList.add("battling");
    triggerShake("lg");
    startMatch();
    showBanner(biHtml("arena.battle"));
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
  // Belt-and-suspenders: unlock audio on the very first user gesture anywhere
  // (e.g. pressing the red button to open the arena), not only on launch — some
  // browsers need the warm-up to happen at the earliest possible gesture.
  const firstGestureUnlock = () => {
    sfx.unlockAudio();
    window.removeEventListener("pointerdown", firstGestureUnlock);
    window.removeEventListener("keydown", firstGestureUnlock);
  };
  window.addEventListener("pointerdown", firstGestureUnlock);
  window.addEventListener("keydown", firstGestureUnlock);

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
  syncSetupControls();

  return { open, close };
}
