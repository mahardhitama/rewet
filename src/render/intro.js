// Intro diorama, moved unchanged from the prototype's inline script.
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---- world: 14x14 iso diorama, low-res buffer upscaled with image-rendering:pixelated
export const BW = 320, BH = 180;
let g = null;
export function initIntro(cv) { cv.width = BW; cv.height = BH; g = cv.getContext('2d'); }
const N = 14, TW = 16, TH = 8, D = 5;
const isCanal = (x, y) => y === 6 || (x === 9 && y > 6);
const DAMS = [[3, 6], [7, 6], [9, 10]];
const tiles = [];
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const i = y * N + x, c = isCanal(x, y);
  tiles.push({ x, y, i, c, r: hash(i), dam: DAMS.some(d => d[0] === x && d[1] === y),
    t: c ? 0.1 : 0.15 + hash(i + 99) * 0.55 }); // t: restoration progress at which this tile starts healing
}
tiles.sort((a, b) => a.x + a.y - (b.x + b.y));
console.assert(DAMS.every(([x, y]) => isCanal(x, y)), 'dams must sit on canals');
console.assert(clamp(2) === 1 && clamp(-1) === 0 && mix([0], [10], .5)[0] === 5, 'math helpers');

const DRY = [124, 88, 54], WET = [64, 50, 38], GREEN = [92, 132, 54], FOREST = [54, 98, 46];
function groundColor(p) {
  return p < 1/3 ? mix(DRY, WET, p * 3) : p < 2/3 ? mix(WET, GREEN, p * 3 - 1) : mix(GREEN, FOREST, p * 3 - 2);
}
function block(sx, sy, top, depth) {
  g.fillStyle = rgb(mix(top, [0, 0, 0], .35));
  for (let dx = 0; dx < 8; dx++) g.fillRect(sx - 8 + dx, sy + 4 + (dx >> 1), 1, depth);
  g.fillStyle = rgb(mix(top, [0, 0, 0], .55));
  for (let dx = 0; dx < 8; dx++) g.fillRect(sx + dx, sy + 8 - ((dx + 1) >> 1), 1, depth);
  g.fillStyle = rgb(top);
  for (let r = 0; r < TH; r++) { const w = r < 4 ? (r + 1) * 2 : (TH - r) * 2; g.fillRect(sx - w, sy + r, w * 2, 1); }
}
function blob(cx, cy, rad, col) {
  g.fillStyle = col;
  for (let dy = -rad; dy <= rad; dy++) { const w = Math.round(Math.sqrt(rad * rad - dy * dy)); g.fillRect(cx - w, cy + dy, w * 2 + 1, 1); }
}

export const smoke = [];
export function drawWorld(h, now, shift) {
  const sky = mix([86, 62, 48], [22, 38, 44], clamp(h * 1.4));
  for (let b = 0; b < 6; b++) { g.fillStyle = rgb(mix(sky, [10, 12, 12], b / 6)); g.fillRect(0, b * BH / 6, BW, BH / 6 + 1); }
  const ox = Math.round(BW / 2 + shift * 40), oy = 38 + Math.round(Math.sin(now / 1800) * 1.5);
  const water = clamp((h - 0.12) / 0.3);
  for (const T of tiles) {
    const sx = ox + (T.x - T.y) * TW / 2, sy = oy + (T.x + T.y) * TH / 2;
    const edge = T.x === N - 1 || T.y === N - 1, depth = edge ? D + 6 : D;
    const p = clamp((h - T.t) / 0.28);
    if (T.c) {
      block(sx, sy + 2, water > 0 ? mix([46, 40, 32], [52, 108, 136], water) : [46, 36, 28], depth - 2);
      if (water > 0 && ((now / 300 + T.i) | 0) % 5 === 0) { g.fillStyle = '#9fd4e8'; g.fillRect(sx - 2, sy + 5, 3, 1); }
      if (T.dam && h > 0.08) { g.fillStyle = '#8c6239'; g.fillRect(sx - 6, sy + 2, 12, 3); g.fillStyle = '#b5874f'; g.fillRect(sx - 6, sy + 2, 12, 1); }
      continue;
    }
    block(sx, sy, groundColor(p), depth);
    if (p < 0.15 && T.r < 0.25) { g.fillStyle = '#2a2420'; g.fillRect(sx + 1, sy - 2, 1, 6); }           // burnt snag
    if (h < 0.35 && p < 0.1 && T.r > 0.93) {                                                            // smouldering peat
      g.fillStyle = (now / 120 + T.i) % 3 < 1.5 ? '#f08a2c' : '#ffd25a'; g.fillRect(sx - 1, sy + 3, 2, 1);
      if (Math.random() < 0.06) smoke.push({ x: sx, y: sy, a: 1 });
    }
    if (p > 0.45 && p < 0.8 && T.r < 0.6) { g.fillStyle = '#a7c95e'; g.fillRect(sx - 3, sy + 3, 1, 2); g.fillRect(sx + 2, sy + 4, 1, 2); }
    if (p > 0.55 && T.r > 0.3) {
      const s = (p - 0.55) / 0.45, tall = 3 + Math.round(s * (4 + T.r * 4)), rad = 1 + Math.round(s * (2 + T.r * 2));
      g.fillStyle = '#4a3324'; g.fillRect(sx, sy + 4 - tall, 1, tall);
      blob(sx, sy + 4 - tall - rad + 1, rad, '#2f6b33');
      blob(sx - 1, sy + 4 - tall - rad, Math.max(0, rad - 1), '#5c9a45');
    }
  }
  for (let k = smoke.length - 1; k >= 0; k--) {
    const s = smoke[k]; s.y -= 0.25; s.x += 0.12; s.a -= 0.006;
    if (s.a <= 0) { smoke.splice(k, 1); continue; }
    g.fillStyle = `rgba(160,150,140,${s.a * 0.5})`; g.fillRect(s.x | 0, s.y | 0, 2, 2);
  }
}
