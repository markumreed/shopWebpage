// sound.js — procedural Web Audio SFX for the arena. No asset files: every
// sound is synthesized, so it works offline and adds no network weight.
//
// The AudioContext is created lazily and must be resumed from a user gesture
// (the launch button), per browser autoplay policy. All public methods are
// no-ops until then, so calling them early is safe.

let ctx = null;
let master = null;
let enabled = true;

function ensureCtx() {
  if (ctx) {
    // best-effort re-resume: a context can fall back to "suspended" (tab
    // backgrounded, autoplay gate) between sounds — nudge it before each use.
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { enabled = false; return null; }
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
  return ctx;
}

// Call from a user gesture so the context is allowed to make sound. Robust
// across browsers: resume the context AND start a one-sample silent source
// inside the gesture — Safari/iOS keep output muted until a node actually
// starts within a user gesture, even after resume() resolves.
export function unlockAudio() {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume();
  try {
    const s = c.createBufferSource();
    s.buffer = c.createBuffer(1, 1, c.sampleRate);
    s.connect(c.destination);
    s.start(0);
  } catch { /* non-fatal: some engines disallow the warm-up source */ }
}

export function setMuted(muted) {
  enabled = !muted;
  if (master) master.gain.value = muted ? 0 : 0.35;
}
export function isMuted() { return !enabled; }

function now() { return ctx.currentTime; }

// One short enveloped oscillator voice.
function blip(type, freq, dur, gain, { glideTo, delay = 0 } = {}) {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c) return;
  const t0 = now() + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  // exponential ramps must target a non-zero value — a zero gain (e.g. a
  // zero-intensity clash) would throw and abort the sound.
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// A burst of filtered noise — used for metallic clashes and explosions.
function noise(dur, gain, filterFreq, q = 1) {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c) return;
  const t0 = now();
  const frames = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = filterFreq;
  bp.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

// ---- public SFX ----------------------------------------------------------

// Rising whoosh as a bey is launched. `power` 0..1 brightens it.
export function launch(power = 1) {
  blip("sawtooth", 180, 0.35, 0.25, { glideTo: 520 + 360 * power });
  noise(0.3, 0.12, 1400, 0.8);
}

// Metallic clash. `intensity` 0..1 scales pitch, brightness and grit.
export function clash(intensity = 0.5) {
  const i = Math.max(0, Math.min(1, intensity));
  noise(0.12 + 0.08 * i, 0.18 + 0.22 * i, 2200 + 3000 * i, 6 + 8 * i);
  blip("square", 320 + 520 * i, 0.09, 0.12 + 0.12 * i, { glideTo: 160 });
  blip("triangle", 900 + 700 * i, 0.06, 0.08 * i, { glideTo: 500 }); // bright ping
}

// Charged special attack — descending power zap with a sparkle tail.
export function special() {
  blip("sawtooth", 880, 0.28, 0.28, { glideTo: 120 });
  blip("square", 1320, 0.22, 0.12, { glideTo: 220, delay: 0.02 });
  noise(0.25, 0.16, 3200, 3);
}

// Xtreme Dash — a fast upward rev with a whoosh as the bit-gear meshes.
export function xtreme() {
  blip("sawtooth", 220, 0.3, 0.26, { glideTo: 1200 });
  blip("square", 440, 0.22, 0.12, { glideTo: 1600, delay: 0.02 });
  noise(0.28, 0.14, 2600, 1.2);
}

// Big knock-out-of-ring explosion.
export function ringOut() {
  noise(0.55, 0.4, 600, 0.7);
  blip("sawtooth", 140, 0.5, 0.3, { glideTo: 40 });
  blip("square", 220, 0.4, 0.16, { glideTo: 55, delay: 0.03 });
}

// Spin-out — a top winding down to a stop.
export function spinOut() {
  blip("triangle", 480, 0.7, 0.26, { glideTo: 70 });
  blip("sine", 240, 0.7, 0.16, { glideTo: 45 });
}

// A short crunchy chew — two quick filtered-noise bites. Used by hold-to-eat.
export function crunch() {
  noise(0.05, 0.18, 1800, 4);
  noise(0.06, 0.14, 1200, 3);
}

// Victory fanfare (ascending) / defeat sting (descending).
export function win() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => blip("square", f, 0.3, 0.2, { delay: i * 0.12 }));
}
export function lose() {
  const notes = [392, 330, 262, 196];
  notes.forEach((f, i) => blip("sawtooth", f, 0.35, 0.18, { delay: i * 0.14 }));
}

// ---- continuous spin hum -------------------------------------------------
// A low whirring drone that plays while beys are spinning. Its pitch and
// volume track the combined spin energy (0..1) for a "winding down" feel.

let spinOsc = null, spinOsc2 = null, spinGain = null;

export function startSpinHum() {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c || spinOsc) return;
  spinGain = c.createGain();
  spinGain.gain.value = 0.0001;
  spinGain.connect(master);
  spinOsc = c.createOscillator();
  spinOsc.type = "sawtooth";
  spinOsc.frequency.value = 90;
  spinOsc2 = c.createOscillator();
  spinOsc2.type = "sine";
  spinOsc2.frequency.value = 180;
  spinOsc.connect(spinGain);
  spinOsc2.connect(spinGain);
  spinOsc.start();
  spinOsc2.start();
}

export function updateSpinHum(energy = 0) {
  if (!spinOsc || !ctx) return;
  const e = Math.max(0, Math.min(1, energy));
  const t = now();
  spinOsc.frequency.setTargetAtTime(70 + 130 * e, t, 0.08);
  spinOsc2.frequency.setTargetAtTime(140 + 260 * e, t, 0.08);
  spinGain.gain.setTargetAtTime(0.05 * e, t, 0.08);
}

export function stopSpinHum() {
  if (!spinOsc || !ctx) return;
  const t = now();
  spinGain.gain.setTargetAtTime(0.0001, t, 0.05);
  const o1 = spinOsc, o2 = spinOsc2;
  try { o1.stop(t + 0.2); o2.stop(t + 0.2); } catch { /* already stopped */ }
  spinOsc = null; spinOsc2 = null; spinGain = null;
}
