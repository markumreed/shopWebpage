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
  const {
    restitution, collisionSpinDrain, superDrain = 0,
    oppositeSpinMult = 1, sameSpinMult = 1,
  } = params;
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

  // both lose spin on contact; opposite spin directions "spin-steal" — they
  // drain harder than same-spin clashes. Beys without a `dir` default to +1.
  const sameDir = (a.dir ?? 1) === (b.dir ?? 1);
  const drain = collisionSpinDrain * (sameDir ? sameSpinMult : oppositeSpinMult);
  a2.spin = Math.max(0, a.spin - drain);
  b2.spin = Math.max(0, b.spin - drain);

  // special attack: a bey with `special` set drains extra spin from the other,
  // then its flag clears (one-shot).
  if (a.special) { b2.spin = Math.max(0, b2.spin - superDrain); a2.special = false; }
  if (b.special) { a2.spin = Math.max(0, a2.spin - superDrain); b2.special = false; }

  return [a2, b2];
}

// aiSteer — returns a per-frame steering acceleration {ax, ay} for the AI bey.
// This is what makes the rival a real opponent instead of a single dumb launch:
//   - SEEK: when it has a spin advantage it hunts the player to force clashes
//     that drain spin (it's winning the attrition trade).
//   - SURVIVE: when it's behind on spin it hugs the stadium center, where the
//     bowl-centering force keeps it safe and it can outlast the player.
//   - EDGE FEAR: an extra inward push near the rim so it doesn't ring itself out.
// `aggression` (0..1) scales the whole thing so callers can tune difficulty.
export function aiSteer(opponent, player, stadium, aggression = 1) {
  if (!opponent.alive || !player.alive) return { ax: 0, ay: 0 };

  const spinAdv = opponent.spin - player.spin; // >0 means AI is ahead
  const seeking = spinAdv > -10;               // hunt unless clearly behind

  // target: the player when seeking, the safe center otherwise
  const tx = seeking ? player.x : stadium.cx;
  const ty = seeking ? player.y : stadium.cy;
  const dx = tx - opponent.x;
  const dy = ty - opponent.y;
  const d = Math.hypot(dx, dy) || 1;

  const base = seeking ? 0.05 : 0.07; // chase gentler than self-preservation
  let ax = (dx / d) * base * aggression;
  let ay = (dy / d) * base * aggression;

  // edge fear: ramp up an inward push in the outer 25% of the bowl
  const cx = stadium.cx - opponent.x;
  const cy = stadium.cy - opponent.y;
  const distCenter = Math.hypot(cx, cy);
  const edge = distCenter / stadium.r;
  if (edge > 0.75) {
    const k = (edge - 0.75) / 0.25; // 0..1 across the danger band
    ax += (cx / (distCenter || 1)) * 0.12 * k;
    ay += (cy / (distCenter || 1)) * 0.12 * k;
  }
  return { ax, ay };
}

export function decideOutcome(player, opponent) {
  if (player.alive && opponent.alive) return null;
  if (player.alive && !opponent.alive) return "player";
  if (!player.alive && opponent.alive) return "opponent";
  return "draw";
}

// A cardioid r = 1 − cosθ, recentred so its bounding box centers on the origin,
// then scaled, rotated, and translated to sit in the stadium. The cusp (θ = 0)
// is the release point. geom = { cx, cy, scale, rot }.
const CARDIOID_BBOX_CX = -0.875;    // local bbox-center x (precomputed from the curve)
export const CARDIOID_MAX_R = 1.34; // upper bound on |point − center| in local units (the
                                    // true max is ~1.337 near θ≈100°); used for fit scaling

export function cardioidPoint(theta, geom) {
  const r = 1 - Math.cos(theta);
  const lx = r * Math.cos(theta) - CARDIOID_BBOX_CX; // recentre so the shape is centered
  const ly = r * Math.sin(theta);
  const c = Math.cos(geom.rot), s = Math.sin(geom.rot);
  return {
    x: geom.cx + (lx * c - ly * s) * geom.scale,
    y: geom.cy + (lx * s + ly * c) * geom.scale,
  };
}

// Unit tangent at theta (analytic derivative of the local parametric form,
// rotated to match geom.rot). Independent of scale. Degenerate at the cusp.
export function cardioidTangent(theta, geom) {
  const lx = Math.sin(theta) * (2 * Math.cos(theta) - 1);
  const ly = Math.cos(theta) - Math.cos(2 * theta);
  const c = Math.cos(geom.rot), s = Math.sin(geom.rot);
  const rx = lx * c - ly * s;
  const ry = lx * s + ly * c;
  const mag = Math.hypot(rx, ry);
  if (mag < 1e-9) return { x: 0, y: 0 }; // cusp: tangent is degenerate
  return { x: rx / mag, y: ry / mag };
}

// Closest sampled point on the cardioid to (x, y): returns its theta and distance.
export function nearestCardioidParam(x, y, geom, samples = 180) {
  let best = Infinity, bestTheta = 0;
  for (let i = 0; i < samples; i++) {
    const theta = (i / samples) * Math.PI * 2;
    const p = cardioidPoint(theta, geom);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < best) { best = d; bestTheta = theta; }
  }
  return { theta: bestTheta, dist: best };
}

// tryCatchRail — a free bey "catches" the cardioid rail when it passes close
// enough while moving fast enough. On catch it locks onto the curve at the
// nearest theta, riding in its spin direction. Pure — returns { bey, caught }.
// `geom` = { cx, cy, scale, rot, cooldown, catchDist, arcScale }.
// `gear` = { engageSpeed, rideAccel, rideCap, spinCost, rideSpinDrain, minRideSpeed }.
export function tryCatchRail(bey, geom, gear) {
  if (!bey.alive || bey.railed || (bey.dashCd ?? 0) > 0) return { bey, caught: false };

  const { theta, dist } = nearestCardioidParam(bey.x, bey.y, geom);
  if (dist > geom.catchDist) return { bey, caught: false };

  const speed = Math.hypot(bey.vx, bey.vy);
  if (speed < gear.engageSpeed) return { bey, caught: false };

  const next = {
    ...bey,
    railed: true,
    railTheta: theta,
    railDir: bey.dir ?? 1,
    railSpeed: Math.max(speed, gear.minRideSpeed),
  };
  return { bey: next, caught: true };
}

// stepRail — advance a railed bey one frame: accelerate, move along the curve,
// and release off the cusp (theta = 0 / 2π) in the ride direction. On release
// the bey leaves the rail with a cooldown and a spin cost; the caller aims its
// velocity. Pure — returns { bey, released }. Assumes bey.railed is true.
export function stepRail(bey, geom, gear) {
  const railSpeed = Math.min(gear.rideCap, (bey.railSpeed ?? 0) + gear.rideAccel);
  const dir = bey.railDir ?? 1;
  let nextTheta = (bey.railTheta ?? 0) + dir * (railSpeed / geom.arcScale);

  let released = false;
  if (dir > 0 && nextTheta >= Math.PI * 2) { released = true; nextTheta = 0; }
  else if (dir < 0 && nextTheta <= 0) { released = true; nextTheta = 0; }

  const p = cardioidPoint(nextTheta, geom);
  const t = cardioidTangent(nextTheta, geom);
  const next = {
    ...bey,
    x: p.x, y: p.y,
    vx: t.x * railSpeed, vy: t.y * railSpeed,
    railTheta: nextTheta,
    railSpeed,
    spin: Math.max(0, bey.spin - gear.rideSpinDrain),
  };
  if (released) {
    next.railed = false;
    next.dashCd = geom.cooldown;
    next.spin = Math.max(0, next.spin - gear.spinCost);
  }
  return { bey: next, released };
}

// tryXtremeDash — the X-Celerator rail. When a bey is inside the rail band,
// moving above the gear's engage speed, and off cooldown, its bit-gear meshes
// with the rail and it gets an Xtreme Dash: an impulse along its current
// heading. Pure — returns { bey, fired } and never mutates the input.
// `rail`  = { inner, outer, cooldown } in absolute units from stadium center.
// `gear`  = { dashImpulse, engageSpeed, spinCost }.
export function tryXtremeDash(bey, stadium, rail, gear) {
  if (!bey.alive || (bey.dashCd ?? 0) > 0) return { bey, fired: false };

  const d = distance(bey.x, bey.y, stadium.cx, stadium.cy);
  if (d < rail.inner || d > rail.outer) return { bey, fired: false };

  const speed = Math.hypot(bey.vx, bey.vy);
  if (speed < gear.engageSpeed) return { bey, fired: false };

  const ux = bey.vx / speed;
  const uy = bey.vy / speed;
  const next = {
    ...bey,
    vx: bey.vx + ux * gear.dashImpulse,
    vy: bey.vy + uy * gear.dashImpulse,
    spin: Math.max(0, bey.spin - gear.spinCost),
    dashCd: rail.cooldown,
  };
  return { bey: next, fired: true };
}
