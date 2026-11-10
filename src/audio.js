// Tiny WebAudio synth, no files. blip() moved unchanged from the prototype.
let ac = null, muted = false;
export const setMuted = v => { muted = v; };
export const isMuted = () => muted;
export function blip(f, d = 0.07, type = 'square', v = 0.035) {
  if (muted) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), gn = ac.createGain(), t = ac.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, t);
    gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(gn).connect(ac.destination); o.start(t); o.stop(t + d);
  } catch {}
}
