// Tiny WebAudio synth, no files. All gains stay at or below the blip level (0.035).
import { mulberry32 } from './sim/world.js';
let ac = null, muted = false;
export function setMuted(v) { muted = v; try { sync(); } catch {} } // mute also fades out the ambience
export const isMuted = () => muted;
// The context is made on the first sound, which always follows a user gesture. iOS can suspend it again.
function ctx() {
  ac = ac || new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
// One shaped note: a 4 ms attack (no click), an exponential fall, and a lowpass that takes the edge off a square wave.
function note(a, f, t, d, type, v, f2 = f, out = a.destination) {
  const o = a.createOscillator(), gn = a.createGain(), lp = a.createBiquadFilter();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2 !== f) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  lp.type = 'lowpass'; lp.frequency.value = Math.min(6000, f * 4);
  gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(v, t + 0.004); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(lp).connect(gn).connect(out); o.start(t); o.stop(t + d + 0.02);
}
// A burst of filtered white noise: crackle pops, splash and thud.
let noiseBuf = null;
function nbuf(a) {
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const ch = noiseBuf.getChannelData(0); let s = 1;
    for (let i = 0; i < ch.length; i++) { s = (s * 16807) % 2147483647; ch[i] = s / 1073741823.5 - 1; } // fixed seed, no Math.random
  }
  return noiseBuf;
}
function noise(a, t, d, v, freq, q = 1, freq2 = freq, out = a.destination) {
  const src = a.createBufferSource(), bp = a.createBiquadFilter(), gn = a.createGain();
  src.buffer = nbuf(a); bp.type = 'bandpass'; bp.Q.value = q;
  bp.frequency.setValueAtTime(freq, t); if (freq2 !== freq) bp.frequency.exponentialRampToValueAtTime(freq2, t + d);
  gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(v, t + 0.005); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
  src.connect(bp).connect(gn).connect(out); src.start(t, (t * 7.3) % 0.5); src.stop(t + d + 0.02);
}
let lastBlip = -1e9;
export function blip(f, d = 0.07, type = 'square', v = 0.035) {
  if (muted) return;
  lastBlip = performance.now();
  try { const a = ctx(); note(a, f, a.currentTime, d, type, v); } catch {}
}
// The default press sound of every button. A button with its own sound plays it first (onclick), so tap() then stays silent.
export const tap = () => { if (performance.now() - lastBlip > 30) blip(880, 0.06); };
// Cues for sim events, by event type. gap: the shortest time in ms between two plays, because one tick can push many events.
export const CUES = {
  fireSpotted: { gap: 900, play: (a, t) => { for (const [dt, f] of [[0, 2600], [0.07, 1900], [0.16, 3100], [0.22, 2200], [0.33, 2800]]) noise(a, t + dt, 0.05, 0.03, f, 6); } }, // dry crackle
  villageFire: { gap: 2500, play: (a, t) => { for (const k of [0, 0.3]) { note(a, 740, t + k, 0.14, 'square', 0.026); note(a, 554, t + k + 0.15, 0.14, 'square', 0.026); } } }, // two-tone alarm, twice
  arson: { gap: 2500, play: (a, t) => { note(a, 110, t, 0.25, 'triangle', 0.035, 70); noise(a, t + 0.05, 0.3, 0.025, 1800, 3); } }, // a dull strike, then a flare
  washout: { gap: 1500, play: (a, t) => { noise(a, t, 0.6, 0.03, 1400, 1.5, 240); note(a, 196, t, 0.3, 'triangle', 0.02, 120); } }, // a falling splash
  yearEnd: { gap: 1500, play: (a, t) => [523, 659, 784, 1047].forEach((f, k) => note(a, f, t + k * 0.09, 0.32, 'triangle', 0.03)) }, // rising arpeggio
  elNinoWarning: { gap: 1500, play: (a, t) => { note(a, 196, t, 0.5, 'triangle', 0.035); note(a, 185, t + 0.42, 0.7, 'triangle', 0.035); } }, // two low notes, a semitone down
};
const lastCue = new Map();
export const resetCues = () => lastCue.clear();
// Plays the cue for one sim event. Returns true when the cue starts: not muted, a known type, and outside its gap.
export function cue(type, now = performance.now()) {
  const c = CUES[type];
  if (muted || !c || now - (lastCue.get(type) ?? -Infinity) < c.gap) return false;
  lastCue.set(type, now);
  try { const a = ctx(); c.play(a, a.currentTime); } catch {}
  return true;
}

// ---- Scale and phrases (pure, so the tests can check them) ----
const SLENDRO = [0, 240, 480, 720, 960], PELOG = [0, 120, 420, 700, 820]; // cents; slendro is near-equal 5 steps, pelog is tenser (fire)
// Frequency of scale step n (any integer; 5 steps = 1 octave) above root Hz.
export const slendro = (n, root = 233, cents = SLENDRO) => root * 2 ** ((cents[((n % 5) + 5) % 5] + 1200 * Math.floor(n / 5)) / 1200);
// One balungan phrase: 8 beats, each a scale step 0..5 or -1 (rest). Same seed and health give the same phrase.
export function phrase(seed, health = 0.5) {
  const r = mulberry32(seed), out = []; let s = 3;
  for (let i = 0; i < 8; i++) {
    s += Math.floor(r() * 5) - 2; s = s < 0 ? -s : s > 7 ? 14 - s : s; // walk in small steps over 1.5 octaves, like a balungan line; bounce at the ends
    const keep = i % 4 === 0 || r() < 0.3 + health * 0.6; // healthy peat gives a denser line
    out.push(keep ? s : -1);
  }
  out[7] = [0, 2, 4][Math.floor(r() * 3)]; // the phrase ends on a stable note, where the gong sounds
  return out;
}

// ---- One-shot sounds ----
// Soft metallophone: a sine plus two quiet inharmonic partials. Longer notes ring longer.
function bell(a, f, t, v, d = 1.6, out = a.destination) {
  note(a, f, t, d, 'sine', v, f, out); note(a, f * 2.76, t, d * 0.5, 'sine', v * 0.3, f * 2.76, out); note(a, f * 5.4, t, d * 0.25, 'sine', v * 0.1, f * 5.4, out);
}
const knock = (a, t, f, v = 0.035) => { note(a, f, t, 0.14, 'triangle', v, f * 0.5); noise(a, t, 0.06, 0.03, f * 6, 1.2); }; // wood on wood
const MOTIF = { palud: [0, 2], pond: [3, 1], fireGroup: [1, 4] }; // two steps of the scale, one motif per action
const motif = id => (a, t) => MOTIF[id].forEach((s, i) => note(a, slendro(s, 466), t + i * 0.1, 0.26, 'triangle', 0.03));
// Sounds by name. gap: the shortest time in ms between two plays. k picks a note or a star.
export const SFX = {
  tempBlock: { gap: 60, play: (a, t) => knock(a, t, 150) }, // wooden thunk
  permBlock: { gap: 60, play: (a, t) => { knock(a, t, 110); knock(a, t + 0.11, 95); } }, // two solid knocks
  backfill: { gap: 80, play: (a, t) => [0, 0.07, 0.15, 0.2].forEach((dt, i) => noise(a, t + dt, 0.07, 0.03, 700 + i * 220, 1.5)) }, // shovel crunch
  plant: { gap: 60, play: (a, t) => { noise(a, t, 0.04, 0.02, 2200, 2); note(a, 660, t + 0.03, 0.12, 'sine', 0.02, 990); } }, // leafy pop, then a small rise
  mound: { gap: 60, play: (a, t) => { note(a, 90, t, 0.22, 'sine', 0.035, 50); noise(a, t, 0.12, 0.02, 300, 0.8); } }, // heavy soft thud
  well: { gap: 80, play: (a, t) => note(a, 300, t, 0.18, 'sine', 0.032, 900) }, // bloop
  palud: { gap: 120, play: motif('palud') },
  pond: { gap: 120, play: motif('pond') },
  fireGroup: { gap: 120, play: motif('fireGroup') },
  fireCrew: { gap: 200, play: (a, t) => noise(a, t, 0.5, 0.03, 3500, 0.8, 300) }, // whoosh, high to low
  done: { gap: 150, play: (a, t, k) => { const s = (k % 5) + 5; bell(a, slendro(s, 233), t, 0.026, 0.9); bell(a, slendro(s + 2, 233), t + 0.14, 0.026, 1.1); } }, // two soft dings
  wet: { gap: 90, play: (a, t, k) => { const f = slendro(k % 10, 466); note(a, f, t, 0.12, 'sine', 0.02, f * 1.15); note(a, f * 2, t, 0.06, 'sine', 0.006); } }, // water drop; a run of tiles is a melody
  star: { gap: 150, play: (a, t, k) => { const s = 5 + k * 2; bell(a, slendro(s, 466), t, 0.016, 1.2); bell(a, slendro(s + 1, 466), t + 0.08, 0.016, 1.4); note(a, slendro(s + 1, 466) * 4, t + 0.08, 0.3, 'sine', 0.006); } }, // rising chime, higher for higher k
  deny: { gap: 150, play: (a, t) => { note(a, 110, t, 0.16, 'sawtooth', 0.02); note(a, 117, t, 0.16, 'sawtooth', 0.02); } }, // soft low buzz
  season: { gap: 1000, play: (a, t) => [4, 2, 0].forEach((s, i) => bell(a, slendro(s, 233), t + i * 0.18, 0.018, 1.6)) }, // dry season starts: a slow falling bell
  find: { gap: 300, play: (a, t) => [0, 2, 4].forEach((s, i) => bell(a, slendro(s, 466), t + i * 0.1, 0.02, 0.7)) }, // rising arpeggio
  fireOut: { gap: 400, play: (a, t) => noise(a, t, 0.7, 0.03, 6000, 0.5, 3000) }, // soft hiss
};
const lastSfx = new Map();
// Plays one named sound. Returns true when it starts: not muted, a known name, and outside its gap.
export function sfx(name, k = 0, now = performance.now()) {
  const c = SFX[name];
  if (muted || !c || now - (lastSfx.get(name) ?? -Infinity) < c.gap) return false;
  lastSfx.set(name, now);
  try { const a = ctx(); c.play(a, a.currentTime, k); } catch {}
  return true;
}

// ---- Ambience: music, rain and wildlife on one master gain ----
const BEAT = 60 / 70, LOOK = 0.3, ROOT = 233; // 70 BPM; schedule 0.3 s ahead
let amb = { on: false, rain: false, health: 0, fire: 0 }, master = null, rainG = null, timer = 0;
let nextBeat = 0, beat = 0, cur = [], nextBird = 0, nextFrog = 0, nextCricket = 0, nextDrop = 0;
const rnd = (a, b) => a + Math.random() * (b - a);
// One beat of the balungan: note, offbeat ornament when healthy, gong on the last beat.
function playBeat(a, t, n) {
  const i = n % 8, { health: h, fire: f } = amb, r = mulberry32(n * 31 + 7);
  if (i === 0) cur = phrase(1 + ((n >> 4) % 16), h); // each phrase plays twice; 16 phrases loop in about 3.6 min
  const dark = f > 0.2, root = dark ? ROOT / 2 : ROOT, sc = dark ? PELOG : SLENDRO, s = cur[i];
  if (i === 7) { note(a, 62, t, 3.5, 'sine', 0.012, 62, master); note(a, 62.7, t, 3.5, 'sine', 0.012, 62.7, master); } // two detuned sines beat slowly
  if (s < 0 || r() < f * 0.8) return; // fire thins the music out
  const v = 0.012 + 0.006 * h;
  bell(a, slendro(s, root, sc), t, v, 1.6, master);
  if (!dark && h > 0.6 && r() < h - 0.4) bell(a, slendro(s + 5 + (r() < 0.5 ? 1 : 0), root, sc), t + BEAT / 2, v * 0.6, 1, master); // bright ornament
}
function nature(a, t, h) {
  if (t > nextFrog && h > 0.3) { // a burst of frog pulses
    nextFrog = t + rnd(2, 6) / h; const f = rnd(400, 700);
    for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) note(a, f, t + i * 0.09, 0.05, 'triangle', 0.008, f * 0.9, master);
  }
  if (t > nextCricket && h > 0.2) { // very high quiet pulses
    nextCricket = t + rnd(1, 2.5) / h; const f = rnd(4200, 4800);
    for (let i = 0; i < 4; i++) note(a, f, t + i * 0.05, 0.025, 'sine', 0.004, f, master);
  }
  if (t > nextBird && h > 0.5) { // a short two-chirp song
    nextBird = t + rnd(4, 12); const f = rnd(2000, 3000);
    note(a, f, t, 0.12, 'sine', 0.008, f * 1.5, master); note(a, f * 1.3, t + 0.16, 0.1, 'sine', 0.008, f * 0.9, master);
  }
}
function tick() {
  const a = ac; if (!a || muted || !amb.on) return;
  if (a.state === 'suspended') a.resume();
  const now = a.currentTime;
  if (nextBeat < now) nextBeat = now + 0.05; // a background tab throttles timers: restart the grid
  while (nextBeat < now + LOOK) { playBeat(a, nextBeat, beat++); nextBeat += BEAT; }
  if (amb.rain && now > nextDrop) { nextDrop = now + rnd(0.05, 0.3); note(a, rnd(1500, 3500), now, 0.03, 'sine', 0.006, undefined, master); } // a soft droplet tick
  nature(a, now, amb.health);
}
function setRain(a, on) {
  if (on && !rainG) { // a looping noise bed, filtered to a hiss
    const src = a.createBufferSource(), bp = a.createBiquadFilter(), lp = a.createBiquadFilter();
    rainG = a.createGain(); rainG.gain.value = 0;
    src.buffer = nbuf(a); src.loop = true; bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.4; lp.type = 'lowpass'; lp.frequency.value = 3000;
    src.connect(bp).connect(lp).connect(rainG).connect(master); src.start();
  }
  if (rainG) rainG.gain.setTargetAtTime(on ? 0.012 : 0, a.currentTime, 0.3); // about 0.9 s to settle
}
// Starts or stops the scheduler to match the state. Fades take 0.4 s or more.
let running = false;
function sync() {
  const want = amb.on && !muted;
  if (want === running || (!want && !ac)) return;
  if (!want) { running = false; clearInterval(timer); timer = 0; master.gain.setTargetAtTime(0, ac.currentTime, 0.15); return; }
  const a = ctx(); running = true; // set after ctx(), which throws when there is no AudioContext
  if (!master) { master = a.createGain(); master.gain.value = 0; master.connect(a.destination); }
  master.gain.setTargetAtTime(1, a.currentTime, 0.2);
  setRain(a, amb.rain);
  nextBeat = a.currentTime + 0.1; nextBird = nextFrog = nextCricket = a.currentTime + 2; beat = Math.ceil(beat / 8) * 8; // resume on a phrase start
  timer = setInterval(tick, 100);
}
// The game loop calls this every frame. It acts only when on or rain change; health and fire are read by the scheduler.
export function setAmbience(s) {
  try {
    const wasRain = amb.rain, wasOn = amb.on;
    amb = { on: !!s.on, rain: !!s.rain, health: Math.max(0, Math.min(1, s.health || 0)), fire: Math.max(0, Math.min(1, s.fire || 0)) };
    if (amb.on !== wasOn) sync();
    else if (amb.rain !== wasRain && running) setRain(ac, amb.rain);
  } catch {}
}
