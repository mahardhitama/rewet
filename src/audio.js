// Tiny WebAudio synth, no files. All gains stay at or below the blip level (0.035).
let ac = null, muted = false;
export const setMuted = v => { muted = v; };
export const isMuted = () => muted;
// The context is made on the first sound, which always follows a user gesture. iOS can suspend it again.
function ctx() {
  ac = ac || new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
// One shaped note: a 4 ms attack (no click), an exponential fall, and a lowpass that takes the edge off a square wave.
function note(a, f, t, d, type, v, f2 = f) {
  const o = a.createOscillator(), gn = a.createGain(), lp = a.createBiquadFilter();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2 !== f) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  lp.type = 'lowpass'; lp.frequency.value = Math.min(6000, f * 4);
  gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(v, t + 0.004); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(lp).connect(gn).connect(a.destination); o.start(t); o.stop(t + d + 0.02);
}
// A burst of filtered white noise: crackle pops, splash and thud.
let noiseBuf = null;
function noise(a, t, d, v, freq, q = 1, freq2 = freq) {
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const ch = noiseBuf.getChannelData(0); let s = 1;
    for (let i = 0; i < ch.length; i++) { s = (s * 16807) % 2147483647; ch[i] = s / 1073741823.5 - 1; } // fixed seed, no Math.random
  }
  const src = a.createBufferSource(), bp = a.createBiquadFilter(), gn = a.createGain();
  src.buffer = noiseBuf; bp.type = 'bandpass'; bp.Q.value = q;
  bp.frequency.setValueAtTime(freq, t); if (freq2 !== freq) bp.frequency.exponentialRampToValueAtTime(freq2, t + d);
  gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(v, t + 0.005); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
  src.connect(bp).connect(gn).connect(a.destination); src.start(t, (t * 7.3) % 0.5); src.stop(t + d + 0.02);
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
