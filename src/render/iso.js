// Iso map renderer. Reads game state only; never writes it.
import { KIND, BLOCK, WET_WT, VEG, vegOf } from '../sim/world.js';
import { TW, TH, tileToScreen } from './isoMath.js';
import { TICKS_PER_YEAR } from '../sim/season.js';

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const vegVariant = i => Math.floor(hash(i) * 4) % 4;
const tileVariant = i => Math.floor(hash(i + .37) * 4) % 4; // ground art variant, not linked to the plant variant
const DRY = [124, 88, 54], WET = [64, 50, 38], GREEN = [92, 132, 54], FOREST = [54, 98, 46], WATER = [52, 108, 136];
const BLACK = [0, 0, 0], WHITE = [255, 255, 255];
const FLAME = ['#c8321e', '#f08a2c', '#ffd25a', '#fff1b0'], CHAR = '#3a2a22', SMOKE = [205, 200, 192]; // flame layers, outer to core
const HW = TW / 2, HH = TH / 2;
const D = 10, EDGE = D + 12, HEAD = 28, SW = TW, SH = HEAD + TH + EDGE + 1; // sprite: anchor (SW/2, HEAD) = tile top vertex
// Half-width of row r in a 2:1 diamond that is 2*hh rows high.
const rowW = (r, hh = HH) => r < hh ? (r + 1) * 2 : (2 * hh - r) * 2;

// Canal sprite steps. Water step 0: the water is at the bank. Water step 3: the water is at the bed.
export const canalStep = (cWater, cDepth) => cDepth > 0 ? Math.max(0, Math.min(3, Math.round(cWater / cDepth * 3))) : 0;
export const widthStep = cWidth => cWidth < 5 ? 0 : cWidth <= 8 ? 1 : 2;
// ---- joined canal channel. Ground units: the tile is [0,16] x [0,16]; pixel (px, py) from the top vertex is a = py + px/2, b = py - px/2.
// Neighbour directions; bit k of a canal mask is DIRS[k].
export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];
const isWater = k => k === KIND.CANAL || k === KIND.RIVER;
// Mask of the neighbours that a canal tile joins: each canal or river neighbour on a side, and a corner neighbour only when no side tile already joins the two.
export function canalMask(w, h, kind, i) {
  const x = i % w, y = (i - x) / w, at = (dx, dy) => x + dx >= 0 && y + dy >= 0 && x + dx < w && y + dy < h && isWater(kind[i + dy * w + dx]);
  let m = 0;
  DIRS.forEach(([dx, dy], k) => { if (at(dx, dy) && (k < 4 || (!at(dx, 0) && !at(0, dy)))) m |= 1 << k; });
  // A canal end on the map edge runs off the map: the arm continues straight, or points off the map when the end has no side arm.
  const off = [0, 1, 2, 3].filter(k => { const [dx, dy] = DIRS[k]; return x + dx < 0 || y + dy < 0 || x + dx >= w || y + dy >= h; }), sides = [0, 1, 2, 3].filter(k => m >> k & 1);
  if (sides.length === 1 && off.includes((sides[0] + 2) % 4)) m |= 1 << (sides[0] + 2) % 4;
  else if (!sides.length && off.length === 1) m |= 1 << off[0];
  return m;
}
const CW = [3.6, 4.5, 5.5]; // channel half-width in ground units for each width step
// Water half-width for each water step: full, low, dry (a thin stream), nearly empty.
const waterW = (W, ws) => [W, W - 1, Math.max(1.2, W * .3), .5][ws];
// spec = { cs, ws, arms: [[dx, dy, neighbour width step], ...] }. Each arm runs from the tile centre to the neighbour centre.
// Its width tapers from this tile's width at the centre to the mean of both widths at the tile edge, so two neighbours meet without a seam.
function chan(px, py, spec) {
  const a = py + px / 2 - 8, b = py - px / 2 - 8, W0 = CW[spec.cs];
  let d0 = Math.hypot(a, b), best = { m: W0 - d0, d: d0, W: W0 };
  for (const [dx, dy, ncs] of spec.arms) {
    const t = Math.max(0, Math.min(1, (a * dx + b * dy) / (16 * (dx * dx + dy * dy))));
    const d = Math.hypot(a - 16 * dx * t, b - 16 * dy * t), We = (W0 + CW[ncs]) / 2, W = t >= .5 ? We : W0 + (We - W0) * t * 2;
    if (W - d > best.m) best = { m: W - d, d, W };
  }
  return best;
}
// Zone of the pixel at (px, py) from the tile top vertex: 0 bank, 1 cut wall (1 row, on the far side), 2 wet bed, 3 water.
export function canalZone(px, py, spec) {
  const c = chan(px + .5, py + .5, spec);
  if (c.m < 0) return 0;
  if (spec.ws > 0 && chan(px + .5, py - .5, spec).m < 0) return 1;
  return c.d <= waterW(c.W, spec.ws) ? 3 : 2;
}
const WALL = mix(WET, BLACK, .45), MUD = mix(WET, DRY, .5); // MUD: the exposed wet bed
const SEEP = mix(WATER, WET, .55); // the bank soaked by a full canal

// For each canal tile: the 8-neighbour canal or river tile with the lowest z below its own z, or -1.
export function downstream(w, h, z, kind) {
  const ds = new Int32Array(w * h).fill(-1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (kind[i] !== KIND.CANAL) continue;
    let bz = z[i];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy, n = yy * w + xx;
      if ((dx || dy) && xx >= 0 && yy >= 0 && xx < w && yy < h && (kind[n] === KIND.CANAL || kind[n] === KIND.RIVER) && z[n] < bz) { bz = z[n]; ds[i] = n; }
    }
  }
  return ds;
}

// ---- sprite cache: built once with fillRect into offscreen canvases (same block/blob style as the intro)
let cache = null;
function sprite(draw) {
  const c = document.createElement('canvas'); c.width = SW; c.height = SH;
  const g = c.getContext('2d'); draw(g, SW / 2, HEAD); return c;
}
function block(g, sx, sy, top, depth) {
  g.fillStyle = rgb(mix(top, BLACK, .35));
  for (let dx = 0; dx < HW; dx++) g.fillRect(sx - HW + dx, sy + HH + (dx >> 1), 1, depth);
  g.fillStyle = rgb(mix(top, BLACK, .55));
  for (let dx = 0; dx < HW; dx++) g.fillRect(sx + dx, sy + TH - ((dx + 1) >> 1), 1, depth);
  g.fillStyle = rgb(top);
  for (let r = 0; r < TH; r++) { const w = rowW(r); g.fillRect(sx - w, sy + r, w * 2, 1); }
}
// Peat texture: 2 px dashes in a dark and a light shade, plus a few pale fibre specks.
function texture(g, sx, sy, top, seed) {
  const dark = rgb(mix(top, BLACK, .14)), light = rgb(mix(top, WHITE, .1)), fibre = rgb(mix(DRY, WHITE, .3));
  for (let r = 0; r < TH; r++) for (let dx = -rowW(r) + (r & 1); dx < rowW(r) - 1; dx += 2) { // odd rows start 1 px later: no straight speck columns
    const v = hash(seed * 997 + r * 61 + dx);
    if (v < .17) g.fillStyle = dark; else if (v > .92) g.fillStyle = light; else continue;
    g.fillRect(sx + dx, sy + r, v > .985 ? 1 : 2, 1);
    if (v > .985) { g.fillStyle = fibre; g.fillRect(sx + dx + 1, sy + r, 1, 1); }
  }
}
// Dry peat cracks: short zigzag lines along the 2 tile axes. n: number of cracks.
function cracks(g, sx, sy, top, seed, n) {
  g.fillStyle = rgb(mix(top, BLACK, .32));
  for (let c = 0; c < n; c++) {
    let a = 4 + hash(seed * 13 + c) * 8, b = 4 + hash(seed * 29 + c) * 8; // start point in ground units
    for (let k = 0, ax = hash(seed + c * 7) < .5; k < 5; k++) {
      const px = Math.round(a - b), py = Math.round((a + b) / 2);
      if (Math.abs(px) < rowW(py) - 1) g.fillRect(sx + px, sy + py, 2, 1);
      if (ax) a += 1.2; else b += 1.2;
      if (hash(seed * 5 + c * 11 + k) < .4) ax = !ax; // a turn gives the zigzag
    }
  }
}
// Each pixel of the tile top, in ground units (a, b) in [0, 16]. f(a, b) returns a colour or null.
function eachTop(g, sx, sy, f) {
  for (let r = 0; r < TH; r++) for (let dx = -rowW(r); dx < rowW(r); dx++) {
    const c = f(r + (dx + .5) / 2, r - (dx + .5) / 2);
    if (c) { g.fillStyle = c; g.fillRect(sx + dx, sy + r, 1, 1); }
  }
}
// A stilt house. (hx, hy): the left foot. hw: wall width. roof: [main, eave shadow].
function house(g, hx, hy, hw, roof, wall = '#d8c69a') {
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(hx, hy + 1, hw + 2, 1); // shadow on the ground
  g.fillStyle = '#3a2a1e'; g.fillRect(hx + 1, hy - 1, 1, 2); g.fillRect(hx + hw - 2, hy - 1, 1, 2); // stilts
  g.fillStyle = wall; g.fillRect(hx, hy - 6, hw, 5);
  g.fillStyle = rgb(mix(hexRgb(wall), BLACK, .2)); g.fillRect(hx + hw - 2, hy - 6, 2, 5); // the shaded end
  g.fillStyle = roof[0]; g.fillRect(hx - 2, hy - 10, hw + 4, 4); g.fillRect(hx, hy - 12, hw, 2);
  g.fillStyle = rgb(mix(hexRgb(roof[0]), WHITE, .2)); g.fillRect(hx, hy - 12, hw, 1); // ridge light
  g.fillStyle = roof[1]; g.fillRect(hx - 2, hy - 7, hw + 4, 1);
  g.fillStyle = '#3a2a1e'; g.fillRect(hx + (hw >> 1) - 1, hy - 4, 2, 3); // door
  if (hw > 8) { g.fillStyle = '#5a4630'; g.fillRect(hx + 2, hy - 5, 2, 2); } // window
}
const hexRgb = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
const ROOF = { tile: ['#9a4a2a', '#7a3a20'], zinc: ['#8a949a', '#646c72'], thatch: ['#a8884a', '#7e6434'] };
function blob(g, cx, cy, rad, col) {
  g.fillStyle = col;
  for (let dy = -rad; dy <= rad; dy++) { const w = Math.round(Math.sqrt(rad * rad - dy * dy)); g.fillRect(cx - w, cy + dy, w * 2 + 1, 1); }
}
// Flat 2:1 ellipse, for shadows, pools and mounds on the tile top.
function pool(g, cx, cy, rx, col) {
  const ry = Math.max(1, rx >> 1); g.fillStyle = col;
  for (let dy = -ry; dy <= ry; dy++) { const w = Math.round(rx * Math.sqrt(1 - (dy / (ry + .5)) ** 2)); g.fillRect(cx - w, cy + dy, w * 2 + 1, 1); }
}
const SHADOW = 'rgba(0,0,0,0.25)';
function tree(g, bx, by, tall, rad) { // (bx, by) = foot of the trunk
  pool(g, bx + 2, by, rad + 1, SHADOW);
  g.fillStyle = '#4a3324'; g.fillRect(bx - 1, by - tall, 2, tall);
  g.fillStyle = '#6a4a32'; g.fillRect(bx - 1, by - tall, 1, tall);
  const cy = by - tall - rad + 2;
  blob(g, bx, cy, rad, '#24552a'); // shadow side
  blob(g, bx - 1, cy - 1, rad - 1, '#2f6b33');
  blob(g, bx - 2, cy - 2, Math.max(1, rad - 3), '#5c9a45'); // light side
  g.fillStyle = '#7fb85a'; g.fillRect(bx - 3, cy - rad + 1, 2, 1);
}
function emergent(g, bx, by) { // tall thin trunk, high flat crown above the other trees
  pool(g, bx + 2, by, 4, SHADOW);
  g.fillStyle = '#4a3324'; g.fillRect(bx - 1, by - 19, 2, 19);
  g.fillStyle = '#6a4a32'; g.fillRect(bx - 1, by - 19, 1, 19);
  pool(g, bx, by - 21, 8, '#24552a'); // shadow side
  pool(g, bx - 1, by - 22, 7, '#2f6b33');
  pool(g, bx - 2, by - 23, 4, '#5c9a45'); // light side
  g.fillStyle = '#7fb85a'; g.fillRect(bx - 4, by - 24, 2, 1);
}
function broadCrown(g, bx, by) { // short trunk, wide round crown of 3 blobs
  pool(g, bx + 2, by, 7, SHADOW);
  g.fillStyle = '#4a3324'; g.fillRect(bx - 1, by - 6, 3, 6);
  g.fillStyle = '#6a4a32'; g.fillRect(bx - 1, by - 6, 1, 6);
  blob(g, bx - 5, by - 9, 5, '#24552a'); blob(g, bx + 5, by - 8, 5, '#24552a'); blob(g, bx, by - 12, 6, '#24552a');
  blob(g, bx - 6, by - 10, 4, '#2f6b33'); blob(g, bx + 4, by - 9, 4, '#2f6b33'); blob(g, bx - 1, by - 13, 5, '#2f6b33');
  blob(g, bx - 2, by - 14, 3, '#5c9a45'); blob(g, bx - 7, by - 11, 2, '#5c9a45');
  g.fillStyle = '#7fb85a'; g.fillRect(bx - 4, by - 16, 2, 1);
}
function pandan(g, bx, by, h) { // no trunk: stilt roots, then stiff 2 px strap leaves that arch out and down at the tips
  pool(g, bx + 1, by, 5, SHADOW);
  g.fillStyle = '#6a4a32'; g.fillRect(bx, by - 4, 1, 4); // centre root
  for (const d of [-1, 1]) for (let k = 0; k < 3; k++) g.fillRect(bx + d * (k + 1), by - 3 + k, 1, 1); // 2 diagonal stilt roots
  g.fillStyle = '#1f5a48'; g.fillRect(bx - 1, by - 5, 3, 2); // leaf base
  // [x per rise, rise, droop, colour]: each leaf goes up its slope, then its last steps bend out and down
  for (const [ax, rise, droop, c] of [[-.25, 13, 2, '#1f5a48'], [.25, 12, 2, '#1f5a48'], [-.6, 10, 3, '#2a6c54'], [.6, 9, 3, '#2a6c54'], [-1, 6, 4, '#2f7a5e'], [1, 6, 4, '#2f7a5e']]) {
    const d = ax < 0 ? -1 : 1; g.fillStyle = c;
    for (let k = 1; k <= rise; k++) g.fillRect(bx + Math.round(ax * k) - 1, by - 4 - k * h / 12 | 0, 2, 1);
    const x0 = bx + Math.round(ax * rise), y0 = by - 4 - (rise * h / 12 | 0);
    for (let k = 1; k <= droop; k++) g.fillRect(x0 + d * k - 1, y0 + (k > 1 ? k - 1 : 0), 2, 1);
  }
}
function shrub(g, bx, by, rad) {
  pool(g, bx + 1, by + 1, rad + 1, SHADOW);
  for (const [dx, dy, r, c] of [[0, 0, rad, '#2f6b33'], [-1, -1, rad - 1, '#3d7a3a'], [-2, -2, rad - 3, '#5c9a45']])
    if (r > 0) { g.fillStyle = c; for (let y = -r; y <= 0; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); g.fillRect(bx + dx - w, by + dy + y, w * 2 + 1, 1); } }
}
function seedling(g, bx, by, tall) {
  g.fillStyle = '#6f9a3a'; g.fillRect(bx, by - tall, 1, tall);
  g.fillStyle = '#a7c95e'; g.fillRect(bx - 2, by - tall, 2, 1); g.fillRect(bx + 1, by - tall + 1, 2, 1); g.fillRect(bx, by - tall - 1, 1, 1);
}
function fern(g, bx, by, len) { // a fan of fronds from one base
  for (const [ux, c] of [[-2, '#4f7a34'], [-1, '#7aa84a'], [0, '#7aa84a'], [1, '#7aa84a'], [2, '#4f7a34']])
    for (let k = 1; k <= len - Math.abs(ux); k++) { g.fillStyle = c; g.fillRect(bx + ux * k, by - k + (Math.abs(ux) > 1 ? k >> 1 : 0), 1, 1); }
}
function sapling(g, bx, by, tall) { // a thin stem with 2 tiers of leaves
  g.fillStyle = '#6f9a3a'; g.fillRect(bx, by - tall, 1, tall);
  g.fillStyle = '#a7c95e';
  for (const t of [tall, tall >> 1]) { g.fillRect(bx - 2, by - t, 2, 1); g.fillRect(bx + 1, by - t - 1, 2, 1); }
  g.fillRect(bx, by - tall - 1, 1, 1);
}
function tuft(g, bx, by) { // a sedge tuft: thin straight blades of different heights
  for (const [dx, h, c] of [[-3, 3, '#4f7a34'], [-2, 5, '#7aa84a'], [-1, 4, '#7aa84a'], [0, 6, '#a7c95e'], [1, 4, '#7aa84a'], [2, 5, '#4f7a34'], [3, 3, '#4f7a34']]) {
    g.fillStyle = c; g.fillRect(bx + dx, by - h, 1, h);
  }
}
function lowShrub(g, bx, by, rx) { // a wide flat mound with pale flower specks
  pool(g, bx + 1, by + 1, rx + 1, SHADOW);
  pool(g, bx, by, rx, '#2f6b33'); pool(g, bx - 1, by - 1, rx - 2, '#3d7a3a');
  g.fillStyle = '#e8d870'; g.fillRect(bx - 3, by - 2, 1, 1); g.fillRect(bx + 2, by - 1, 1, 1); g.fillRect(bx, by - 3, 1, 1);
}
const COVER_BINS = 5, HEAT_BINS = 16;
// wt heatmap: 0 m deep blue -> WET_WT bright blue, then a hard step to amber -> 1.5 m dark red. The step makes the wet/dry split read at a glance.
export const heatColor = wt => wt <= WET_WT ? mix([20, 60, 200], [70, 150, 240], Math.max(0, wt) / WET_WT)
  : mix([245, 185, 40], [150, 30, 20], Math.min(1, (wt - WET_WT) / (1.5 - WET_WT)));
const GROUND_BASE = [mix(WET, WATER, .55), WET, DRY]; // [flooded, wet, dry]
const groundTop = (s, b) => mix(GROUND_BASE[s], b > 2 ? FOREST : GREEN, b / (COVER_BINS - 1) * 0.8);
// Canal bank top for each bank step: dry, damp, wet, green. Each one is a ground colour of the peat sprites.
export const BANK_TOP = [groundTop(2, 0), mix(groundTop(2, 0), groundTop(1, 0), .5), groundTop(1, 0), groundTop(1, 3)];
// Bank step of canal tile i from its 4 side neighbours that are peat: 3 green (mean cover 0.6 or more), 2 wet, 1 damp (mean wt 0.8 m or less), 0 dry or no peat side.
const GREEN_COVER = Math.fround(.6), DAMP_WT = Math.fround(.8); // Float32 like the stored arrays, so a stored 0.8 counts as damp
export function bankStep(wd, i) {
  const { w, h, kind, wt, cover } = wd, x = i % w, y = (i - x) / w;
  let n = 0, c = 0, t = 0;
  for (let k = 0; k < 4; k++) {
    const [dx, dy] = DIRS[k];
    if (x + dx < 0 || y + dy < 0 || x + dx >= w || y + dy >= h) continue;
    const j = i + dy * w + dx;
    if (kind[j] === KIND.PEAT) { n++; c += cover[j]; t += wt[j]; }
  }
  return !n ? 0 : c / n >= GREEN_COVER ? 3 : t / n <= WET_WT ? 2 : t / n <= DAMP_WT ? 1 : 0;
}
// One flame tongue. Its base is at (bx, by). Layers shrink inwards. lean: sideways pixels at the tip.
function tongue(g, bx, by, h, wd, lean) {
  for (let j = 0; j < h; j++) {
    const f = j / h, half = Math.max(0, Math.round(wd / 2 * (1 - f * f))), ox = Math.round(lean * f * f);
    g.fillStyle = FLAME[0]; g.fillRect(bx - half + ox, by - j, 2 * half + 1, 1);
    if (f < .8 && half > 1) { g.fillStyle = FLAME[1]; g.fillRect(bx - half + 1 + ox, by - j, 2 * half - 1, 1); }
    if (f < .55 && half > 1) { g.fillStyle = FLAME[2]; g.fillRect(bx - half + 2 + ox, by - j, Math.max(1, 2 * half - 3), 1); }
    if (f < .3 && half > 1) { g.fillStyle = FLAME[3]; g.fillRect(bx + ox, by - j, 1, 1); }
  }
}
// Frame table for the flame sprite: [dx, height, width, lean] of 3 tongues. The heights and leans change from frame to frame.
const FLAMES = [[[-7, 9, 5, -1], [0, 14, 7, 1], [7, 8, 5, 0]], [[-7, 11, 5, 1], [0, 11, 7, -1], [7, 10, 5, 1]],
  [[-7, 8, 5, 0], [0, 15, 7, -1], [7, 9, 5, -1]], [[-7, 10, 5, -1], [0, 12, 7, 1], [7, 11, 5, 0]]];
// Smoke puff: 3 nested disks of fillRect rows, built once for each whole radius from 3 to 7.
const PUFF_ALPHA = [.18, .26, .4], PUFF_R0 = 3, PUFF_R1 = 7;
function puffSprite(r) {
  const c = document.createElement('canvas'); c.width = c.height = 2 * r + 1;
  const g = c.getContext('2d');
  PUFF_ALPHA.forEach((a, k) => {
    const rk = r * (1 - k * .3);
    g.fillStyle = `rgba(${SMOKE[0]},${SMOKE[1]},${SMOKE[2]},${a})`;
    for (let dy = -Math.floor(rk); dy <= Math.floor(rk); dy++) { const half = Math.floor(Math.sqrt(rk * rk - dy * dy)); g.fillRect(r - half, r + dy, 2 * half + 1, 1); }
  });
  return c;
}
function buildCache() {
  const both = f => [sprite((g, x, y) => f(g, x, y, D)), sprite((g, x, y) => f(g, x, y, EDGE))]; // [inner, map-edge]
  const ground = [[], [], []]; // [flooded, wet, dry][cover bin][variant]
  for (let s = 0; s < 3; s++) for (let b = 0; b < COVER_BINS; b++) ground[s][b] = [0, 1, 2, 3].map(v => both((g, x, y, d) => {
    const top = groundTop(s, b), seed = (s * COVER_BINS + b) * 4 + v;
    block(g, x, y, top, d); texture(g, x, y, top, seed);
    if (s === 2 && b < 2) cracks(g, x, y, top, seed, b ? v >> 1 : 1 + (v >> 1)); // bare dry peat cracks; cover hides them
    if (s === 0) { // water patches with sheen
      pool(g, x - 6, y + 6, 4, rgb(mix(WATER, top, .3))); pool(g, x + 6, y + 10, 3, rgb(mix(WATER, top, .3)));
      g.fillStyle = '#9fd4e8'; g.fillRect(x - 8, y + 5, 3, 1); g.fillRect(x + 5, y + 10, 2, 1);
    }
  }));
  const cache = {
    ground,
    // Fire art. A frame is drawn with its tile top vertex at (SW/2, HEAD), like a tile sprite.
    flame: FLAMES.map((f, n) => sprite((g, x, y) => {
      pool(g, x, y + 11, 11, CHAR); pool(g, x - 1, y + 10, 7, '#5a2c1a'); // scorched ground under the tongues
      g.fillStyle = FLAME[1]; for (const [ex, ey] of [[-11, 11], [10, 12], [-4, 14], [5, 9]]) if (hash(n * 9 + ex) > .35) g.fillRect(x + ex, y + ey, 1, 1); // sparks on the char
      f.forEach(([dx, h, wd, lean]) => tongue(g, x + dx, y + 11, h, wd, lean));
    })),
    // Smouldering peat: a char patch with glow cracks. The 2 frames swap the bright and the dim cracks.
    ember: [0, 1].map(k => sprite((g, x, y) => {
      pool(g, x, y + 9, 9, CHAR); pool(g, x + 1, y + 9, 5, '#2a1e18');
      [[-6, 9], [-5, 9], [-4, 10], [-3, 10], [-2, 9], [-1, 9], [0, 8], [1, 8], [2, 9], [3, 10], [4, 10], [5, 9], [-1, 10], [0, 11], [1, 11], [2, 7]]
        .forEach(([ex, ey], n) => { g.fillStyle = (n + k) % 3 ? FLAME[0] : FLAME[1 + k]; g.fillRect(x + ex, y + ey, 1, 1); });
      g.fillStyle = FLAME[2]; g.fillRect(x + (k ? 3 : -3), y + (k ? 10 : 9), 1, 1);
    })),
    puff: Array.from({ length: PUFF_R1 - PUFF_R0 + 1 }, (_, k) => puffSprite(PUFF_R0 + k)),
    heat: Array.from({ length: HEAT_BINS }, (_, b) => both((g, x, y, d) => block(g, x, y, heatColor(b / (HEAT_BINS - 1) * 1.5), d))),
    // Overlays for a block or a backfill. drawWorld draws them on top of the tile sprite.
    // [axis]: the sprite for a channel along AXES[axis]. A block lies across the channel.
    overlay: {
      [BLOCK.TEMP]: AXES.map((_, ax) => sprite((g, x, y) => { // sandbags in two rows
        for (const [s0, up] of [[-6, 0], [-4.75, 2]]) for (let s = s0; s <= -s0; s += 2.5) {
          const [bx, by] = across(ax, s, x, y);
          if (!up) { g.fillStyle = SHADOW; g.fillRect(bx - 2, by + 2, 5, 1); } // shadow under the front row
          g.fillStyle = '#8f7a4f'; g.fillRect(bx - 2, by - up + 1, 4, 1); g.fillStyle = '#c9b07a'; g.fillRect(bx - 2, by - up - 1, 4, 2);
          g.fillStyle = '#e0cc98'; g.fillRect(bx - 1, by - up - 1, 2, 1);
          g.fillStyle = '#6e5c3a'; g.fillRect(bx + 1, by - up, 1, 1); // the seam between 2 bags
        }
      })),
      [BLOCK.PERM]: AXES.map((_, ax) => sprite((g, x, y) => { // plank wall with posts, taller than the sandbags
        for (let s = -6.5; s <= 6.5; s += .5) {
          const [bx, by] = across(ax, s, x, y);
          for (let r = 0; r < 6; r++) { g.fillStyle = r ? r % 2 ? '#7a5432' : '#8c6239' : '#b5874f'; g.fillRect(bx, by - 5 + r, 2, 1); }
        }
        for (const s of [-7, -2.3, 2.3, 7]) {
          const [bx, by] = across(ax, s, x, y);
          g.fillStyle = '#4e3e2e'; g.fillRect(bx, by - 8, 2, 11); g.fillStyle = '#7a6650'; g.fillRect(bx, by - 8, 1, 11); // lit left side
          g.fillStyle = '#9a8468'; g.fillRect(bx, by - 8, 2, 1); // cut top
        }
      })),
      [BLOCK.FILLED]: [sprite((g, x, y) => { // backfilled canal (sim sets kind PEAT): low peat mound with fill seams
        pool(g, x, y + HH + 1, 11, '#6a4e30'); pool(g, x, y + HH, 10, '#8a6a44');
        g.fillStyle = '#6a4e30'; g.fillRect(x - 7, y + HH - 1, 14, 1); g.fillRect(x - 4, y + HH + 2, 8, 1);
      })],
    },
    pond: sprite((g, x, y) => { // round pool with a fish cage, over the channel
      pool(g, x, y + HH, 12, rgb(WALL)); pool(g, x, y + HH + 1, 11, rgb(WATER));
      g.fillStyle = '#9fd4e8'; g.fillRect(x - 8, y + HH, 3, 1);
      g.fillStyle = '#d8c69a'; g.fillRect(x - 4, y + HH - 2, 9, 1); g.fillRect(x - 4, y + HH + 2, 9, 1); g.fillRect(x - 4, y + HH - 2, 1, 5); g.fillRect(x + 4, y + HH - 2, 1, 5);
      g.fillStyle = '#e8a040'; g.fillRect(x - 1, y + HH, 2, 1); g.fillRect(x + 6, y + HH + 3, 2, 1); // fish
    }),
    // River: each variant moves the ripples, so a long river does not repeat one pattern.
    river: [0, 1, 2, 3].map(v => both((g, x, y, d) => {
      const top = [40, 84, 110];
      block(g, x, y + 4, top, d - 4);
      for (let k = 0; k < 3; k++) {
        const rx = Math.round((hash(v * 17 + k) - .5) * 18), ry = 6 + k * 3 + (v & 1), len = 2 + (hash(v * 5 + k) * 4 | 0);
        if (Math.abs(rx) + len < rowW(ry - 4)) { g.fillStyle = k ? '#7fb8d0' : '#a8d4e4'; g.fillRect(x + rx, y + ry, len, 1); }
      }
    })),
    // Village variants: tile roofs, a zinc roof, a thatch roof, and a row of 3 small houses.
    village: [0, 1, 2, 3].map(v => both((g, x, y, d) => {
      const top = [112, 92, 62];
      block(g, x, y, top, d); texture(g, x, y, top, 42 + v);
      eachTop(g, x, y, (a, b) => Math.abs(a - b) < 1.6 && a > 2 && a < 14 ? rgb(mix(top, WHITE, .12)) : null); // a beaten path across the tile
      if (v === 0) { house(g, x - 10, y + 7, 10, ROOF.tile); house(g, x + 2, y + 10, 10, ROOF.tile); }
      if (v === 1) { tree(g, x - 8, y + 8, 4, 3); house(g, x - 3, y + 11, 12, ROOF.zinc, '#c8b48a'); }
      if (v === 2) { house(g, x + 1, y + 7, 10, ROOF.thatch, '#b89a6a'); house(g, x - 11, y + 10, 10, ROOF.tile); }
      if (v === 3) { for (const [hx, hy, r] of [[-11, 7, 'zinc'], [-3, 10, 'tile'], [5, 13, 'thatch']]) house(g, x + hx, y + hy, 7, ROOF[r]); }
    })),
    // Farm variants: crop rows along each tile axis, cassava mounds, and a part-planted plot.
    farm: [0, 1, 2, 3].map(v => both((g, x, y, d) => {
      const top = [128, 100, 60], leaf = '#7fa842', dark = '#5c8232';
      block(g, x, y, top, d); texture(g, x, y, top, 60 + v);
      eachTop(g, x, y, (a, b) => {
        if (a < 1.5 || b < 1.5 || a > 14.5 || b > 14.5) return null; // a bare rim
        const u = v === 1 ? a : b, m = u % 3;
        if (v === 2) return (a % 4 < 1.6 && b % 4 < 1.6) ? (a % 4 < .8 ? leaf : dark) : null;
        if (v === 3 && a > 9) return m < .8 ? rgb(mix(top, BLACK, .2)) : null; // ploughed furrows, not planted yet
        return m < .8 ? leaf : m < 1.4 ? dark : null;
      });
    })),
    veg: { // 4 sprites for each type, picked by vegVariant(i)
      [VEG.FERN]: [sprite((g, x, y) => { fern(g, x - 5, y + 8, 4); fern(g, x + 5, y + 11, 3); }), sprite((g, x, y) => { fern(g, x + 1, y + 10, 5); fern(g, x - 7, y + 9, 3); }),
        sprite((g, x, y) => { tuft(g, x - 4, y + 9); tuft(g, x + 5, y + 12); }), sprite((g, x, y) => { fern(g, x - 2, y + 11, 6); fern(g, x + 7, y + 9, 2); fern(g, x - 8, y + 8, 2); })],
      [VEG.SEEDLING]: [sprite((g, x, y) => { seedling(g, x - 5, y + 8, 4); seedling(g, x + 3, y + 7, 3); seedling(g, x, y + 12, 4); }),
        sprite((g, x, y) => { seedling(g, x - 3, y + 10, 4); seedling(g, x + 5, y + 9, 5); }),
        sprite((g, x, y) => { for (const [dx, dy, t] of [[-7, 8, 2], [-2, 7, 3], [4, 8, 2], [-4, 12, 3], [3, 12, 2]]) seedling(g, x + dx, y + dy, t); }),
        sprite((g, x, y) => { sapling(g, x - 2, y + 11, 8); seedling(g, x + 6, y + 9, 3); })],
      [VEG.SHRUB]: [sprite((g, x, y) => { shrub(g, x - 4, y + 8, 5); shrub(g, x + 5, y + 11, 4); }), sprite((g, x, y) => { shrub(g, x + 1, y + 10, 6); shrub(g, x - 8, y + 9, 3); }),
        sprite((g, x, y) => { shrub(g, x - 7, y + 9, 3); shrub(g, x + 1, y + 8, 3); shrub(g, x + 7, y + 11, 3); shrub(g, x - 3, y + 13, 3); }), sprite((g, x, y) => { lowShrub(g, x - 1, y + 10, 9); })],
      [VEG.TREE]: [sprite((g, x, y) => { tree(g, x - 5, y + 9, 5, 3); tree(g, x + 5, y + 12, 4, 3); }), // young trees
        sprite((g, x, y) => { broadCrown(g, x + 1, y + 12); tree(g, x - 9, y + 9, 5, 3); }),
        sprite((g, x, y) => { tree(g, x + 6, y + 8, 7, 4); emergent(g, x - 2, y + 12); }),
        sprite((g, x, y) => { pandan(g, x - 5, y + 9, 12); pandan(g, x + 4, y + 12, 13); tree(g, x + 9, y + 8, 4, 3); })]
    },
  };
  return cache;
}

// ---- wildlife: one 16x16 sprite per species, drawn once from a character grid (one letter per pixel, '.' is empty).
// The art sits at the bottom centre of the canvas, so the feet are at the tile centre. The silhouette is the same shape in one dark colour.
const AS = 16, SILHOUETTE = '#4a4338';
export const ANIMALS = {
  orangutan: { pal: { o: '#c8622a', O: '#e8863c', f: '#dca468', m: '#a8754a', k: '#1c120c' }, rows: [
    '...oooooo...',
    '..oOOoooOo..',
    '..offffffo..',
    '..ofkffkfo..',
    '..offmmffo..',
    '...offffo...',
    '.oooooooooo.',
    'oooOoooooOoo',
    'ooo.oooo.ooo',
    'oo..oooo..oo',
    'oo..oooo..oo',
    '....oo.oo...'] },
  gibbon: { pal: { d: '#3a2e28', w: '#e6dcc8', k: '#241a16' }, rows: [
    '...dddd...',
    '..dwwwwd..',
    '..wkwwkw..',
    '..dwwwwd..',
    '...dddd...',
    '.dddddddd.',
    'dd.dddd.dd',
    'dd.dddd.dd',
    'd..dddd..d',
    'd...dd...d',
    'd..d..d..d'] },
  langur: { pal: { r: '#8a3a28', e: '#5a241a', k: '#1c120c' }, rows: [
    '..rrrr',
    '.rrrrrr',
    '.rkrrkr',
    '.rrrrrr.....r',
    '..rrrr.....rr',
    '..rrrrrr..rr',
    '.rrrrrrrrrr',
    '.rrrrrrrrr',
    '.rrrrrrr',
    '.rr..rr',
    '.ee..ee'] },
  sunbear: { pal: { d: '#2c2420', t: '#c8a060', y: '#e0b050', k: '#0e0a08' }, rows: [
    '..dd',
    '.dddd',
    'dtttddddddd',
    'dtktdddddddd',
    'tttddddddddddd',
    '.ddyyyddddddddd',
    '.dddyydddddddd',
    '.dddddddddddddd',
    '.dd.dd...dd.dd',
    '.dd.dd...dd.dd',
    '.tt.tt...tt.tt'] },
  hornbill: { pal: { y: '#e8c040', o: '#d8802c', b: '#1c1a22', w: '#f0ece0', k: '#f0ece0', l: '#8a6a3a' }, rows: [
    '..yyyy',
    '.yyyyyy',
    'oooyyyb',
    'ooooykbb',
    '.oooobbbbb',
    '....bbbbbbbbb',
    '....bbwwbbbbbb',
    '.....bwwwbbbbbb',
    '.....bbbbbbwwww',
    '......b.b..wwww',
    '......l.l..bbbb'] },
  stork: { pal: { b: '#1c1a22', w: '#f0ece0', r: '#d04a3a', k: '#f0ece0' }, rows: [
    '...bbb',
    '..bbkb',
    'rrrbbb',
    '...bbw',
    '....ww',
    '....ww',
    '...bbbbbb',
    '..bbbbbbbbb',
    '..bbbbbbbbbb',
    '...wwbbbbbb',
    '....bbbbb',
    '.....r.r',
    '.....r.r',
    '.....r.r',
    '.....r.r',
    '....rr.rr'] },
  fishowl: { pal: { b: '#b08a50', d: '#6a4a2a', y: '#f0d040', k: '#1c120c', o: '#d8802c' }, rows: [
    '..d......d..',
    '..dd....dd..',
    '..bbbbbbbb..',
    '.bbykbbkybb.',
    '.bbyybbyybb.',
    '.bbbbooobbb.',
    '..bbbbbbbb..',
    '..bdbdbdbb..',
    '..bbdbdbdb..',
    '..bdbdbdbb..',
    '...bbbbbb...',
    '...oo..oo...'] },
  snakehead: { pal: { n: '#1f2e26', l: '#bfe6f2' }, rows: [
    '.....n......',
    '....nnn.....',
    '...nnnnn....',
    '.llllllllll.',
    'l..l....l..l'] },
  otter: { pal: { b: '#7a5030', t: '#d8c4a0', k: '#1c120c', l: '#bfe6f2' }, rows: [
    '..bb',
    '.bbbb',
    '.bkbbbbb',
    '.tttbbbbbb',
    '.ttbbbbbbbb',
    'lll.llll.lll',
    '.l..l..l..l.'] },
  gharial: { pal: { g: '#6a7a3a', d: '#3e4a24', k: '#f0d040', b: '#a8b070' }, rows: [
    '.......dd.d.d.d.',
    '....gggggggggggg',
    'ggggggkgggggggdd',
    'bbbbbbbbbbbbbb..',
    '......g.g..g.g..'] },
  monitor: { pal: { m: '#4a5238', l: '#8a9460', k: '#e8d860', t: '#c04a3a' }, rows: [
    '..mm............',
    't.mmkmmmm.......',
    '..mmmlmlmmmmmm..',
    '..mmmmmmmmmmmmmm',
    '..mm.mm..mm.mm..'] },
};
const animals = new Map();
export function animalSprite(id, silhouette = false) {
  const key = silhouette ? '!' + id : id;
  let c = animals.get(key);
  if (c) return c;
  const { pal, rows } = ANIMALS[id], ox = AS - Math.max(...rows.map(r => r.length)) >> 1, oy = AS - rows.length;
  c = document.createElement('canvas'); c.width = c.height = AS;
  const g = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = silhouette ? SILHOUETTE : pal[ch]; g.fillRect(ox + x, oy + y, 1, 1); } }));
  animals.set(key, c);
  return c;
}
// Slide state of each animal, by id: when its last move started, when it first showed, when its leave fade started.
const SLIDE_MS = 600;
const slides = new Map(), drawList = [], pa = [0, 0], pb = [0, 0];
let slideFrame = 0;
export const resetSlides = () => slides.clear();
export const slideCount = () => slides.size;
const clamp01 = v => Math.max(0, Math.min(1, v));
// Pure. Linear blend of two points. t is 0 to 1. out is optional, to avoid an allocation.
export const slidePos = (a, b, t, out = [0, 0]) => { out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; return out; };
// Pure. Alpha of an animal. age: ms since it first showed (fade in). leavingAge: ms since it left on an edge tile, or -1 (fade out).
export const fadeAlpha = (age, leavingAge = -1) => Math.min(clamp01(age / SLIDE_MS), leavingAge < 0 ? 1 : 1 - clamp01(leavingAge / SLIDE_MS));
// Finds or makes the slide entry of animal a, and starts a new slide when it moved. w, h: map size, for the edge test. frame: draw frame number.
export function slideState(a, tick, now, w, h, frame, map = slides) {
  const moved = a.moved ?? a.born ?? 0, born = a.born ?? 0;
  let s = map.get(a.id);
  if (!s) { // first sight: a new animal fades in. An old move is already settled; a move in this week step slides.
    const settled = moved !== born && tick - moved >= 4;
    s = { moved, seenAt: settled ? now - SLIDE_MS : now, shownAt: moved === born ? now : now - SLIDE_MS, leaveAt: -1, f: 0 };
    map.set(a.id, s);
  } else if (s.moved !== moved) { s.moved = moved; s.seenAt = now; }
  s.f = frame;
  if (a.leaving && s.leaveAt < 0 && Math.min(a.i % w, (a.i / w) | 0, w - 1 - a.i % w, h - 1 - ((a.i / w) | 0)) === 0) s.leaveAt = now; // the sim removes it at the next weekly step
  return s;
}
// Pure. Hit radius in buffer px: 22 CSS px (half of a 44 px target), but at least the reach of the sprite from its centre.
export const hitRadius = scale => Math.max(22 / scale, AS / 2 + 1);
// Pure. The hit nearest to (bx, by) within maxD, or null.
export function nearestHit(hits, bx, by, maxD) {
  let best = null, bd = maxD;
  for (const h of hits) { const d = Math.hypot(h.bx - bx, h.by - by); if (d <= bd) { best = h; bd = d; } }
  return best;
}

// Channel axes (ground directions) and the screen point at ground distance s across the channel from the tile centre.
const AXES = [[1, 0], [0, 1], [1, 1], [1, -1]];
const axisOf = k => k < 4 ? k & 1 : k === 4 || k === 6 ? 2 : 3; // DIRS index to AXES index
function across(ax, s, x, y) {
  const [ux, uy] = AXES[ax], n = Math.hypot(ux, uy), a = 8 - uy / n * s, b = 8 + ux / n * s;
  return [x + Math.round(a - b), y + Math.round((a + b) / 2)];
}
// A canal that runs off the map edge cuts its cross-section into the front wall. k = 0: the right face (x + 1 side). k = 1: the left face (y + 1 side).
// Rows from the top of the wall: the cut wall above the water, the water, then the bed row. The water step sets where the water starts.
const NOTCH = 8;
// The wall above the water is the face colour of the bank, a little darker. It was near black (WALL) and made a black bar.
function notch(g, sx, sy, k, spec, bank) {
  const W = CW[spec.cs], ww = waterW(W, spec.ws), wl = spec.ws * 2, t = k ? .15 : .3; // t: the shade of this face
  const col = c => rgb(mix(c, BLACK, t)), wall = rgb(mix(mix(bank, BLACK, k ? .35 : .55), BLACK, .15)); // the block() face colour, a little darker
  for (let dx = 0; dx < HW; dx++) {
    const u = (k ? dx : 15 - dx) + .5 - 8, top = k ? sy + HH + (dx >> 1) : sy + TH - ((dx + 1) >> 1); // u: ground distance from the channel axis
    if (Math.abs(u) > W) continue;
    for (let r = 0; r < NOTCH; r++) {
      g.fillStyle = r < wl ? wall : col(r < NOTCH - 1 && Math.abs(u) <= ww ? WATER : MUD);
      g.fillRect(k ? sx - HW + dx : sx + dx, top + r, 1, 1);
    }
  }
}
// Canal sprite key: 2 bits per direction (0 = no arm, else 1 + the neighbour width step), then the width step, water step and map-edge flag.
// Bits 24-25 hold the bank step. The sprite id adds the patch index (o + 1) in bits 21-23.
// A patch (o >= 0) draws only the channel pixels that fall in the side tile DIRS[o] of the canal tile, where a corner join crosses it.
const canalSprites = new Map();
export const canalId = (key, o = -1) => key + (o + 1) * (1 << 21);
export function canalSprite(key, o = -1) {
  const id = canalId(key, o);
  let c = canalSprites.get(id);
  if (c) return c;
  const arms = [];
  DIRS.forEach(([dx, dy], k) => { const v = (key >> 2 * k) & 3; if (v) arms.push([dx, dy, v - 1]); });
  const spec = { arms, cs: (key >> 16) & 3, ws: (key >> 18) & 3 }, bed = rgb(spec.ws === 3 ? mix(MUD, DRY, .4) : MUD), bank = BANK_TOP[(key >> 24) & 3], edge = (key >> 20) & 1;
  const [ox, oy] = o < 0 ? [0, 0] : DIRS[o], fx = (ox - oy) * HW, fy = (ox + oy) * HH;
  c = sprite((g, x, y) => {
    if (o < 0) {
      block(g, x, y, bank, edge ? EDGE : D); texture(g, x, y, bank, 40);
      if (edge) for (const k of [0, 1]) if ((key >> 2 * k) & 3) notch(g, x, y, k, spec, bank);
    }
    for (let r = fy; r < fy + TH; r++) for (let dx = fx - rowW(r - fy); dx < fx + rowW(r - fy); dx++) {
      const zn = canalZone(dx, r, spec), v = hash(r * 61 + dx + 7);
      if (!zn) { // full canal (a block holds the water): a wet seep line soaks the bank along the brim
        if (spec.ws === 0 && chan(dx + .5, r + .5, spec).m > -2.2) { g.fillStyle = v > .88 ? rgb(mix(WATER, WHITE, .3)) : rgb(SEEP); g.fillRect(x + dx - fx, y + r - fy, 1, 1); }
        continue;
      }
      g.fillStyle = zn === 1 ? rgb(WALL) : zn === 2 ? (v > .88 ? rgb(mix(MUD, WHITE, .35)) : bed)
        : canalZone(dx, r - 1, spec) !== 3 ? rgb(mix(WATER, WHITE, .3)) : v > .97 ? '#9fd4e8' : rgb(WATER);
      g.fillRect(x + dx - fx, y + r - fy, 1, 1); // a patch lies in the side tile frame
    }
  });
  canalSprites.set(id, c);
  return c;
}

// Micro-relief for the z offset: z minus its 3x3 mean (cheap local trend; the sim's dome is not exported).
function zMicro(w, h, z, x, y) {
  let s = 0, n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const xx = x + dx, yy = y + dy;
    if (xx >= 0 && yy >= 0 && xx < w && yy < h) { s += z[yy * w + xx]; n++; }
  }
  return z[y * w + x] - s / n;
}

// Diamond outline pixels on one or more edges: 'tl','tr','br','bl'.
function edges(ctx, sx, sy, which) {
  for (let r = 0; r < TH; r++) {
    const w = rowW(r), top = r < HH;
    if (which.includes(top ? 'tl' : 'bl')) ctx.fillRect(sx - w, sy + r, 2, 1);
    if (which.includes(top ? 'tr' : 'br')) ctx.fillRect(sx + w - 2, sy + r, 2, 1);
  }
}

// The sim makes a new drainage strength array (game.S) at each drainage change. Then drawWorld finds the downstream tiles again.
// shortcut: subsidence changes z inside a year without a new game.S, so the flow can be up to 1 year out of date. Rebuild on a z change if that shows.
let flow = null, flowS = null, flowYear = -1, canalBase = null, axis = null, patches = null, bankWeek = -1;
// Put the bank step of each canal tile in bits 24-25 of its base key.
const setBanks = wd => { for (let i = 0; i < wd.w * wd.h; i++) if (wd.kind[i] === KIND.CANAL) canalBase[i] = canalBase[i] & 0xffffff | bankStep(wd, i) << 24; };
// ---- smoke. A ring of 160 puffs that the code reuses. Each puff is stored as an offset from tile 0, so a pan or a zoom moves it with the map.
const REDUCED = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; // read once; Node has no matchMedia
const SMOKE_MAX = 160, EMIT_MS = [0, 400, 1200]; // by fire kind: 1 surface fire, 2 smouldering
export const smoke = [];
let smokeHead = 0, smokeN = 0, wind = 0, originX = 0, originY = 0, nFire = 0, emitScale = 1;
const smokeSlot = new Map(); // tile -> last emit slot, so the rate does not depend on the frame rate. It has at most w*h keys and resetSmoke clears it.
// Pure. Wind angle in radians for a map seed and a year. A new year gives a new direction.
export const yearDir = (seed, year) => hash(seed * 31 + year) * 2 * Math.PI;
export function resetSmoke() { smoke.length = 0; smokeHead = 0; smokeN = 0; nFire = 0; emitScale = 1; smokeSlot.clear(); }
// With many fires the ring would reuse puffs too soon. Each tile then emits less often: 14 fires or fewer give the normal rate.
export const setFireCount = n => { emitScale = Math.max(1, n / 14); };
// Emits at most 1 puff for tile i. sx, sy: the screen point of the tile centre. kind: 1 surface fire (the puff starts at the flame tip), 2 smouldering.
export function emitSmoke(i, sx, sy, kind, now) {
  if (REDUCED) return;
  const ms = EMIT_MS[kind] * emitScale, slot = Math.floor((now + hash(i) * ms) / ms);
  if (smokeSlot.get(i) === slot) return;
  smokeSlot.set(i, slot);
  const a = wind + (hash(++smokeN) - .5) * Math.PI / 3; // wind +- 30 degrees
  const p = smoke.length < SMOKE_MAX ? smoke[smoke.length] = {} : smoke[smokeHead++ % SMOKE_MAX]; // when full, the oldest puff goes
  p.x = sx - originX; p.y = sy - originY - (kind === 1 ? 14 : 4); p.vx = Math.cos(a) * 6; p.vy = Math.sin(a) * 6 - 4; p.born = now; p.life = 3000 + hash(smokeN + .5) * 3000;
}
export function drawSmoke(ctx, now, data) {
  if (data || !cache) return;
  for (const p of smoke) {
    const t = (now - p.born) / p.life;
    if (t < 0 || t >= 1) continue;
    const s = (now - p.born) / 1000, r = Math.round(PUFF_R0 + (PUFF_R1 - PUFF_R0) * t);
    ctx.globalAlpha = (1 - t) ** .7; // the disks hold the 0.18 / 0.26 / 0.4 alpha
    ctx.drawImage(cache.puff[r - PUFF_R0], Math.round(originX + p.x + p.vx * s) - r, Math.round(originY + p.y + p.vy * s) - r);
  }
  ctx.globalAlpha = 1;
}
export function drawWorld(ctx, game, view, mode = 'normal', hover = null, now = 0) {
  cache ??= buildCache();
  const wd = game.world, { w, h, z, wt, cover, kind, block: blk, fire, cWidth, cDepth, cWater } = wd, data = mode === 'data';
  const bw = view.bw ?? ctx.canvas.width, bh = view.bh ?? ctx.canvas.height;
  const year = Math.floor(game.tick / TICKS_PER_YEAR);
  const week = game.bankWeek ?? game.tick >> 2; // the intro story has a fixed tick, so it sets its own bank week
  if (game.S !== flowS || year !== flowYear || flow?.length !== w * h) {
    flow = downstream(w, h, z, kind); flowS = game.S; flowYear = year;
    canalBase = new Int32Array(w * h); axis = new Uint8Array(w * h); patches = new Map(); // side tile -> [[canal tile, DIRS index of the side tile]]
    for (let i = 0; i < w * h; i++) if (kind[i] === KIND.CANAL) {
      const m = canalMask(w, h, kind, i), cs = widthStep(cWidth[i]);
      let key = cs << 16;
      DIRS.forEach(([dx, dy], k) => { // an off-map arm reads no tile: it uses this tile's width step
        const x = i % w + dx, y = ((i / w) | 0) + dy, n = x >= 0 && y >= 0 && x < w && y < h && kind[y * w + x] === KIND.CANAL;
        if (m >> k & 1) key |= (1 + (n ? widthStep(cWidth[y * w + x]) : cs)) << 2 * k;
      });
      canalBase[i] = key; axis[i] = m ? axisOf(31 - Math.clz32(m & -m)) : 0;
      for (let k = 4; k < 8; k++) if (m >> k & 1) for (const o of [DIRS[k][0] > 0 ? 0 : 2, DIRS[k][1] > 0 ? 1 : 3]) {
        const f = i + DIRS[o][1] * w + DIRS[o][0];
        if (!patches.has(f)) patches.set(f, []);
        patches.get(f).push([i, o]);
      }
    }
    setBanks(wd); bankWeek = week;
  } else if (week !== bankWeek) { setBanks(wd); bankWeek = week; } // the peat changes slowly: one update each week, so the banks do not flicker
  const jobs = new Set(game.jobs.map(j => j.i)), hits = [];
  const pos = new Int16Array(w * h * 2), shown = new Uint8Array(w * h);
  wind = yearDir(wd.seed, year); setFireCount(nFire); nFire = 0; // the fire count of the last frame sets the smoke rate
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { // water tiles stay flat, so a channel has no steps at the joins
    const i = y * w + x, [sx, sy] = tileToScreen(x, y, isWater(kind[i]) ? 0 : zMicro(w, h, z, x, y), view);
    pos[2 * i] = sx; pos[2 * i + 1] = sy;
  }
  originX = pos[0]; originY = pos[1];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { // row-major is back-to-front for this iso layout
    const i = y * w + x, sx = pos[2 * i], sy = pos[2 * i + 1], e = x === w - 1 || y === h - 1 ? 1 : 0;
    if (sx + HW < 0 || sx - HW > bw || sy - HEAD + SH < 0 || sy - HEAD > bh) continue;
    shown[i] = 1;
    const k = kind[i];
    let spr;
    if (data) spr = cache.heat[Math.round(Math.max(0, Math.min(1, wt[i] / 1.5)) * (HEAT_BINS - 1))];
    else if (k === KIND.CANAL) { const c = canalSprite(canalBase[i] | canalStep(cWater[i], cDepth[i]) << 18 | e << 20); spr = [c, c]; }
    else if (k === KIND.RIVER) spr = cache.river[tileVariant(i)];
    else if (k === KIND.VILLAGE) spr = cache.village[tileVariant(i)];
    else if (k === KIND.FARM) spr = cache.farm[tileVariant(i)];
    else spr = cache.ground[wt[i] < 0 ? 0 : wt[i] <= WET_WT ? 1 : 2][Math.round(Math.max(0, Math.min(1, cover[i])) * (COVER_BINS - 1))][tileVariant(i)];
    const ax = sx - SW / 2, ay = sy - HEAD;
    ctx.drawImage(spr[e], ax, ay);
    if (data) continue;
    for (const [c, o] of patches.get(i) ?? []) { // a corner join crosses this tile: line up its channel pixels with the canal tile
      const [ox, oy] = DIRS[o];
      ctx.drawImage(canalSprite(canalBase[c] | canalStep(cWater[c], cDepth[c]) << 18, o), pos[2 * c] + (ox - oy) * HW - SW / 2, pos[2 * c + 1] + (ox + oy) * HH - HEAD);
    }
    if (k === KIND.CANAL && game.ponds.has(i)) ctx.drawImage(cache.pond, ax, ay);
    const ov = cache.overlay[blk[i]];
    if (ov) ctx.drawImage(ov[axis[i]] ?? ov[0], ax, ay);
    if (k === KIND.PEAT && !fire[i]) {
      const veg = game.seedlings.has(i) ? VEG.SEEDLING : vegOf(cover[i]);
      if (veg !== VEG.NONE) ctx.drawImage(cache.veg[veg][vegVariant(i)], ax, ay);
    }
    if (game.wells.has(i)) { ctx.fillStyle = '#2a2420'; ctx.fillRect(sx - 4, sy + 6, 8, 6); ctx.fillStyle = '#5ab4e0'; ctx.fillRect(sx - 2, sy + 8, 4, 2); }
    if (game.paluds.has(i)) { ctx.fillStyle = '#c8e070'; for (let r = 4; r < 14; r += 4) ctx.fillRect(sx - 8 + r % 8, sy + r, 2, 2), ctx.fillRect(sx + 4 - r % 8, sy + r, 2, 2); }
    if (game.fireGroups.has(i)) { ctx.fillStyle = '#d23a2a'; ctx.fillRect(sx + 12, sy - 8, 2, 12); ctx.fillRect(sx + 14, sy - 8, 6, 4); }
    if (fire[i] === 1) { // surface fire: a cached flame frame, with a phase for each tile
      nFire++; ctx.drawImage(cache.flame[REDUCED ? 0 : ((now / 120 + hash(i) * 4) | 0) % 4], ax, ay); emitSmoke(i, sx, sy + HH, 1, now);
    } else if (fire[i] === 2) { // smouldering peat: an ember, and thin smoke
      nFire++; ctx.drawImage(cache.ember[REDUCED ? 0 : ((now / 400 + hash(i) * 2) | 0) % 2], ax, ay); emitSmoke(i, sx, sy + HH, 2, now);
    }
    if (jobs.has(i)) { ctx.fillStyle = '#efe6cf'; ctx.fillRect(sx - 1, sy - 10, 2, 16); ctx.fillStyle = '#e8b04a'; ctx.fillRect(sx + 1, sy - 10, 8, 4); } // work flag
  }
  if (!data) { // flow markers: 2 light pixels move from the tile centre to the downstream tile centre
    ctx.fillStyle = '#d8f0fa';
    for (let i = 0; i < w * h; i++) {
      const n = flow[i];
      if (n < 0 || !shown[i] || kind[i] !== KIND.CANAL || blk[i] !== BLOCK.NONE || blk[n] !== BLOCK.NONE) continue;
      const cx = pos[2 * i], cy = pos[2 * i + 1] + HH;
      for (let m = 0; m < 2; m++) {
        const t = (now / 600 + hash(i) + m / 2) % 1;
        ctx.fillRect(cx + Math.round((pos[2 * n] - pos[2 * i]) * t), cy + Math.round((pos[2 * n + 1] - pos[2 * i + 1]) * t), 1, 1);
      }
    }
  }
  const dbg = globalThis.rewet; // ?debug only
  if (!data) { // animals: their own pass, sorted by drawn y, so a slide keeps the depth order. The feet are at the tile centre.
    // Trade-off: an animal now draws over the plants of the tile below it. A tile pass drew those plants over the animal.
    slideFrame++; if (dbg) dbg.slides = slides;
    const fauna = game.fauna ?? []; let n = 0;
    for (const a of fauna) {
      const from = a.from ?? a.i;
      const s = slideState(a, game.tick, now, w, h, slideFrame);
      const d = drawList[n] ??= { x: 0, y: 0, al: 1, a: null, xy: [0, 0] };
      pa[0] = pos[2 * from]; pa[1] = pos[2 * from + 1]; pb[0] = pos[2 * a.i]; pb[1] = pos[2 * a.i + 1];
      slidePos(pa, pb, clamp01((now - s.seenAt) / SLIDE_MS), d.xy);
      d.x = Math.round(d.xy[0]); d.y = Math.round(d.xy[1]) + HH + 3; d.a = a; d.al = fadeAlpha(now - s.shownAt, s.leaveAt < 0 ? -1 : now - s.leaveAt);
      n++;
    }
    if (slides.size > n) for (const [id, s] of slides) if (s.f !== slideFrame) slides.delete(id);
    drawList.length = n; drawList.sort((p, q) => p.y - q.y);
    for (const d of drawList) {
      const a = d.a, up = Math.sin(now / 700 + hash(a.id) * 6.28) > .7 ? 1 : 0; // 1 px idle step, slow
      if (d.al < 1) ctx.globalAlpha = d.al;
      ctx.drawImage(animalSprite(a.species), d.x - AS / 2, d.y - AS - up);
      ctx.globalAlpha = 1;
      if (d.al > 0.2) hits.push({ species: a.species, bx: d.x, by: d.y - AS / 2 }); // a faded animal is not tappable
      if (dbg) (dbg.drawn ??= new Map()).set(a.id, { x: d.x, y: d.y, al: d.al, i: a.i, rx: pos[0], ry: pos[1] });
    }
  }
  drawSmoke(ctx, now, data);
  if (data) { // bright line where neighbouring tiles straddle WET_WT
    ctx.fillStyle = '#5ff0ff';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, wet = wt[i] <= WET_WT, which = [];
      if (x + 1 < w && (wt[i + 1] <= WET_WT) !== wet) which.push('br');
      if (y + 1 < h && (wt[i + w] <= WET_WT) !== wet) which.push('bl');
      if (which.length) edges(ctx, pos[2 * i], pos[2 * i + 1], which);
    }
  }
  if (hover != null) { ctx.fillStyle = '#ffffff'; edges(ctx, pos[2 * hover], pos[2 * hover + 1], ['tl', 'tr', 'br', 'bl']); }
  return hits;
}
