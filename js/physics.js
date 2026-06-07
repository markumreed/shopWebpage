// physics.js — pure game physics (no DOM, no canvas)

export function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function stepBey(bey, stadium, params) {
  if (!bey.alive) return bey;
  const { dt, friction, spinDecay, centering } = params;

  // bowl centering force toward stadium center
  const ax = (stadium.cx - bey.x) * centering;
  const ay = (stadium.cy - bey.y) * centering;

  let vx = (bey.vx + ax * dt) * (1 - friction * dt);
  let vy = (bey.vy + ay * dt) * (1 - friction * dt);

  const x = bey.x + vx * dt;
  const y = bey.y + vy * dt;

  let spin = bey.spin - spinDecay * dt;
  let alive = true;
  if (spin <= 0) {
    spin = 0;
    alive = false;
  }
  if (distance(x, y, stadium.cx, stadium.cy) > stadium.r) {
    alive = false;
  }

  return { ...bey, x, y, vx, vy, spin, alive };
}

export function resolveCollision(a, b, params) {
  const { restitution, collisionSpinDrain, superDrain = 0 } = params;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const minDist = a.radius + b.radius;
  if (dist === 0 || dist >= minDist) return [a, b];

  // unit normal from a to b
  const nx = dx / dist;
  const ny = dy / dist;

  // relative velocity along the normal
  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const velAlongNormal = rvx * nx + rvy * ny;

  let a2 = { ...a };
  let b2 = { ...b };

  // only resolve velocity if they are approaching
  if (velAlongNormal < 0) {
    const invMassA = 1 / a.mass;
    const invMassB = 1 / b.mass;
    const j = (-(1 + restitution) * velAlongNormal) / (invMassA + invMassB);
    const ix = j * nx;
    const iy = j * ny;
    a2.vx = a.vx - ix * invMassA;
    a2.vy = a.vy - iy * invMassA;
    b2.vx = b.vx + ix * invMassB;
    b2.vy = b.vy + iy * invMassB;
  }

  // positional correction: push apart so they no longer overlap
  const overlap = minDist - dist;
  a2.x = a.x - nx * (overlap / 2);
  a2.y = a.y - ny * (overlap / 2);
  b2.x = b.x + nx * (overlap / 2);
  b2.y = b.y + ny * (overlap / 2);

  // both lose spin on contact
  a2.spin = Math.max(0, a.spin - collisionSpinDrain);
  b2.spin = Math.max(0, b.spin - collisionSpinDrain);

  // special attack: a bey with `special` set drains extra spin from the other,
  // then its flag clears (one-shot).
  if (a.special) { b2.spin = Math.max(0, b2.spin - superDrain); a2.special = false; }
  if (b.special) { a2.spin = Math.max(0, a2.spin - superDrain); b2.special = false; }

  return [a2, b2];
}

export function decideOutcome(player, opponent) {
  if (player.alive && opponent.alive) return null;
  if (player.alive && !opponent.alive) return "player";
  if (!player.alive && opponent.alive) return "opponent";
  return "draw";
}
