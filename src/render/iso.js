// Iso map renderer. Reads game state only; never writes it.
import { KIND, BLOCK, WET_WT, VEG, vegOf } from '../sim/world.js';
import { TW, TH, tileToScreen } from './isoMath.js';

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const DRY = [124, 88, 54], WET = [64, 50, 38], GREEN = [92, 132, 54], FOREST = [54, 98, 46], WATER = [52, 108, 136];
const BLACK = [0, 0, 0], WHITE = [255, 255, 255], BANK = mix(DRY, WHITE, .15);
const HW = TW / 2, HH = TH / 2;
const D = 10, EDGE = D + 12, HEAD = 28, SW = TW, SH = HEAD + TH + EDGE + 1; // sprite: anchor (SW/2, HEAD) = tile top vertex
// Half-width of row r in a 2:1 diamond that is 2*hh rows high.
const rowW = (r, hh = HH) => r < hh ? (r + 1) * 2 : (2 * hh - r) * 2;

// Canal sprite steps. Water step 0: the water is at the bank. Water step 3: the water is at the bed.
export const canalStep = (cWater, cDepth) => cDepth > 0 ? Math.max(0, Math.min(3, Math.round(cWater / cDepth * 3))) : 0;
export const widthStep = cWidth => cWidth < 5 ? 0 : cWidth <= 8 ? 1 : 2;
const HOLE = [3, 4, 6]; // half-height in px of the channel for each width step
const dropPx = (ws, cs) => Math.round(ws * (2 * HOLE[cs] - 1) / 3); // px from the bank down to the water surface

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
  for (let r = 0; r < TH; r++) for (let dx = -rowW(r); dx < rowW(r) - 1; dx += 2) {
    const v = hash(seed * 997 + r * 61 + dx);
    if (v < .2) g.fillStyle = dark; else if (v > .9) g.fillStyle = light; else continue;
    g.fillRect(sx + dx, sy + r, v > .985 ? 1 : 2, 1);
    if (v > .985) { g.fillStyle = fibre; g.fillRect(sx + dx + 1, sy + r, 1, 1); }
  }
}
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
const COVER_BINS = 5, HEAT_BINS = 16;
// wt heatmap: 0 m blue -> WET_WT pale neutral -> 1.5 m brown, so the wet/dry split reads at a glance.
export const heatColor = wt => wt <= WET_WT ? mix([40, 90, 170], [176, 170, 148], Math.max(0, wt) / WET_WT)
  : mix([176, 170, 148], [120, 76, 36], Math.min(1, (wt - WET_WT) / (1.5 - WET_WT)));
function buildCache() {
  const both = f => [sprite((g, x, y) => f(g, x, y, D)), sprite((g, x, y) => f(g, x, y, EDGE))]; // [inner, map-edge]
  const ground = [[], [], []]; // [flooded, wet, dry][cover bin]
  const base = [mix(WET, WATER, .55), WET, DRY];
  for (let s = 0; s < 3; s++) for (let b = 0; b < COVER_BINS; b++) ground[s][b] = both((g, x, y, d) => {
    const top = mix(base[s], b > 2 ? FOREST : GREEN, b / (COVER_BINS - 1) * 0.8);
    block(g, x, y, top, d); texture(g, x, y, top, s * COVER_BINS + b);
    if (s === 0) { // water patches with sheen
      pool(g, x - 6, y + 6, 4, rgb(mix(WATER, top, .3))); pool(g, x + 6, y + 10, 3, rgb(mix(WATER, top, .3)));
      g.fillStyle = '#9fd4e8'; g.fillRect(x - 8, y + 5, 3, 1); g.fillRect(x + 5, y + 10, 2, 1);
    }
  });
  // Canal: bank, then the channel cut into it. The wet bed shows above the water surface.
  const canal = [0, 1, 2, 3].map(ws => [0, 1, 2].map(cs => both((g, x, y, d) => {
    block(g, x, y, BANK, d); texture(g, x, y, BANK, 40);
    const hh = HOLE[cs], top = y + HH - hh, drop = dropPx(ws, cs);
    for (let r = 0; r < 2 * hh; r++) {
      const w = rowW(r, hh);
      g.fillStyle = rgb(r < 2 ? mix(WET, BLACK, .45) : mix(WET, WATER, .25)); g.fillRect(x - w, top + r, w * 2, 1);
      if (r - drop < 0) continue;
      const ww = Math.min(w, rowW(r - drop, hh));
      g.fillStyle = rgb(r === drop ? mix(WATER, WHITE, .3) : WATER); g.fillRect(x - ww, top + r, ww * 2, 1);
    }
    g.fillStyle = '#9fd4e8'; if (drop + 2 < 2 * hh) g.fillRect(x - 2, top + hh + (drop >> 1), 3, 1);
  })));
  const cache = {
    ground,
    heat: Array.from({ length: HEAT_BINS }, (_, b) => both((g, x, y, d) => block(g, x, y, heatColor(b / (HEAT_BINS - 1) * 1.5), d))),
    canal,
    pond: both((g, x, y, d) => { // round pool with a fish cage: not a diamond channel
      block(g, x, y, BANK, d); texture(g, x, y, BANK, 41);
      pool(g, x, y + HH, 12, rgb(mix(WET, BLACK, .45))); pool(g, x, y + HH + 1, 11, rgb(WATER));
      g.fillStyle = '#9fd4e8'; g.fillRect(x - 8, y + HH, 3, 1);
      g.fillStyle = '#d8c69a'; g.fillRect(x - 4, y + HH - 2, 9, 1); g.fillRect(x - 4, y + HH + 2, 9, 1); g.fillRect(x - 4, y + HH - 2, 1, 5); g.fillRect(x + 4, y + HH - 2, 1, 5);
      g.fillStyle = '#e8a040'; g.fillRect(x - 1, y + HH, 2, 1); g.fillRect(x + 6, y + HH + 3, 2, 1); // fish
    }),
    // Overlays for a block or a backfill. drawWorld draws them on top of the tile sprite.
    [BLOCK.TEMP]: sprite((g, x, y) => { // sandbags in two rows
      for (const [r, n, x0] of [[HH + 1, 4, -10], [HH - 1, 3, -7]]) for (let k = 0; k < n; k++) {
        const bx = x + x0 + k * 5;
        g.fillStyle = '#8f7a4f'; g.fillRect(bx, y + r + 1, 4, 1); g.fillStyle = '#c9b07a'; g.fillRect(bx, y + r - 1, 4, 2);
        g.fillStyle = '#e0cc98'; g.fillRect(bx + 1, y + r - 1, 2, 1);
      }
    }),
    [BLOCK.PERM]: sprite((g, x, y) => { // plank wall with posts, taller than the sandbags
      for (let r = 0; r < 6; r++) { g.fillStyle = r % 2 ? '#7a5432' : '#8c6239'; g.fillRect(x - 10, y + HH - 4 + r, 20, 1); }
      g.fillStyle = '#b5874f'; g.fillRect(x - 10, y + HH - 4, 20, 1);
      for (const px of [-11, -4, 3, 10]) { g.fillStyle = '#3e3328'; g.fillRect(x + px, y + HH - 7, 2, 11); g.fillStyle = '#6a5a48'; g.fillRect(x + px, y + HH - 7, 2, 1); }
    }),
    [BLOCK.FILLED]: sprite((g, x, y) => { // backfilled canal (sim sets kind PEAT): low peat mound with fill seams
      pool(g, x, y + HH + 1, 11, '#6a4e30'); pool(g, x, y + HH, 10, '#8a6a44');
      g.fillStyle = '#6a4e30'; g.fillRect(x - 7, y + HH - 1, 14, 1); g.fillRect(x - 4, y + HH + 2, 8, 1);
    }),
    river: both((g, x, y, d) => {
      block(g, x, y + 4, [40, 84, 110], d - 4);
      g.fillStyle = '#7fb8d0'; g.fillRect(x - 8, y + 8, 4, 1); g.fillRect(x + 4, y + 10, 6, 1); g.fillRect(x - 2, y + 14, 3, 1);
    }),
    village: both((g, x, y, d) => {
      block(g, x, y, [112, 92, 62], d); texture(g, x, y, [112, 92, 62], 42);
      for (const [hx, hy] of [[-10, 7], [2, 10]]) { // two stilt houses: stilts, wall, roof, door
        g.fillStyle = '#3a2a1e'; g.fillRect(hx + x + 1, y + hy, 1, 2); g.fillRect(hx + x + 8, y + hy, 1, 2);
        g.fillStyle = '#d8c69a'; g.fillRect(x + hx, y + hy - 6, 10, 6);
        g.fillStyle = '#9a4a2a'; g.fillRect(x + hx - 2, y + hy - 10, 14, 4); g.fillRect(x + hx, y + hy - 12, 10, 2);
        g.fillStyle = '#7a3a20'; g.fillRect(x + hx - 2, y + hy - 7, 14, 1);
        g.fillStyle = '#3a2a1e'; g.fillRect(x + hx + 4, y + hy - 4, 2, 4);
      }
    }),
    farm: both((g, x, y, d) => {
      block(g, x, y, [128, 100, 60], d);
      g.fillStyle = '#7fa842'; for (let r = 1; r < TH; r += 2) { const w = rowW(r); if (w > 4) g.fillRect(x - w + 4, y + r, w * 2 - 8, 1); }
    }),
    veg: {
      [VEG.FERN]: [sprite((g, x, y) => { fern(g, x - 5, y + 8, 4); fern(g, x + 5, y + 11, 3); }), sprite((g, x, y) => { fern(g, x + 1, y + 10, 5); fern(g, x - 7, y + 9, 3); })],
      [VEG.SEEDLING]: [sprite((g, x, y) => { seedling(g, x - 5, y + 8, 4); seedling(g, x + 3, y + 7, 3); seedling(g, x, y + 12, 4); }),
        sprite((g, x, y) => { seedling(g, x - 3, y + 10, 4); seedling(g, x + 5, y + 9, 5); })],
      [VEG.SHRUB]: [sprite((g, x, y) => { shrub(g, x - 4, y + 8, 5); shrub(g, x + 5, y + 11, 4); }), sprite((g, x, y) => { shrub(g, x + 1, y + 10, 6); shrub(g, x - 8, y + 9, 3); })],
      [VEG.TREE]: [sprite((g, x, y) => { tree(g, x - 5, y + 9, 7, 5); tree(g, x + 5, y + 11, 9, 6); }), sprite((g, x, y) => { tree(g, x + 1, y + 9, 11, 6); tree(g, x - 7, y + 12, 6, 4); })],
    },
  };
  return cache;
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
let flow = null, flowS = null;
export function drawWorld(ctx, game, view, mode = 'normal', hover = null, now = 0) {
  cache ??= buildCache();
  const wd = game.world, { w, h, z, wt, cover, kind, block: blk, fire, cWidth, cDepth, cWater } = wd, data = mode === 'data';
  const bw = view.bw ?? ctx.canvas.width, bh = view.bh ?? ctx.canvas.height;
  if (game.S !== flowS || flow?.length !== w * h) { flow = downstream(w, h, z, kind); flowS = game.S; }
  const jobs = new Set(game.jobs.map(j => j.i));
  const pos = new Int16Array(w * h * 2), shown = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { // row-major is back-to-front for this iso layout
    const i = y * w + x, [sx, sy] = tileToScreen(x, y, zMicro(w, h, z, x, y), view), e = x === w - 1 || y === h - 1 ? 1 : 0;
    pos[2 * i] = sx; pos[2 * i + 1] = sy;
    if (sx + HW < 0 || sx - HW > bw || sy - HEAD + SH < 0 || sy - HEAD > bh) continue;
    shown[i] = 1;
    const k = kind[i];
    let spr;
    if (data) spr = cache.heat[Math.round(Math.max(0, Math.min(1, wt[i] / 1.5)) * (HEAT_BINS - 1))];
    else if (k === KIND.CANAL) spr = game.ponds.has(i) ? cache.pond : cache.canal[canalStep(cWater[i], cDepth[i])][widthStep(cWidth[i])];
    else if (k === KIND.RIVER) spr = cache.river;
    else if (k === KIND.VILLAGE) spr = cache.village;
    else if (k === KIND.FARM) spr = cache.farm;
    else spr = cache.ground[wt[i] < 0 ? 0 : wt[i] <= WET_WT ? 1 : 2][Math.round(Math.max(0, Math.min(1, cover[i])) * (COVER_BINS - 1))];
    const ax = sx - SW / 2, ay = sy - HEAD;
    ctx.drawImage(spr[e], ax, ay);
    if (data) continue;
    if (cache[blk[i]]) ctx.drawImage(cache[blk[i]], ax, ay); // block or backfill overlay
    if (k === KIND.PEAT && !fire[i]) {
      const veg = game.seedlings.has(i) ? VEG.SEEDLING : vegOf(cover[i]);
      if (veg !== VEG.NONE) ctx.drawImage(cache.veg[veg][hash(i) > .5 ? 1 : 0], ax, ay);
    }
    if (game.wells.has(i)) { ctx.fillStyle = '#2a2420'; ctx.fillRect(sx - 4, sy + 6, 8, 6); ctx.fillStyle = '#5ab4e0'; ctx.fillRect(sx - 2, sy + 8, 4, 2); }
    if (game.paluds.has(i)) { ctx.fillStyle = '#c8e070'; for (let r = 4; r < 14; r += 4) ctx.fillRect(sx - 8 + r % 8, sy + r, 2, 2), ctx.fillRect(sx + 4 - r % 8, sy + r, 2, 2); }
    if (game.fireGroups.has(i)) { ctx.fillStyle = '#d23a2a'; ctx.fillRect(sx + 12, sy - 8, 2, 12); ctx.fillRect(sx + 14, sy - 8, 6, 4); }
    if (fire[i] === 1) { // surface fire: flickering flame pixels
      for (let f = 0; f < 3; f++) {
        const fl = ((now / 90 + i + f * 2) | 0) % 3, fx = sx - 8 + f * 8;
        ctx.fillStyle = '#f08a2c'; ctx.fillRect(fx, sy + 2 - 2 * fl, 4, 8 + 2 * fl);
        ctx.fillStyle = '#ffd25a'; ctx.fillRect(fx + 1, sy + 6 - 2 * fl, 2, 4);
      }
    } else if (fire[i] === 2) { // smouldering peat: ember + rising smoke wisps
      ctx.fillStyle = (now / 120 + i) % 3 < 1.5 ? '#f08a2c' : '#ffd25a'; ctx.fillRect(sx - 2, sy + 8, 4, 2);
      for (let s = 0; s < 2; s++) {
        const t = ((now / 900 + hash(i) + s / 2) % 1);
        ctx.fillStyle = `rgba(170,160,150,${(1 - t) * 0.6})`; ctx.fillRect(sx - 2 + Math.round(t * 8) - s * 4, sy + 4 - Math.round(t * 24), 3, 3);
      }
    }
    if (jobs.has(i)) { ctx.fillStyle = '#efe6cf'; ctx.fillRect(sx - 1, sy - 10, 2, 16); ctx.fillStyle = '#e8b04a'; ctx.fillRect(sx + 1, sy - 10, 8, 4); } // work flag
  }
  if (!data) { // flow markers: 2 light pixels move from the tile centre to the downstream tile centre
    ctx.fillStyle = '#d8f0fa';
    for (let i = 0; i < w * h; i++) {
      const n = flow[i];
      if (n < 0 || !shown[i] || kind[i] !== KIND.CANAL || blk[i] !== BLOCK.NONE || blk[n] !== BLOCK.NONE) continue;
      const cx = pos[2 * i], cy = pos[2 * i + 1] + HH + (dropPx(canalStep(cWater[i], cDepth[i]), widthStep(cWidth[i])) >> 1);
      for (let m = 0; m < 2; m++) {
        const t = (now / 600 + hash(i) + m / 2) % 1;
        ctx.fillRect(cx + Math.round((pos[2 * n] - pos[2 * i]) * t), cy + Math.round((pos[2 * n + 1] - pos[2 * i + 1]) * t), 1, 1);
      }
    }
  }
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
}
