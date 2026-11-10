import { idx } from './world.js';

function boxBlur(a, w, h) {
  const o = new Float32Array(a.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, c = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < w && yy >= 0 && yy < h) { s += a[idx(w, xx, yy)]; c++; }
    }
    o[idx(w, x, y)] = s / c;
  }
  return o;
}

// z = dome + micro. Dome is zero at the farthest corner; micro is blurred rng noise scaled to max |micro| = microAmp.
export function generateTerrain(world, { domeRise = 2, microAmp = 0.3, smoothR = 2, centre = [world.w / 2, world.h / 2] } = {}) {
  const { w, h, rng, z } = world;
  let m = new Float32Array(world.n);
  for (let i = 0; i < world.n; i++) m[i] = rng() - 0.5;
  for (let k = 0; k < smoothR; k++) m = boxBlur(m, w, h);
  let peak = 0;
  for (const v of m) peak = Math.max(peak, Math.abs(v));
  const scale = peak > 0 ? microAmp / peak : 0;
  const [cx, cy] = centre;
  const rMax = Math.max(Math.hypot(cx, cy), Math.hypot(w - cx, cy), Math.hypot(cx, h - cy), Math.hypot(w - cx, h - cy));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = Math.hypot(x - cx, y - cy) / rMax;
    z[idx(w, x, y)] = domeRise * (1 - r * r) + m[idx(w, x, y)] * scale;
  }
}
