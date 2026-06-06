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
