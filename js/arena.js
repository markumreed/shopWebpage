// arena.js — canvas battle. Pure physics comes from physics.js.
import { stepBey, resolveCollision, decideOutcome, distance } from "./physics.js";

const STADIUM_PARAMS = { dt: 1, friction: 0.012, spinDecay: 0.08, centering: 0.0016 };
const COLLISION = { restitution: 1.05, collisionSpinDrain: 1.5 };
const START_SPIN = 100;

function makeBey(name, x, y, color) {
  return { name, x, y, vx: 0, vy: 0, spin: START_SPIN, radius: 22, mass: 1, alive: true, color };
}

export function mountArena(opts) {
  const { overlayEl, canvasEl, angleEl, powerFillEl, launchEl, rematchEl, bannerEl, onExit } = opts;
  const ctx = canvasEl.getContext("2d");
  const W = canvasEl.width, H = canvasEl.height;
  const stadium = { cx: W / 2, cy: H / 2, r: W / 2 - 16 };

  let player, opponent, phase, raf, charging, power, wasColliding, bursts, bannerTimer;

  function reset() {
    player = makeBey("You", stadium.cx - 120, stadium.cy, "#2bf2ff");
    opponent = makeBey("Rival", stadium.cx + 120, stadium.cy, "#ff2bd6");
    phase = "ready"; // ready -> spinning -> done
    charging = false;
    power = 0;
    wasColliding = false;
    bursts = [];
    clearTimeout(bannerTimer);
    powerFillEl.style.width = "0%";
    launchEl.disabled = false;
    launchEl.textContent = "HOLD TO CHARGE";
    rematchEl.hidden = true;
    bannerEl.hidden = true;
    draw();
  }

  // Show banner text, restarting the CSS pop animation each time.
  function showBanner(text) {
    bannerEl.hidden = true;
    void bannerEl.offsetWidth; // force reflow so banner-pop replays
    bannerEl.textContent = text;
    bannerEl.hidden = false;
  }

  // ---- charge-launch input ----
  function startCharge() {
    if (phase !== "ready") return;
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

    // AI launches with randomized angle/power, aimed roughly at player
    const aiAngle = Math.atan2(player.y - opponent.y, player.x - opponent.x) + (Math.random() - 0.5);
    const aiSpeed = 5 + Math.random() * 5;
    opponent.vx = Math.cos(aiAngle) * aiSpeed;
    opponent.vy = Math.sin(aiAngle) * aiSpeed;

    phase = "spinning";
    launchEl.disabled = true;
    bannerEl.hidden = true;
    loop();
  }

  // ---- main loop ----
  function loop() {
    const pPrev = player.alive, oPrev = opponent.alive;
    player = stepBey(player, stadium, STADIUM_PARAMS);
    opponent = stepBey(opponent, stadium, STADIUM_PARAMS);

    // impact burst on the frame the beys first make contact
    const touching = distance(player.x, player.y, opponent.x, opponent.y) <= player.radius + opponent.radius;
    if (touching && !wasColliding) {
      spawnBurst((player.x + opponent.x) / 2, (player.y + opponent.y) / 2, "#ffffff");
    }
    wasColliding = touching;

    [player, opponent] = resolveCollision(player, opponent, COLLISION);
    stepBursts();
    draw();

    const outcome = decideOutcome(player, opponent);
    if (outcome) {
      // a bey that just died while still spinning was knocked out (ring-out)
      const ringout =
        (pPrev && !player.alive && player.spin > 0) ||
        (oPrev && !opponent.alive && opponent.spin > 0);
      return finish(outcome, ringout);
    }
    raf = requestAnimationFrame(loop);
  }

  function finish(outcome, ringout) {
    phase = "done";
    cancelAnimationFrame(raf);
    const result = outcome === "player" ? "YOU WIN!" : outcome === "opponent" ? "DEFEAT" : "DRAW";
    triggerShake();
    if (ringout) {
      spawnBurst(stadium.cx, stadium.cy, "#ff2bd6");
      draw();
      showBanner("BURST!");
      bannerTimer = setTimeout(() => { showBanner(result); rematchEl.hidden = false; }, 800);
    } else {
      showBanner(result);
      rematchEl.hidden = false;
    }
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
    ctx.clearRect(0, 0, W, H);
    // stadium ring
    ctx.strokeStyle = "rgba(43,242,255,.5)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(stadium.cx, stadium.cy, stadium.r, 0, Math.PI * 2);
    ctx.stroke();
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

  function drawBey(b) {
    if (!b.alive) return;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(0, 0, b.radius * (0.5 + 0.5 * (b.spin / START_SPIN)), 0, Math.PI * 2);
    ctx.fill();
    // spin tick
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    const a = (b.x + b.y) * 0.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * b.radius, Math.sin(a) * b.radius);
    ctx.stroke();
    ctx.restore();
  }

  function triggerShake() {
    overlayEl.classList.add("shake");
    setTimeout(() => overlayEl.classList.remove("shake"), 460);
  }

  // ---- open/close ----
  function open() {
    cancelAnimationFrame(raf); // stop any ghost loop before re-initialising
    overlayEl.hidden = false;
    document.body.classList.add("battling");
    triggerShake();
    reset();
    showBanner("BATTLE!");
    bannerTimer = setTimeout(() => { if (phase === "ready") bannerEl.hidden = true; }, 900);
  }
  function close() {
    cancelAnimationFrame(raf);
    clearTimeout(bannerTimer);
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
  rematchEl.addEventListener("click", reset);

  return { open, close };
}
