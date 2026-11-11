// Map effects: particles, floating numbers, the action cursor, weather, fireflies and screen shake.
// Display only. It reads game state and never writes it. All effects use 1 px fillRect pixels, like the sprites.
import { KIND, WET_WT, BLOCK } from '../sim/world.js';
import { ACTIONS, costOf, freeCrews, plantTiles, isWetSeason } from '../sim/game.js';
import { TW, TH } from './isoMath.js';
import { FX } from '../strings.js';

const HW = TW / 2, HH = TH / 2;
const REDUCED = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const hash = i => { const x = Math.sin(i * 91.7 + 17.3) * 43758.5453; return x - Math.floor(x); };
export const GROUP_COL = { rewet: '#5ff0ff', reveg: '#8fe08a', revit: '#f58fc0', defense: '#ff9d6e' };
const BAD = '#e0503a', FUNDS = '#f2d16b', INK = '#efe6cf', DARK = '#0e0d0b';

// ---- 3x5 pixel digits for the floating numbers. Each glyph is 5 rows of 3 bits.
const GLYPH = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  '+': '000010111010000', '-': '000000111000000', '.': '000000000000010',
  ' ': '000000000000000', A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101',
  L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011',
  R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101',
  X: '101101010101101', Y: '101101010010010', Z: '111001010100111' };
export const textWidth = s => s.length * 4 - 1;
export function pixelText(ctx, s, x, y, col) {
  for (const [c, dx] of [[DARK, 1], [col, 0]]) { // a 1 px dark shadow under the text, so it reads on any ground
    ctx.fillStyle = c;
    [...s].forEach((ch, k) => { const g = GLYPH[ch]; if (g) for (let b = 0; b < 15; b++) if (g[b] === '1') ctx.fillRect(x + k * 4 + b % 3 + dx, y + (b / 3 | 0) + dx, 1, 1); });
  }
}

// ---- state. Positions are offsets from the top vertex of tile 0, so a pan or a zoom moves the effects with the map.
const MAX_P = 400;
let parts = [], floats = [], rings = [], marks = [], events = [], armed = null, banner = null, prevWet = null;
let seen = null, prevTick = -1, everWet = null, prevFire = null, prevJobs = new Map(), shakeUntil = 0, shakeAmp = 0, rain = 0;
export function resetFx() { parts = []; floats = []; rings = []; marks = []; events = []; seen = null; prevTick = -1; prevJobs = new Map(); rain = 0; shakeUntil = 0; shakeAmp = 0; flock = null; banner = null; prevWet = null; }
export const setArmed = id => { armed = id; };
export const takeFxEvents = () => events.splice(0);
export const rainLevel = () => rain;

const tileAt = (pos, i) => [pos[2 * i] - pos[0], pos[2 * i + 1] - pos[1] + HH]; // tile centre, relative to the map origin
function spawn(x, y, vx, vy, col, life, now, g = 40, size = 1) {
  if (REDUCED) return;
  if (parts.length >= MAX_P) parts.shift();
  parts.push({ x, y, vx, vy, col, life, born: now, g, size });
}
function burst(x, y, col, n, now, speed = 40) {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + Math.random() * .5, s = speed * (.5 + Math.random() * .7);
    spawn(x, y, Math.cos(a) * s, Math.sin(a) * s * .5 - speed * .6, col, 500 + Math.random() * 400, now, 90, Math.random() < .3 ? 2 : 1);
  }
}

// Called by the UI after a good action. cost: the funds it took.
let lastPos = null;
export function placed(i, id, cost, now = performance.now()) {
  if (!lastPos) return;
  const [x, y] = tileAt(lastPos, i), col = GROUP_COL[ACTIONS[id]?.r] ?? INK;
  rings.push({ x, y, col, born: now, life: 420 });
  burst(x, y - 2, col, 10, now);
  if (cost > 0) floats.push({ x, y: y - 10, text: `-${Math.round(cost)}`, col: FUNDS, born: now, life: 1300 });
}
// A passed level: leaves and petals burst up all over the map, more for more stars.
const PARTY = ['#8fe08a', '#b6f08a', '#f2d16b', '#f58fc0', '#5ff0ff'];
export function celebrate(stars, w, h, now = performance.now()) {
  if (!lastPos || !stars) return;
  for (let k = 0; k < 14 * stars; k++) {
    const i = (Math.random() * w * h) | 0, [x, y] = tileAt(lastPos, i), at = now + Math.random() * 900;
    rings.push({ x, y, col: PARTY[k % 5], born: at, life: 500, small: true });
    for (let d = 0; d < 5; d++) spawn(x, y - 2, (Math.random() - .5) * 50, -40 - Math.random() * 40, PARTY[(k + d) % 5], 1100 + Math.random() * 600, at, 70, d ? 1 : 2);
  }
}
// Called by the UI when an action is refused: a red cross on the tile and a small shake.
export function denied(i, now = performance.now()) {
  if (!lastPos || i == null) return;
  const [x, y] = tileAt(lastPos, i);
  marks.push({ x, y, born: now, life: 450 });
  shake(1, 160, now);
}
export function shake(amp, ms, now = performance.now()) { if (REDUCED) return; shakeAmp = Math.max(shakeAmp * (now < shakeUntil), amp); shakeUntil = Math.max(shakeUntil, now + ms); }
export const shakeOffset = now => now < shakeUntil ? [Math.round((Math.random() * 2 - 1) * shakeAmp), Math.round((Math.random() * 2 - 1) * shakeAmp)] : [0, 0];

// Once per tick: find tiles that turned wet, fires that went out and jobs that finished.
function diffTick(game, pos, now) {
  const wd = game.world, { n, wt, kind, fire } = wd, tick = game.tick ?? 0;
  if (seen !== game || !everWet || everWet.length !== n || tick < prevTick) {
    seen = game; prevTick = tick; prevWet = null; everWet = new Uint8Array(n); prevFire = Uint8Array.from(fire);
    for (let i = 0; i < n; i++) everWet[i] = wt[i] <= WET_WT;
    prevJobs = new Map(game.jobs.map(j => [`${j.i}:${j.id}`, j]));
    return;
  }
  if (tick === prevTick) return;
  prevTick = tick;
  const wetNow = !!game.level && isWetSeason(game);
  if (prevWet && !wetNow) { banner = { text: FX.dry, col: '#f0a040', born: now }; events.push({ type: 'season' }); } // dry season only: the wet season starts on the new-year tick, under the year report
  prevWet = wetNow;
  if (tick % 208 === 0) everWet.fill(0); // a new year: the first rewet of each tile shows again
  const fresh = [];
  for (let i = 0; i < n; i++) if (kind[i] === KIND.PEAT && !everWet[i] && wt[i] <= WET_WT) { everWet[i] = 1; fresh.push(i); }
  for (let k = 0; k < Math.min(5, fresh.length); k++) { // at most 5 a tick, so a whole season turning wet stays gentle
    const i = fresh[(Math.random() * fresh.length) | 0], [x, y] = tileAt(pos, i);
    rings.push({ x, y, col: '#5ff0ff', born: now + k * 70, life: 600, small: true });
    for (let d = 0; d < 3; d++) spawn(x - 2 + d * 2, y, (d - 1) * 6, -18 - d * 4, d === 1 ? '#bff8ff' : '#5ff0ff', 700, now + k * 70, 20);
  }
  if (fresh.length) events.push({ type: 'wet', n: fresh.length });
  for (let i = 0; i < n; i++) {
    if (prevFire[i] && !fire[i]) { // a fire went out: steam
      const [x, y] = tileAt(pos, i);
      for (let d = 0; d < 6; d++) spawn(x + (Math.random() - .5) * 14, y - 2, (Math.random() - .5) * 8, -10 - Math.random() * 10, d & 1 ? '#d8d4cc' : '#a9a49a', 1200, now, -4, 2);
      events.push({ type: 'fireOut' });
    }
    prevFire[i] = fire[i];
  }
  const cur = new Map(game.jobs.map(j => [`${j.i}:${j.id}`, j]));
  for (const [key, j] of prevJobs) if (!cur.has(key) && tick >= j.doneAt) {
    const [x, y] = tileAt(pos, j.i), col = GROUP_COL[ACTIONS[j.id]?.r] ?? INK;
    rings.push({ x, y, col, born: now, life: 500 }, { x, y, col: INK, born: now + 120, life: 420, small: true });
    burst(x, y - 4, col, 16, now, 55);
    (j.tiles ?? []).slice(0, 12).forEach((t, k) => { const [px, py] = tileAt(pos, t); spawn(px, py - 2, 0, -22, '#b6f08a', 600, now + k * 40, 30); }); // planted tiles each get a green pop
    events.push({ type: 'done', id: j.id });
    if (j.id === 'tempBlock' || j.id === 'permBlock') { // a cascade: other blocks on canal tiles near this one. It teaches that a chain of blocks rewets more
      const c = cascade(game.world, j.i);
      if (c > 1) { floats.push({ x, y: y - 16, text: `${FX.cascade} X${c}`, col: '#5ff0ff', born: now + 150, life: 1800 }); events.push({ type: 'cascade', n: c }); shake(1, 120, now); }
    }
  }
  prevJobs = cur;
}

// The blocked canal tiles within 6 tiles of tile i, i included. 6 tiles: the reach of one block upstream (CLAUDE.md).
export function cascade(wd, i) {
  const { w, h, kind, block } = wd, x0 = i % w, y0 = (i / w) | 0;
  let n = 0;
  for (let y = Math.max(0, y0 - 6); y <= Math.min(h - 1, y0 + 6); y++) for (let x = Math.max(0, x0 - 6); x <= Math.min(w - 1, x0 + 6); x++) {
    const k = y * w + x;
    if (kind[k] === KIND.CANAL && (block[k] === BLOCK.TEMP || block[k] === BLOCK.PERM)) n++;
  }
  return n;
}
// A diamond outline around a tile centre, s times the tile size. Only the outer 1 px.
function diamond(ctx, x, y, s) {
  const hh = Math.max(1, Math.round(HH * s)), hw = HW * s;
  for (let r = -hh; r <= hh; r++) { const w = Math.round(hw * (1 - Math.abs(r) / hh)); ctx.fillRect(x - w, y + r, 1, 1); ctx.fillRect(x + w, y + r, 1, 1); }
}
const stepAlpha = t => Math.ceil((1 - t) * 4) / 4; // 4 alpha steps, not a smooth fade

// ---- weather and life, in screen space (rain, cloud shadows) and on tiles (fireflies, embers)
// ---- clouds: generated cumulus shapes, high in the sky. The lowest cloud floats just above the north corner of the map, so no cloud covers a tile.
// The shadow of each cloud is the same shape, solid and squashed, on the ground straight below it.
const CLOUD_N = 6, SKY = 6; // SKY: px between the north corner and the base of the lowest cloud (tree tops on the corner tile)
const CLOUD_FAIR = ['#ffffff', '#f1f4f4', '#d9e0e3', '#b7c2c9', '#8f9ba4'], CLOUD_RAIN = ['#d0d5d8', '#b0b8bc', '#949da2', '#788188', '#5d656b']; // light to dark
const SUN = (() => { const v = [-.45, -.75, .5], l = Math.hypot(...v); return v.map(c => c / l); })(); // light from the upper left, towards the viewer
let clouds = null;
function cloudShape(seed) { // 22 to 31 round puffs inside a dome on a flat base; each pixel takes the shading of the puff in front, like a cauliflower
  const r = k => hash(seed * 7.13 + k * 1.31), W = 130 + r(0) * 90 | 0, cx = W / 2, hw = W / 2 - 12, domeH = 16 + r(1) * 14 | 0, H = domeH + 36, base = H - 3, P = [];
  const m = 22 + (r(2) * 10 | 0);
  for (let j = 0; j < m; j++) {
    const t = r(10 + j) * 2 - 1, env = Math.sqrt(1 - t * t), rad = 6 + r(30 + j) * 8 + env * 10;
    P.push({ x: cx + t * hw * .9, y: base - rad * .6 - env * domeH * (.3 + .7 * r(50 + j)), r: rad });
  }
  const front = (px, py) => { // the visible puff at a pixel: the one whose sphere surface is nearest the viewer
    if (py > base) return null; let best = null, bz = 0;
    for (const p of P) { const dx = px - p.x, dy = py - p.y, z2 = p.r * p.r - dx * dx - dy * dy; if (z2 > 0 && z2 > bz) { bz = z2; best = [dx / p.r, dy / p.r, Math.sqrt(z2) / p.r]; } }
    return best;
  };
  const paint = cols => {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const n = front(px, py); if (!n) continue;
      const v = (n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]) * .5 + .5 - Math.max(0, py - (base - 7)) / 7 * .3; // a darker flat underside
      const k = Math.max(0, Math.min(4, Math.floor((1 - v) * 5 + (BAYER[(py % 4) * 4 + px % 4] / 16 - .5) * .9))); // ordered dither between tones: texture
      g.fillStyle = cols[k]; g.fillRect(px, py, 1, 1);
    }
    return c;
  };
  const sh = document.createElement('canvas'); sh.width = W; sh.height = Math.ceil(H / 2); const g = sh.getContext('2d'); g.fillStyle = '#000';
  for (let py = 0; py < sh.height; py++) for (let px = 0; px < W; px++) if (front(px, py * 2) || front(px, py * 2 + 1)) g.fillRect(px, py, 1, 1);
  return { W, H, fair: paint(CLOUD_FAIR), rain: paint(CLOUD_RAIN), shadow: sh };
}
// Cloud k at time now, in map coordinates (offsets from tile 0): it drifts east and wraps around the map box.
function cloudAt(k, game, now) {
  const { w, h } = game.world, x0 = -h * HW - 80, span = (w + h) * HW + 160, c = clouds[k % CLOUD_N];
  const x = x0 + ((hash(k + 3.3) * span + now / 1000 * (2 + hash(k + 4.4) * 3)) % span), y = (.1 + .8 * hash(k + 5.5)) * (w + h) * HH;
  return [Math.round(x - c.W / 2), Math.round(y), c];
}
function weather(ctx, game, pos, bw, bh, now) {
  const want = game.level && isWetSeason(game) && hash(((game.tick ?? 0) / 6 | 0) + game.world.seed) < .55 ? 1 : 0; // showers come and go every 1.5 weeks
  rain += (want - rain) * .02;
  if (REDUCED) return;
  clouds ??= Array.from({ length: CLOUD_N }, (_, k) => cloudShape(k + 1));
  const { w, h } = game.world, c = (i, dx, dy) => [pos[2 * i] + dx, pos[2 * i + 1] + dy], ox = pos[0], oy = pos[1];
  const count = Math.round(3 + (w + h) / 30 + rain * 3);
  ctx.save(); ctx.beginPath(); // rain and cloud shadows fall on the map only, not on the backdrop
  for (const [x, y] of [c(0, 0, 0), c(w - 1, HW, HH), c(w * h - 1, 0, TH), c((h - 1) * w, -HW, HH)]) ctx.lineTo(x, y);
  ctx.clip();
  ctx.globalAlpha = .28 + rain * .08;
  for (let k = 0; k < count; k++) { const [x, y, cl] = cloudAt(k, game, now); ctx.drawImage(cl.shadow, ox + x, oy + y); }
  if (rain > .05) {
    const n = Math.round(bw * bh / 700 * rain);
    ctx.globalAlpha = .45; ctx.fillStyle = '#b8d4ec';
    for (let k = 0; k < n; k++) {
      const x0 = hash(k + .1) * (bw + 40), y0 = hash(k + .2) * bh - 50, L = 30 + hash(k + .3) * 70, v = 110 + hash(k + .4) * 50;
      const p = (now / 1000 * v + hash(k + .5) * 999) % (L + 10), x = Math.round(x0 - p * .3), y = Math.round(y0 + p);
      if (p < L) { ctx.fillRect(x, y, 1, 3); ctx.fillRect(x - 1, y + 3, 1, 1); }
      else { const s = Math.round(x0 - L * .3); ctx.fillRect(s - 2, Math.round(y0 + L) + 3, 1, 1); ctx.fillRect(s + 1, Math.round(y0 + L) + 3, 1, 1); } // splash
    }
  }
  ctx.restore();
  for (let k = 0; k < count; k++) { // the clouds themselves, in the sky above the north corner, straight above their shadows
    const [x, , cl] = cloudAt(k, game, now), cx = ox + x, cy = oy - SKY - cl.H - Math.round(hash(k + 6.6) * 10);
    if (cx > bw || cy > bh || cx + cl.W < 0 || cy + cl.H < 0) continue;
    ctx.globalAlpha = .6 * (1 - rain); ctx.drawImage(cl.fair, cx, cy); // see-through: the sky shows behind
    ctx.globalAlpha = .6 * rain; ctx.drawImage(cl.rain, cx, cy);
  }
  ctx.globalAlpha = 1;
}
let flock = null, nextFlock = 0;
function life(ctx, game, pos, shown, now) {
  const wd = game.world, { n, kind, cover, wt, fire } = wd;
  let peat = 0, wet = 0;
  for (let i = 0; i < n; i++) {
    if (kind[i] === KIND.PEAT) { peat++; if (wt[i] <= WET_WT) wet++; }
    if (!shown[i]) continue;
    if (kind[i] === KIND.VILLAGE && Math.random() < .004) spawn(pos[2 * i] - pos[0] + 4, pos[2 * i + 1] - pos[1] - 4, 2, -6, '#8a8478', 2200, now, -1, 2); // chimney smoke
    const ox = pos[2 * i], oy = pos[2 * i + 1], h = hash(i + .9);
    if (fire[i] === 1 && Math.random() < .08) spawn(ox - pos[0] + (Math.random() - .5) * 12, oy - pos[1] + HH - 8, (Math.random() - .5) * 10, -20 - Math.random() * 14, Math.random() < .5 ? '#ffd25a' : '#f08a2c', 900, now, -6);
    if (kind[i] === KIND.PEAT && wt[i] <= WET_WT && !fire[i] && !REDUCED && h > .7 && Math.sin(now / 900 + h * 60) > .985) { // wet peat glints now and then
      ctx.fillStyle = '#e8fbff'; const gx = ox + ((h * 97) % 16 | 0) - 8, gy = oy + HH + ((h * 53) % 6 | 0) - 3; ctx.fillRect(gx, gy, 1, 1); ctx.fillRect(gx - 1, gy, 3, 1); ctx.fillRect(gx, gy - 1, 1, 3);
    }
    if (kind[i] !== KIND.PEAT || h > .14 || cover[i] < .5 || wt[i] > WET_WT || fire[i]) continue;
    const ph = REDUCED ? 1 : Math.sin(now / (500 + h * 900) + h * 40); // fireflies: a slow blink and a small wander
    if (ph < .55) continue;
    const x = Math.round(ox + Math.sin(now / 1700 + h * 9) * 7), y = Math.round(oy + 2 + Math.cos(now / 1300 + h * 7) * 4);
    ctx.globalAlpha = .3; ctx.fillStyle = '#d8ff70'; ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.globalAlpha = 1; ctx.fillStyle = '#f4ffc0'; ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
  if (REDUCED) return;
  if (!flock && now > nextFlock && peat && wet / peat > .5) { // birds come back to wet peat: a small flock crosses the map now and then
    const { w, h } = wd, dir = Math.random() < .5 ? 1 : -1; // the flock crosses the middle band of the map
    flock = { born: now, dir, y: pos[2 * ((h >> 1) * w) + 1] - pos[1] - 30 + Math.random() * 50, n: 3 + (Math.random() * 3 | 0), span: (w + h) * HW + 120 };
    nextFlock = now + 15000 + Math.random() * 20000;
  }
  if (flock) {
    const t = (now - flock.born) / 1000, x0 = flock.dir > 0 ? -flock.span / 2 + t * 28 : flock.span / 2 - t * 28;
    if (Math.abs(x0) > flock.span / 2 + 1) { flock = null; return; }
    ctx.fillStyle = '#f2efe4'; // white egrets, which read on dark forest
    for (let k = 0; k < flock.n; k++) {
      const bx = Math.round(pos[0] + x0 - flock.dir * k * 9), by = Math.round(pos[1] + flock.y + (k & 1 ? 5 : 0) * Math.ceil(k / 2) + Math.sin(t * 2 + k) * 2), up = ((now / 160 + k) | 0) % 2;
      ctx.fillRect(bx, by, 1, 1); ctx.fillRect(bx - 2, by - up, 2, 1); ctx.fillRect(bx + 1, by - up, 2, 1); // a body and two wings that flap
    }
  }
}

// The cursor on the hovered tile: a bobbing arrow and an outline, in the action colour when the action can go there, red when not.
function cursor(ctx, game, pos, hover, now) {
  const sx = pos[2 * hover], sy = pos[2 * hover + 1] + HH, bob = REDUCED ? 0 : (now / 260 | 0) % 2;
  let col = '#ffffff';
  if (armed) {
    const a = ACTIONS[armed], v = a.valid(game.world, hover, game);
    const ok = v === true && costOf(game, armed) <= game.funds && freeCrews(game) > 0 && !game.jobs.some(j => j.i === hover && armed !== 'fireCrew');
    col = ok ? GROUP_COL[a.r] : BAD;
    if (armed === 'plant' && v === true) { ctx.globalAlpha = .55; ctx.fillStyle = GROUP_COL.reveg; for (const t of plantTiles(game, hover)) if (t !== hover) diamond(ctx, pos[2 * t], pos[2 * t + 1] + HH, .5); ctx.globalAlpha = 1; }
  }
  ctx.fillStyle = col; diamond(ctx, sx, sy, 1);
  ctx.fillStyle = DARK; diamond(ctx, sx, sy + 1, 1); ctx.fillStyle = col; diamond(ctx, sx, sy, 1); // a dark under-line, so the outline reads on bright ground
  const ay = sy - HH - 16 - bob; // a 5 px wide down arrow above the tile
  ctx.fillStyle = DARK; ctx.fillRect(sx - 3, ay - 1, 7, 2); ctx.fillRect(sx - 2, ay + 1, 5, 2); ctx.fillRect(sx - 1, ay + 3, 3, 2);
  ctx.fillStyle = col; ctx.fillRect(sx - 2, ay, 5, 1); ctx.fillRect(sx - 1, ay + 1, 3, 1); ctx.fillRect(sx, ay + 2, 1, 1);
}

// Draws all effects. Called at the end of drawWorld. pos: screen point of each tile top; shown: 1 for tiles on screen.
export function drawFx(ctx, game, pos, shown, hover, data, bw, bh, now, live) {
  lastPos = pos;
  if (live) diffTick(game, pos, now);
  if (!data) { life(ctx, game, pos, shown, now); weather(ctx, game, pos, bw, bh, now); }
  const ox = pos[0], oy = pos[1];
  rings = rings.filter(r => now - r.born < r.life);
  for (const r of rings) {
    const t = (now - r.born) / r.life; if (t < 0) continue;
    ctx.globalAlpha = stepAlpha(t); ctx.fillStyle = r.col; diamond(ctx, ox + r.x, oy + r.y, (r.small ? .4 : .7) + t * (r.small ? .7 : 1.1));
  }
  parts = parts.filter(p => now - p.born < p.life);
  for (const p of parts) {
    const t = (now - p.born) / p.life, s = (now - p.born) / 1000; if (t < 0) continue;
    ctx.globalAlpha = stepAlpha(t); ctx.fillStyle = p.col;
    ctx.fillRect(Math.round(ox + p.x + p.vx * s), Math.round(oy + p.y + p.vy * s + p.g * s * s / 2), p.size, p.size);
  }
  marks = marks.filter(m => now - m.born < m.life);
  for (const m of marks) {
    const t = (now - m.born) / m.life; ctx.globalAlpha = stepAlpha(t); ctx.fillStyle = BAD;
    for (let d = -3; d <= 3; d++) { ctx.fillRect(ox + m.x + d, oy + m.y + d, 1, 1); ctx.fillRect(ox + m.x + d, oy + m.y - d, 1, 1); }
  }
  floats = floats.filter(f => now - f.born < f.life);
  for (const f of floats) {
    const t = (now - f.born) / f.life, rise = REDUCED ? 0 : Math.round(Math.min(1, t * 2.5) * 10 + t * 4);
    ctx.globalAlpha = t < .7 ? 1 : stepAlpha((t - .7) / .3);
    pixelText(ctx, f.text, Math.round(ox + f.x - textWidth(f.text) / 2), Math.round(oy + f.y - rise), f.col);
  }
  ctx.globalAlpha = 1;
  if (hover != null) cursor(ctx, game, pos, hover, now);
  if (banner) seasonBanner(ctx, bw, bh, now);
}

// ---- season banner: a band with big pixel words that slides across when the season turns.
const BANNER_MS = 2600;
function seasonBanner(ctx, bw, bh, now) {
  const t = (now - banner.born) / BANNER_MS; if (t >= 1) { banner = null; return; }
  const k = Math.min(6, Math.max(2, Math.round(bw / 160))), tw = textWidth(banner.text) * k, y = Math.round(bh * .3), pad = 2 * k + 1;
  const slide = REDUCED ? 0 : t < .12 ? (1 - t / .12) ** 2 : t > .88 ? -(((t - .88) / .12) ** 2) : 0; // ease in from the right, out to the left
  const x = Math.round((bw - tw) / 2 + slide * bw);
  ctx.globalAlpha = t < .88 ? .75 : .75 * (1 - (t - .88) / .12); ctx.fillStyle = '#0e0d0b'; ctx.fillRect(0, y - pad, bw, 5 * k + 2 * pad);
  ctx.globalAlpha = 1; ctx.fillStyle = banner.col; ctx.fillRect(0, y - pad, bw, 1); ctx.fillRect(0, y + 5 * k + pad - 1, bw, 1);
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); pixelText(ctx, banner.text, 0, 0, banner.col); ctx.restore();
}

// ---- the backdrop behind the map: dark bands with an ordered dither between them, built once for each buffer height.
const BANDS = ['#0b0d0c', '#0d1312', '#0f1916', '#11201b'];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
let bgPat = null, bgH = -1;
export function backdrop(ctx, bw, bh) {
  if (bh !== bgH || !bgPat) {
    const c = document.createElement('canvas'); c.width = 4; c.height = bh;
    const g = c.getContext('2d');
    for (let y = 0; y < bh; y++) for (let x = 0; x < 4; x++) {
      const f = y / Math.max(1, bh - 1) * (BANDS.length - 1), b = Math.floor(f), up = (f - b) * 16 > BAYER[(y % 4) * 4 + x];
      g.fillStyle = BANDS[Math.min(BANDS.length - 1, b + up)]; g.fillRect(x, y, 1, 1);
    }
    bgPat = ctx.createPattern(c, 'repeat-x'); bgH = bh;
  }
  ctx.fillStyle = bgPat; ctx.fillRect(0, 0, bw, bh);
}

// ---- edge arrows: a fire outside the view gets a pulsing arrow at the edge that points to it. box: the visible band in buffer px.
export function fireArrows(ctx, game, box, now) {
  const pos = lastPos, fire = game.world?.fire; if (!pos || !fire || !game.level) return;
  const m = 7, l = box.l + m, t = box.t + m, r = box.r - m, b = box.b - m, used = new Set();
  const on = REDUCED || (now / 300 | 0) % 2;
  for (let i = 0; i < fire.length; i++) if (fire[i]) {
    const x = pos[2 * i], y = pos[2 * i + 1] + HH;
    if (x >= box.l && x <= box.r && y >= box.t && y <= box.b) continue;
    const cx = Math.max(l, Math.min(r, x)), cy = Math.max(t, Math.min(b, y)), key = `${cx / 24 | 0},${cy / 24 | 0}`; // one arrow per 24 px of edge
    if (used.has(key)) continue; used.add(key);
    const d = Math.hypot(x - cx, y - cy) || 1, ux = (x - cx) / d, uy = (y - cy) / d;
    for (const [col, o] of [[DARK, 1], [on ? '#ff6a3a' : BAD, 0]]) { // a 1 px dark shadow, like the pixel text
      ctx.fillStyle = col;
      for (let py = -5; py <= 5; py++) for (let px = -5; px <= 5; px++) { // a triangle: tip 5 px ahead, base 3 px behind
        const a = px * ux + py * uy, s = -px * uy + py * ux;
        if (a <= 5 && a >= -3 && Math.abs(s) <= (5 - a) / 2) ctx.fillRect(cx + px + o, cy + py + o, 1, 1);
      }
    }
  }
}
