// Iso map renderer. Reads game state only; never writes it.
import { KIND, BLOCK, WET_WT } from '../sim/world.js';
import { TW, TH, tileToScreen } from './isoMath.js';

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const DRY = [124, 88, 54], WET = [64, 50, 38], GREEN = [92, 132, 54], FOREST = [54, 98, 46], WATER = [52, 108, 136];
const D = 5, EDGE = D + 6, HEAD = 14, SW = TW, SH = HEAD + TH + EDGE + 1; // sprite: anchor (8, HEAD) = tile top vertex

// ---- sprite cache: built once with fillRect into offscreen canvases (same block/blob style as the intro)
let cache = null;
function sprite(draw) {
  const c = document.createElement('canvas'); c.width = SW; c.height = SH;
  const g = c.getContext('2d'); draw(g, SW / 2, HEAD); return c;
}
function block(g, sx, sy, top, depth) {
  g.fillStyle = rgb(mix(top, [0, 0, 0], .35));
  for (let dx = 0; dx < 8; dx++) g.fillRect(sx - 8 + dx, sy + 4 + (dx >> 1), 1, depth);
  g.fillStyle = rgb(mix(top, [0, 0, 0], .55));
  for (let dx = 0; dx < 8; dx++) g.fillRect(sx + dx, sy + 8 - ((dx + 1) >> 1), 1, depth);
  g.fillStyle = rgb(top);
  for (let r = 0; r < TH; r++) { const w = r < 4 ? (r + 1) * 2 : (TH - r) * 2; g.fillRect(sx - w, sy + r, w * 2, 1); }
}
function blob(g, cx, cy, rad, col) {
  g.fillStyle = col;
  for (let dy = -rad; dy <= rad; dy++) { const w = Math.round(Math.sqrt(rad * rad - dy * dy)); g.fillRect(cx - w, cy + dy, w * 2 + 1, 1); }
}
function tree(g, sx, sy, tall, rad) {
  g.fillStyle = '#4a3324'; g.fillRect(sx, sy + 4 - tall, 1, tall);
  blob(g, sx, sy + 4 - tall - rad + 1, rad, '#2f6b33');
  blob(g, sx - 1, sy + 4 - tall - rad, Math.max(0, rad - 1), '#5c9a45');
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
    block(g, x, y, mix(base[s], b > 2 ? FOREST : GREEN, b / (COVER_BINS - 1) * 0.8), d);
    if (s === 0) { g.fillStyle = '#9fd4e8'; g.fillRect(x - 3, y + 3, 3, 1); g.fillRect(x + 2, y + 5, 2, 1); } // water sheen
  });
  const canal = (top, extra) => both((g, x, y, d) => { block(g, x, y + 2, top, d - 2); extra?.(g, x, y); });
  const cache = {
    ground,
    heat: Array.from({ length: HEAT_BINS }, (_, b) => both((g, x, y, d) => block(g, x, y, heatColor(b / (HEAT_BINS - 1) * 1.5), d))),
    canal: {
      [BLOCK.NONE]: canal(mix([46, 40, 32], WATER, .7), (g, x, y) => { g.fillStyle = '#9fd4e8'; g.fillRect(x - 2, y + 5, 3, 1); }),
      [BLOCK.TEMP]: canal(mix([46, 40, 32], WATER, .7), (g, x, y) => { // wooden plank dam
        g.fillStyle = '#8c6239'; g.fillRect(x - 6, y + 3, 12, 3); g.fillStyle = '#b5874f'; g.fillRect(x - 6, y + 3, 12, 1); }),
      [BLOCK.PERM]: canal(mix([46, 40, 32], WATER, .7), (g, x, y) => { // compacted peat + log dam, wider and higher
        g.fillStyle = '#5a4a3a'; g.fillRect(x - 7, y + 1, 14, 5); g.fillStyle = '#8a8070'; g.fillRect(x - 7, y + 1, 14, 1);
        g.fillStyle = '#3e3328'; for (let k = -6; k < 7; k += 3) g.fillRect(x + k, y + 3, 1, 3); }),
    },
    river: both((g, x, y, d) => { block(g, x, y + 2, [40, 84, 110], d - 2); g.fillStyle = '#7fb8d0'; g.fillRect(x - 4, y + 4, 2, 1); g.fillRect(x + 2, y + 5, 3, 1); }),
    village: both((g, x, y, d) => {
      block(g, x, y, [112, 92, 62], d);
      for (const [hx, hy] of [[-5, 3], [2, 4]]) { // two stilt houses: wall, roof, door
        g.fillStyle = '#d8c69a'; g.fillRect(x + hx, y + hy - 3, 5, 3);
        g.fillStyle = '#9a4a2a'; g.fillRect(x + hx - 1, y + hy - 5, 7, 2); g.fillRect(x + hx, y + hy - 6, 5, 1);
        g.fillStyle = '#3a2a1e'; g.fillRect(x + hx + 2, y + hy - 2, 1, 2);
      }
    }),
    farm: both((g, x, y, d) => {
      block(g, x, y, [128, 100, 60], d);
      g.fillStyle = '#7fa842'; for (let r = 1; r < TH; r += 2) { const w = r < 4 ? (r + 1) * 2 : (TH - r) * 2; g.fillRect(x - w + 2, y + r, w * 2 - 4, 1); }
    }),
    trees: [
      sprite((g, x, y) => { tree(g, x - 3, y + 1, 5, 2); tree(g, x + 3, y + 3, 4, 2); }),
      sprite((g, x, y) => { tree(g, x + 1, y + 2, 8, 3); tree(g, x - 4, y + 3, 5, 2); }),
      sprite((g, x, y) => { tree(g, x - 2, y + 2, 9, 4); tree(g, x + 4, y + 3, 6, 2); }),
    ],
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
    const w = r < 4 ? (r + 1) * 2 : (TH - r) * 2, top = r < 4;
    if (which.includes(top ? 'tl' : 'bl')) ctx.fillRect(sx - w, sy + r, 2, 1);
    if (which.includes(top ? 'tr' : 'br')) ctx.fillRect(sx + w - 2, sy + r, 2, 1);
  }
}

export function drawWorld(ctx, game, view, mode = 'normal', hover = null, now = 0) {
  cache ??= buildCache();
  const wd = game.world, { w, h, z, wt, cover, kind, block: blk, fire } = wd, data = mode === 'data';
  const jobs = new Set(game.jobs.map(j => j.i));
  const pos = new Int16Array(w * h * 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { // row-major is back-to-front for this iso layout
    const i = y * w + x, [sx, sy] = tileToScreen(x, y, zMicro(w, h, z, x, y), view), e = x === w - 1 || y === h - 1 ? 1 : 0;
    pos[2 * i] = sx; pos[2 * i + 1] = sy;
    const k = kind[i];
    let spr;
    if (data) spr = cache.heat[Math.round(Math.max(0, Math.min(1, wt[i] / 1.5)) * (HEAT_BINS - 1))];
    else if (k === KIND.CANAL) spr = cache.canal[blk[i]] ?? cache.canal[BLOCK.NONE];
    else if (k === KIND.RIVER) spr = cache.river;
    else if (k === KIND.VILLAGE) spr = cache.village;
    else if (k === KIND.FARM) spr = cache.farm;
    else spr = cache.ground[wt[i] < 0 ? 0 : wt[i] <= WET_WT ? 1 : 2][Math.round(Math.max(0, Math.min(1, cover[i])) * (COVER_BINS - 1))];
    ctx.drawImage(spr[e], sx - SW / 2, sy - HEAD);
    if (data) continue;
    if (k === KIND.PEAT && cover[i] >= 0.6 && !fire[i]) ctx.drawImage(cache.trees[(cover[i] >= 0.85 ? 1 : 0) + (hash(i) > 0.6 ? 1 : 0)], sx - SW / 2, sy - HEAD);
    else if (game.seedlings.has(i)) { ctx.fillStyle = '#a7c95e'; ctx.fillRect(sx - 3, sy + 3, 1, 2); ctx.fillRect(sx + 2, sy + 4, 1, 2); ctx.fillRect(sx, sy + 5, 1, 2); }
    if (blk[i] === BLOCK.FILLED) { ctx.fillStyle = '#8a6a44'; ctx.fillRect(sx - 6, sy + 3, 12, 1); ctx.fillRect(sx - 4, sy + 5, 8, 1); } // backfilled canal: fill seam (sim sets kind PEAT)
    if (game.wells.has(i)) { ctx.fillStyle = '#2a2420'; ctx.fillRect(sx - 2, sy + 3, 4, 3); ctx.fillStyle = '#5ab4e0'; ctx.fillRect(sx - 1, sy + 4, 2, 1); }
    if (game.paluds.has(i)) { ctx.fillStyle = '#c8e070'; for (let r = 2; r < 7; r += 2) ctx.fillRect(sx - 4 + r % 4, sy + r, 1, 1), ctx.fillRect(sx + 2 - r % 4, sy + r, 1, 1); }
    if (game.ponds.has(i)) { ctx.fillStyle = '#e8a040'; ctx.fillRect(sx + 1, sy + 4, 2, 1); } // fish
    if (game.fireGroups.has(i)) { ctx.fillStyle = '#d23a2a'; ctx.fillRect(sx + 6, sy - 4, 1, 6); ctx.fillRect(sx + 7, sy - 4, 3, 2); }
    if (fire[i] === 1) { // surface fire: flickering flame pixels
      for (let f = 0; f < 3; f++) {
        const fl = ((now / 90 + i + f * 2) | 0) % 3, fx = sx - 4 + f * 4;
        ctx.fillStyle = '#f08a2c'; ctx.fillRect(fx, sy + 1 - fl, 2, 4 + fl);
        ctx.fillStyle = '#ffd25a'; ctx.fillRect(fx, sy + 3 - fl, 1, 2);
      }
    } else if (fire[i] === 2) { // smouldering peat: ember + rising smoke wisps
      ctx.fillStyle = (now / 120 + i) % 3 < 1.5 ? '#f08a2c' : '#ffd25a'; ctx.fillRect(sx - 1, sy + 4, 2, 1);
      for (let s = 0; s < 2; s++) {
        const t = ((now / 900 + hash(i) + s / 2) % 1);
        ctx.fillStyle = `rgba(170,160,150,${(1 - t) * 0.6})`; ctx.fillRect(sx - 1 + Math.round(t * 4) - s * 2, sy + 2 - Math.round(t * 12), 2, 2);
      }
    }
    if (jobs.has(i)) { ctx.fillStyle = '#efe6cf'; ctx.fillRect(sx - 1, sy - 5, 1, 8); ctx.fillStyle = '#e8b04a'; ctx.fillRect(sx, sy - 5, 4, 2); } // work flag
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
