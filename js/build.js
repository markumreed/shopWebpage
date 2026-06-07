// build.js — pure: combine part stats and map them to a per-bey physics
// profile. No DOM, no canvas. Parts follow beybrew's shape:
//   blade/ratchet: { attack, defense, stamina }
//   bit:           { attack, defense, stamina, xDash, burstResistance }

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const norm = (x, lo, hi) => (lo === hi ? 0 : clamp01((x - lo) / (hi - lo)));

// reference ranges (first-pass, tunable): summed atk/def/sta, then bit-only stats
const SUM_LO = 30, SUM_HI = 150;
const XDASH_LO = 5, XDASH_HI = 45;
const BURST_LO = 30, BURST_HI = 80;

export function combineStats(blade, ratchet, bit) {
  return {
    attack:  blade.attack + ratchet.attack + bit.attack,
    defense: blade.defense + ratchet.defense + bit.defense,
    stamina: blade.stamina + ratchet.stamina + bit.stamina,
    xDash:   bit.xDash,
    burstResistance: bit.burstResistance,
  };
}

// Map the Bit's xDash to X-Celerator rail gear params (replacing the old static
// High/Standard table). Low xDash ≈ old "standard", high xDash ≈ old "high".
export function xDashToGear(xDash) {
  const t = norm(xDash, XDASH_LO, XDASH_HI);
  return {
    engageSpeed:   4.5 - 1.5 * t,   // 4.5 (hard to catch) .. 3.0 (easy)
    rideAccel:     0.5 + 0.4 * t,   // 0.5 .. 0.9
    rideCap:       10 + 4 * t,      // 10 .. 14
    spinCost:      1.5 + 2.5 * t,   // 1.5 .. 4
    rideSpinDrain: 0.10 + 0.05 * t, // 0.10 .. 0.15
    minRideSpeed:  5 + t,           // 5 .. 6
  };
}

// Map combined stats to the per-bey physics profile consumed by arena.js /
// physics.js. Bounds are centered so a mid build ≈ today's game feel.
export function statsToPhysics(stats) {
  const sN = norm(stats.stamina, SUM_LO, SUM_HI);
  const dN = norm(stats.defense, SUM_LO, SUM_HI);
  const aN = norm(stats.attack, SUM_LO, SUM_HI);
  const bN = norm(stats.burstResistance, BURST_LO, BURST_HI);
  return {
    spin0:         80 + 40 * sN,    // starting spin (80..120; ~100 mid)
    spinDecayMult: 1.2 - 0.4 * sN,  // scales spin decay (1.2 at lo stamina, 0.8 at hi)
    mass:          0.7 + 0.8 * dN,  // knockback resistance (0.7..1.5)
    defMult:       0.7 + 0.6 * dN,  // divides spin lost when struck (0.7..1.3)
    atkMult:       0.7 + 0.6 * aN,  // scales spin drained from the foe (0.7..1.3)
    launchMult:    0.85 + 0.3 * aN, // scales launch speed (0.85..1.15)
    centeringMult: 1 + 0.8 * bN,    // ring-out survivability (1..1.8)
    gear:          xDashToGear(stats.xDash),
  };
}

// Per-stat bar maxima for the builder graph: the summed atk/def/sta share the
// summed-stat ceiling; xDash and burstResistance use their own ranges (matching
// statsToPhysics). Each bar fills relative to its own realistic max.
const BAR_MAX = { attack: 150, defense: 150, stamina: 150, xDash: 45, burstResistance: 80 };
const BAR_ROWS = [
  { key: "attack", label: "ATK" },
  { key: "defense", label: "DEF" },
  { key: "stamina", label: "STA" },
  { key: "xDash", label: "X" },
  { key: "burstResistance", label: "BR" },
];

// buildBars — turn combined stats into rows for the builder's bar graph:
// { label, value (raw), pct (0-100, clamped, normalized to that stat's max) }.
export function buildBars(stats) {
  return BAR_ROWS.map(({ key, label }) => ({
    label,
    value: stats[key],
    pct: Math.round(clamp01(stats[key] / BAR_MAX[key]) * 100),
  }));
}
