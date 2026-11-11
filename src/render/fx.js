// Map effects: particles, floating numbers, the action cursor, weather, fireflies and screen shake.
// Display only. It reads game state and never writes it. All effects use 1 px fillRect pixels, like the sprites.
import { KIND, WET_WT } from '../sim/world.js';
import { ACTIONS, costOf, freeCrews, plantTiles, isWetSeason } from '../sim/game.js';
import { TW, TH } from './isoMath.js';

const HW = TW / 2, HH = TH / 2;
const REDUCED = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const hash = i => { const x = Math.sin(i * 91.7 + 17.3) * 43758.5453; return x - Math.floor(x); };
export const GROUP_COL = { rewet: '#5ff0ff', reveg: '#8fe08a', revit: '#f58fc0', defense: '#ff9d6e' };
const BAD = '#e0503a', FUNDS = '#f2d16b', INK = '#efe6cf', DARK = '#0e0d0b';

// ---- 3x5 pixel digits for the floating numbers. Each glyph is 5 rows of 3 bits.
const GLYPH = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  '+': '000010111010000', '-': '000000111000000', '.': '000000000000010' };
export const textWidth = s => s.length * 4 - 1;
export function pixelText(ctx, s, x, y, col) {
  for (const [c, dx] of [[DARK, 1], [col, 0]]) { // a 1 px dark shadow under the text, so it reads on any ground
    ctx.fillStyle = c;
    [...s].forEach((ch, k) => { const g = GLYPH[ch]; if (g) for (let b = 0; b < 15; b++) if (g[b] === '1') ctx.fillRect(x + k * 4 + b % 3 + dx, y + (b / 3 | 0) + dx, 1, 1); });
  }
}

// ---- state. Positions are offsets from the top vertex of tile 0, so a pan or a zoom moves the effects with the map.
const MAX_P = 400;
let parts = [], floats = [], rings = [], marks = [], events = [], armed = null;
let seen = null, prevTick = -1, everWet = null, prevFire = null, prevJobs = new Map(), shakeUntil = 0, shakeAmp = 0, rain = 0;
export function resetFx() { parts = []; floats = []; rings = []; marks = []; events = []; seen = null; prevTick = -1; prevJobs = new Map(); rain = 0; }
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
    seen = game; prevTick = tick; everWet = new Uint8Array(n); prevFire = Uint8Array.from(fire);
    for (let i = 0; i < n; i++) everWet[i] = wt[i] <= WET_WT;
    prevJobs = new Map(game.jobs.map(j => [`${j.i}:${j.id}`, j]));
    return;
  }
  if (tick === prevTick) return;
  prevTick = tick;
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
  }
  prevJobs = cur;
}

// A diamond outline around a tile centre, s times the tile size. Only the outer 1 px.
function diamond(ctx, x, y, s) {
  const hh = Math.max(1, Math.round(HH * s)), hw = HW * s;
  for (let r = -hh; r <= hh; r++) { const w = Math.round(hw * (1 - Math.abs(r) / hh)); ctx.fillRect(x - w, y + r, 1, 1); ctx.fillRect(x + w, y + r, 1, 1); }
}
const stepAlpha = t => Math.ceil((1 - t) * 4) / 4; // 4 alpha steps, not a smooth fade

// ---- weather and life, in screen space (rain, cloud shadows) and on tiles (fireflies, embers)
let cloudSpr = null;
function cloudSprite() { // a dithered blob: a checker of dark pixels inside a lumpy ellipse
  const c = document.createElement('canvas'); c.width = 120; c.height = 48;
  const g = c.getContext('2d'); g.fillStyle = '#000';
  for (let y = 0; y < 48; y++) for (let x = 0; x < 120; x++) {
    const dx = (x - 60) / 60, dy = (y - 24) / 24, lump = .82 + .18 * Math.sin(x * .19) * Math.cos(y * .31);
    if (dx * dx + dy * dy < lump && (x + y) % 2 === 0) g.fillRect(x, y, 1, 1);
  }
  return c;
}
function weather(ctx, game, bw, bh, now) {
  const want = game.level && isWetSeason(game) && hash(((game.tick ?? 0) / 6 | 0) + game.world.seed) < .55 ? 1 : 0; // showers come and go every 1.5 weeks
  rain += (want - rain) * .02;
  if (REDUCED) return;
  cloudSpr ??= cloudSprite();
  ctx.globalAlpha = .1 + rain * .08;
  for (let k = 0; k < 3; k++) { // slow cloud shadows
    const span = bw + 160, x = ((now / 1000 * (3 + k) + hash(k) * span) % span) - 140, y = hash(k + 5) * bh * .8 + ((now / 1000 * 1.2) % 40) - 20;
    ctx.drawImage(cloudSpr, Math.round(x), Math.round(y));
  }
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
  ctx.globalAlpha = 1;
}
function life(ctx, game, pos, shown, now) {
  const wd = game.world, { n, kind, cover, wt, fire } = wd;
  for (let i = 0; i < n; i++) {
    if (!shown[i]) continue;
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
  if (!data) { life(ctx, game, pos, shown, now); weather(ctx, game, bw, bh, now); }
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
