// arena.js — canvas battle. Pure physics comes from physics.js.
import { stepBey, resolveCollision, decideOutcome } from "./physics.js";

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

  let player, opponent, phase, raf, charging, power;

  function reset() {
    player = makeBey("You", stadium.cx - 120, stadium.cy, "#2bf2ff");
    opponent = makeBey("Rival", stadium.cx + 120, stadium.cy, "#ff2bd6");
    phase = "ready"; // ready -> spinning -> done
    charging = false;
    power = 0;
    powerFillEl.style.width = "0%";
    launchEl.disabled = false;
    launchEl.textContent = "HOLD TO CHARGE";
    rematchEl.hidden = true;
    bannerEl.hidden = true;
    draw();
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
    loop();
  }

  // ---- main loop ----
  function loop() {
    player = stepBey(player, stadium, STADIUM_PARAMS);
    opponent = stepBey(opponent, stadium, STADIUM_PARAMS);
    [player, opponent] = resolveCollision(player, opponent, COLLISION);
    draw();

    const outcome = decideOutcome(player, opponent);
    if (outcome) return finish(outcome);
    raf = requestAnimationFrame(loop);
  }

  function finish(outcome) {
    phase = "done";
    cancelAnimationFrame(raf);
    const text = outcome === "player" ? "YOU WIN!" : outcome === "opponent" ? "DEFEAT" : "DRAW";
    bannerEl.textContent = text;
    bannerEl.hidden = false;
    rematchEl.hidden = false;
    triggerShake();
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
    overlayEl.hidden = false;
    document.body.classList.add("battling");
    triggerShake();
    reset();
  }
  function close() {
    cancelAnimationFrame(raf);
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
  rematchEl.addEventListener("click", reset);

  return { open, close };
}
