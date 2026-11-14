// Iso map renderer. Reads game state only; never writes it.
import { KIND, BLOCK, WET_WT, VEG, vegOf } from '../sim/world.js';
import { TW, TH, tileToScreen } from './isoMath.js';
import { TICKS_PER_YEAR } from '../sim/season.js';
import { isWetSeason } from '../sim/game.js';
import { drawFx } from './fx.js';
import { PS, WALK_FRAME_MS, WORK_FRAME_MS, crewPlan, crewSeen, crewSweep, crewPhase, crewEntries, guardPose, personSprite, resetCrews, crewHash, arsonsNow } from './crew.js';

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const vegVariant = i => Math.floor(hash(i) * 4) % 4;
// Pure. Tile i and the tiles in front of it (x+1, y+1 and the diagonal), inside a w x h map. Row-major order draws them after tile i.
export const frontTiles = (w, h, i) => {
  const x = i % w, y = (i - x) / w, out = [i];
  if (x + 1 < w) out.push(i + 1);
  if (y + 1 < h) out.push(i + w);
  if (x + 1 < w && y + 1 < h) out.push(i + w + 1);
  return out;
};
const tileVariant = i => Math.floor(hash(i + .37) * 4) % 4; // ground art variant, not linked to the plant variant
const DRY = [124, 88, 54], WET = [64, 50, 38], GREEN = [92, 132, 54], FOREST = [54, 98, 46], WATER = [44, 128, 172], SOAK = [52, 108, 136]; // SOAK: the water tint in soaked peat, so the soil keeps its colour
const BLACK = [0, 0, 0], WHITE = [255, 255, 255];
const FLAME = ['#c8321e', '#f08a2c', '#ffd25a', '#fff1b0'], CHAR = '#3a2a22', SMOKE = [205, 200, 192]; // flame layers, outer to core
const HW = TW / 2, HH = TH / 2;
const D = 10, EDGE = D + 12, HEAD = 28, SW = TW, SH = HEAD + TH + EDGE + 1; // sprite: anchor (SW/2, HEAD) = tile top vertex
// Half-width of row r in a 2:1 diamond that is 2*hh rows high.
const rowW = (r, hh = HH) => r < hh ? (r + 1) * 2 : (2 * hh - r) * 2;

// Canal sprite steps from the water depth below the bank in metres, on the scale of the peat water table, so a canal and the peat beside it
// change together. 0: at the bank (< 0.1 m). 1: wet, down to the 40 cm line. 2: dry, down to 1 m. 3: at the bed (1 m or more, or the bed of a shallower canal).
export const canalStep = (cWater, cDepth) => cDepth <= 0 ? 0 : cWater >= Math.min(1, cDepth) ? 3 : cWater > WET_WT ? 2 : cWater >= 0.1 ? 1 : 0;
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
const SEEP = mix(SOAK, WET, .55); // the bank soaked by a full canal

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
function house(g, hx, hy, hw, roof, wall = '#f0dcaa') {
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
const ROOF = { tile: ['#cc5a3c', '#963e2a'], zinc: ['#a0b8c8', '#6e8698'], thatch: ['#d4ac58', '#9c7c3c'] };
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
// Tree palettes, dark to light: [shade, mid, lit, glint].
const GREENS = ['#24603a', '#3a8a3e', '#62b04a', '#a4dc62'], OLIVE = ['#3e5a32', '#5e7e3a', '#86a44c', '#bcd06e'], BLUE_GREEN = ['#1e5a4a', '#2e7c5c', '#46a06e', '#7ccc8c'];
const DARK = ['#1a4632', '#28603a', '#3c8044', '#62a654'], LIME = ['#467224', '#66982c', '#92c23c', '#c8e862'], PUCUK = ['#24603a', '#3a8a3e', '#62b04a', '#ec866a']; // PUCUK: red young leaves
const JELUTONG = ['#2e6834', '#46923a', '#72b84a', '#acda68'], GELAM = ['#365c46', '#527e5a', '#7ca66e', '#aacc90'];
const BARK = ['#8c603c', '#5e3e2a'], PALE_BARK = ['#dacca8', '#9e9076']; // [lit side, shade side]
const CHARRED = ['#4e4038', '#221a16'], BUD = ['#6a9a3a', '#a4d45a']; // a charred trunk; the first new leaves on a scorched tree
// Leaf mode while the tree sprites are built: 0 full crown, 1 bare (scorched: no leaves, charred bark), 2 budding (bare limbs with new leaves).
let leafMode = 0;
const bark = b => leafMode ? CHARRED : b;
// A lumpy crown: a centre clump and a ring of n clumps. Each pixel takes its shade from its own clump, lit from the top left,
// so the crown reads as many leaf masses, not one disc. holes: the chance to drop an edge pixel, for a ragged outline.
function crown(g, cx, cy, rx, ry, pal, seed, holes = .3, n = 5) {
  const cl = [[cx, cy, Math.min(rx, ry) * .8]];
  for (let k = 0; k < n; k++) {
    const a = (k / n + hash(seed + k) * .15) * 2 * Math.PI;
    cl.push([cx + Math.cos(a) * rx * .55, cy + Math.sin(a) * ry * .5 - ry * .1, ry * (.45 + hash(seed * 3 + k) * .2)]);
  }
  if (leafMode) return bareCrown(g, cx, cy, ry, cl, seed);
  for (let py = Math.floor(cy - ry - 2); py <= cy + ry + 2; py++) for (let px = Math.floor(cx - rx - 2); px <= cx + rx + 2; px++) {
    let best = 0, bc = null;
    for (const c of cl) { const m = c[2] - Math.hypot(px + .5 - c[0], py + .5 - c[1]); if (m > best) { best = m; bc = c; } }
    if (!bc) continue;
    const hv = hash(seed * 31 + px * 17 + py * 131);
    if (best < 1 && hv < holes) continue;
    let v = -((px + .5 - bc[0]) * .55 + (py + .5 - bc[1]) * .85) / bc[2] - (py - cy) / ry * .35; // clump light, plus a darker underside
    if (hv > .94) v += .4; else if (hv < .06) v -= .5; // leaf glints and gaps
    g.fillStyle = pal[v > .75 ? 3 : v > .3 ? 2 : v > -.3 ? 1 : 0]; g.fillRect(px, py, 1, 1);
  }
}
// A scorched crown: charred limbs from the crown base out to each clump, sparse twigs at the clump edges.
// Budding (leafMode 2): small new leaves on the twigs.
function bareCrown(g, cx, cy, ry, cl, seed) {
  const by = Math.round(cy + ry * .6);
  for (const [x1, y1] of cl.slice(1)) {
    const n = Math.max(Math.abs(x1 - cx), Math.abs(y1 - by)) | 0;
    for (let k = 0; k <= n; k++) { g.fillStyle = CHARRED[k < n / 2 ? 1 : 0]; g.fillRect(Math.round(cx + (x1 - cx) * k / n), Math.round(by + (y1 - by) * k / n), 1, 1); }
  }
  for (const [x, y, r] of cl.slice(1)) for (let k = 0; k < 4; k++) {
    const a = hash(seed * 7 + x * 3 + k) * 2 * Math.PI, px = Math.round(x + Math.cos(a) * r * .8), py = Math.round(y + Math.sin(a) * r * .6 - 1);
    g.fillStyle = CHARRED[1]; g.fillRect(px, py, 1, 1);
    if (leafMode === 2) { g.fillStyle = BUD[k & 1]; g.fillRect(px + (k & 1 ? 1 : -1), py - 1, 1, 1); }
  }
}
// A 2 px trunk, lit on the left. flare: the height of the buttress roots at the foot.
function trunk(g, bx, by, h, bk = BARK, flare = 0) {
  bk = bark(bk);
  g.fillStyle = bk[1]; g.fillRect(bx - 1, by - h, 2, h);
  g.fillStyle = bk[0]; g.fillRect(bx - 1, by - h, 1, h);
  if (!flare) return;
  g.fillStyle = bk[1]; g.fillRect(bx - 2, by - flare, 1, flare); g.fillRect(bx + 1, by - flare, 1, flare); g.fillRect(bx - 3, by - 1, 1, 1); g.fillRect(bx + 2, by - 1, 1, 1);
  g.fillStyle = bk[0]; g.fillRect(bx - 2, by - flare, 1, 1);
}
// 2 limbs that fork up and out from the trunk at height top. The crown covers their tips.
function fork(g, bx, top, spread) {
  g.fillStyle = bark(BARK)[1];
  for (let k = 1; k <= spread; k++) { g.fillRect(bx - 1 - k, top - k, 1, 1); g.fillRect(bx + k, top - k, 1, 1); }
}
function tree(g, bx, by, tall, rad, pal = GREENS) { // a young tree: the crown sits low on a short trunk
  pool(g, bx + 2, by, rad + 1, SHADOW);
  trunk(g, bx, by, tall + 2);
  crown(g, bx, by - tall - rad + 1, rad + 1, rad, pal, bx * 7 + by * 13 + tall, .3, 3);
}
function canopy(g, bx, by, tall, rx, ry, pal, seed, holes = .3, n = 6) { // a mature tree: buttress, a fork, a lumpy crown. rx and ry set its shape
  pool(g, bx + 2, by, rx - 1, SHADOW);
  trunk(g, bx, by, tall + 2, BARK, 2); fork(g, bx, by - tall, 3);
  crown(g, bx, by - tall - ry + 1, rx, ry, pal, seed, holes, n);
}
function emergent(g, bx, by) { // a tall straight trunk with buttress roots, 2 low limbs and a high wide crown above the other trees
  pool(g, bx + 2, by, 5, SHADOW);
  trunk(g, bx, by, 20, BARK, 3); fork(g, bx, by - 16, 4);
  crown(g, bx - 4, by - 19, 4, 3, GREENS, 91, .35, 3); crown(g, bx + 4, by - 18, 4, 3, GREENS, 92, .35, 3);
  crown(g, bx, by - 24, 7, 4, GREENS, 93, .3, 5);
}
function gelam(g, bx, by, tall) { // gelam (Melaleuca): a pale papery trunk and a narrow open grey-green crown, common on burnt peat
  pool(g, bx + 1, by, 3, SHADOW);
  trunk(g, bx, by, tall, PALE_BARK);
  g.fillStyle = bark(PALE_BARK)[1]; for (let k = 3; k < tall; k += 4) g.fillRect(bx - 1, by - k, 1, 1); // flaking bark
  crown(g, bx, by - tall + 2, 3, tall * .4, GELAM, bx * 5 + tall, .45, 4);
}
function tiered(g, bx, by, pal, seed) { // a narrow cone of 3 leaf tiers, wide at the foot
  pool(g, bx + 2, by, 5, SHADOW);
  trunk(g, bx, by, 18);
  for (const [dy, rx, ry, k] of [[-8, 6, 2.5, 0], [-13, 4.5, 2.5, 1], [-18, 3, 2.5, 2]]) crown(g, bx, by + dy, rx, ry, pal, seed + k, .3, 4);
}
function twin(g, bx, by, pal, seed) { // 2 stems that lean apart from one foot, each with its own crown
  pool(g, bx + 2, by, 7, SHADOW);
  g.fillStyle = bark(BARK)[1];
  for (let k = 0; k < 11; k++) { g.fillRect(bx - 1 - (k >> 2), by - k, 2, 1); g.fillRect(bx + 1 + (k >> 2), by - k, 2, 1); }
  g.fillStyle = bark(BARK)[0]; for (let k = 0; k < 11; k++) g.fillRect(bx - 1 - (k >> 2), by - k, 1, 1);
  crown(g, bx - 4, by - 13, 5, 4, pal, seed, .3, 4); crown(g, bx + 5, by - 15, 5, 4, pal, seed + 1, .3, 4);
}
function mixed(g, bx, by, dark, light, seed) { // a dark crown with a light flush of new leaves on its sunny side
  canopy(g, bx, by, 6, 7, 6, dark, seed);
  crown(g, bx - 2, by - 14, 4, 3, light, seed + 5, .45, 3);
}
function shrub(g, bx, by, rad) {
  pool(g, bx + 1, by + 1, rad + 1, SHADOW);
  for (const [dx, dy, r, c] of [[0, 0, rad, '#3a8a3e'], [-1, -1, rad - 1, '#50a446'], [-2, -2, rad - 3, '#80c658']])
    if (r > 0) { g.fillStyle = c; for (let y = -r; y <= 0; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); g.fillRect(bx + dx - w, by + dy + y, w * 2 + 1, 1); } }
}
function seedling(g, bx, by, tall) {
  g.fillStyle = '#7cb83e'; g.fillRect(bx, by - tall, 1, tall);
  g.fillStyle = '#bee668'; g.fillRect(bx - 2, by - tall, 2, 1); g.fillRect(bx + 1, by - tall + 1, 2, 1); g.fillRect(bx, by - tall - 1, 1, 1);
}
function fern(g, bx, by, len) { // a fan of fronds from one base
  for (const [ux, c] of [[-2, '#4c9238'], [-1, '#84c44e'], [0, '#84c44e'], [1, '#84c44e'], [2, '#4c9238']])
    for (let k = 1; k <= len - Math.abs(ux); k++) { g.fillStyle = c; g.fillRect(bx + ux * k, by - k + (Math.abs(ux) > 1 ? k >> 1 : 0), 1, 1); }
}
function sapling(g, bx, by, tall) { // a thin stem with 2 tiers of leaves
  g.fillStyle = '#7cb83e'; g.fillRect(bx, by - tall, 1, tall);
  g.fillStyle = '#bee668';
  for (const t of [tall, tall >> 1]) { g.fillRect(bx - 2, by - t, 2, 1); g.fillRect(bx + 1, by - t - 1, 2, 1); }
  g.fillRect(bx, by - tall - 1, 1, 1);
}
function tuft(g, bx, by) { // a sedge tuft: thin straight blades of different heights
  for (const [dx, h, c] of [[-3, 3, '#4c9238'], [-2, 5, '#84c44e'], [-1, 4, '#84c44e'], [0, 6, '#bee668'], [1, 4, '#84c44e'], [2, 5, '#4c9238'], [3, 3, '#4c9238']]) {
    g.fillStyle = c; g.fillRect(bx + dx, by - h, 1, h);
  }
}
function lowShrub(g, bx, by, rx) { // a wide flat mound with pale flower specks
  pool(g, bx + 1, by + 1, rx + 1, SHADOW);
  pool(g, bx, by, rx, '#3a8a3e'); pool(g, bx - 1, by - 1, rx - 2, '#50a446');
  g.fillStyle = '#ffe46a'; g.fillRect(bx - 3, by - 2, 1, 1); g.fillRect(bx + 2, by - 1, 1, 1); g.fillRect(bx, by - 3, 1, 1);
}
// Trees, drawn back to front in each sprite. They differ in shape (round, tall, flat, cone, 2 stems, open), in size and in colour.
const TREES = [((g, x, y) => { tree(g, x - 6, y + 9, 4, 3); tree(g, x + 2, y + 7, 5, 2, JELUTONG); tree(g, x + 5, y + 12, 3, 3, OLIVE); }), // young trees
        ((g, x, y) => { tree(g, x - 9, y + 8, 4, 3); canopy(g, x + 1, y + 12, 6, 8, 6, GREENS, 11); }), // broad round
        ((g, x, y) => { tree(g, x + 6, y + 8, 6, 4, JELUTONG); emergent(g, x - 2, y + 12); }), // emergent
        ((g, x, y) => { gelam(g, x - 5, y + 8, 15); gelam(g, x + 3, y + 10, 18); gelam(g, x + 8, y + 13, 11); }), // gelam
        ((g, x, y) => { tree(g, x - 8, y + 9, 3, 3, OLIVE); canopy(g, x + 2, y + 12, 6, 4, 8, BLUE_GREEN, 41, .3, 5); }), // tall oval
        ((g, x, y) => { canopy(g, x, y + 11, 7, 10, 4, DARK, 51, .3, 8); }), // wide flat crown
        ((g, x, y) => { tree(g, x + 7, y + 8, 3, 3, GREENS); tiered(g, x - 2, y + 12, LIME, 61); }), // cone
        ((g, x, y) => { twin(g, x, y + 12, OLIVE, 71); }), // 2 stems
        ((g, x, y) => { tree(g, x + 8, y + 8, 3, 3, DARK); mixed(g, x - 1, y + 12, DARK, LIME, 81); }), // dark and light
        ((g, x, y) => { tree(g, x - 8, y + 8, 4, 3, JELUTONG); canopy(g, x + 2, y + 12, 7, 7, 6, PUCUK, 91); }), // red young leaves
        ((g, x, y) => { canopy(g, x - 4, y + 9, 5, 6, 5, GREENS, 31); canopy(g, x + 5, y + 13, 4, 6, 4, BLUE_GREEN, 32); }), // a pair
        ((g, x, y) => { gelam(g, x - 7, y + 9, 13); canopy(g, x + 3, y + 12, 7, 7, 6, OLIVE, 101, .55, 5); })];
const COVER_BINS = 5, HEAT_BINS = 16;
// wt heatmap: 0 m deep blue -> WET_WT bright blue, then a hard step to amber -> 1.5 m dark red. The step makes the wet/dry split read at a glance.
export const heatColor = wt => wt <= WET_WT ? mix([20, 60, 200], [70, 150, 240], Math.max(0, wt) / WET_WT)
  : mix([245, 185, 40], [150, 30, 20], Math.min(1, (wt - WET_WT) / (1.5 - WET_WT)));
const GROUND_BASE = [mix(WET, SOAK, .55), WET, DRY]; // [flooded, wet, dry]
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
// Fire size from the ticks since the tile was lit: 0 small, 1 medium, 2 large. A surface fire lasts FIRE.surfaceTicks = 8 ticks.
export const fireSize = age => age < 3 ? 0 : age < 6 ? 1 : 2;
export const FLAME_VARIANTS = 3, FLAME_FRAMES = 4;
// Tongue counts, base spread (px), heights and widths for each size.
const TONGUES = [{ n: 2, dx: 5, h: [5, 8], wd: [3, 4] }, { n: 3, dx: 8, h: [8, 14], wd: [5, 7] }, { n: 5, dx: 7, h: [12, 22], wd: [6, 9] }];
// Pure. Frame table for one flame variant: FLAME_FRAMES frames of [dx, dy, height, width, lean] tongues, back to front.
// The base points stay fixed in a variant; the heights and leans change from frame to frame.
export function flameFrames(size, v) {
  const t = TONGUES[size], r = k => hash(size * 1000 + v * 100 + k);
  const bases = Array.from({ length: t.n }, (_, k) => [Math.round((t.n === 1 ? 0 : k / (t.n - 1) * 2 - 1) * t.dx + (r(k) - .5) * 4), Math.round((r(k + 20) - .5) * (size + 1) * 2)])
    .sort((a, b) => a[1] - b[1]);
  return Array.from({ length: FLAME_FRAMES }, (_, f) => bases.map(([dx, dy], k) => {
    const q = r(40 + f * 10 + k), mid = Math.abs(dx) < t.dx / 2 ? 1 : .75; // middle tongues are taller
    return [dx, dy, Math.round((t.h[0] + (t.h[1] - t.h[0]) * q) * mid), t.wd[0] + Math.round(r(k + 60) * (t.wd[1] - t.wd[0])), Math.round((r(70 + f * 10 + k) - .5) * 3)];
  }));
}
// Fills the whole tile top (the 2:1 diamond) with col.
const tileTop = (g, x, y, col) => { g.fillStyle = col; for (let r = 0; r < TH; r++) { const w = rowW(r); g.fillRect(x - w, y + r, w * 2, 1); } };
// Calls f(px, py) for n points inside the tile top, picked from seed.
const topPoints = (seed, n, f) => {
  for (let k = 0, m = 0; m < n && k < n * 4; k++) {
    const py = Math.floor(hash(seed + k * 1.7) * TH), w = rowW(py) - 1, px = Math.round((hash(seed + k * 2.3 + .5) * 2 - 1) * w);
    if (w > 0) { f(px, py, m); m++; }
  }
};
// Glow cracks: short random walks across the tile top.
function cracks2(g, x, y, seed, n, cols) {
  topPoints(seed, n, (px, py, m) => {
    for (let s = 0; s < 5; s++) {
      if (Math.abs(px) >= rowW(py)) break;
      g.fillStyle = cols[(m + s) % cols.length]; g.fillRect(x + px, y + py, 1, 1);
      px += hash(seed + m * 7 + s) > .5 ? 1 : -1; if (hash(seed + m * 11 + s + .3) > .6) py += hash(seed + m + s) > .5 ? 1 : -1;
      if (py < 0 || py >= TH) break;
    }
  });
}
// Smoke puff: 3 nested disks of fillRect rows in 2x2 px cells, built once for each whole radius from 2 to 4 cells.
// The cells and the 2 px position grid keep the smoke as coarse as the other sprites; 1 px puffs blend into a smooth haze.
const PUFF_ALPHA = [.18, .26, .4], PUFF_R0 = 2, PUFF_R1 = 4, PUFF_CELL = 2;
function puffSprite(r) {
  const c = document.createElement('canvas'); c.width = c.height = (2 * r + 1) * PUFF_CELL;
  const g = c.getContext('2d'); g.scale(PUFF_CELL, PUFF_CELL);
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
      g.fillStyle = '#b4e8f8'; g.fillRect(x - 8, y + 5, 3, 1); g.fillRect(x + 5, y + 10, 2, 1);
    }
  }));
  const cache = {
    ground,
    // Fire art. A frame is drawn with its tile top vertex at (SW/2, HEAD), like a tile sprite.
    // flame[size][variant][frame]. Small and medium fires scorch a patch; a large fire chars the whole tile top.
    flame: [0, 1, 2].map(size => Array.from({ length: FLAME_VARIANTS }, (_, v) => flameFrames(size, v).map((f, n) => sprite((g, x, y) => {
      if (size === 2) tileTop(g, x, y, CHAR); else pool(g, x, y + 10, size ? 11 : 6, CHAR);
      pool(g, x - 1, y + 10, size === 2 ? 11 : size ? 7 : 4, '#5a2c1a');
      g.fillStyle = FLAME[1]; topPoints(size * 50 + v * 7 + n, 2 + size * 2, (px, py) => g.fillRect(x + px, y + py, 1, 1)); // sparks on the char
      f.forEach(([dx, dy, h, wd, lean]) => tongue(g, x + dx, y + 11 + dy, h, wd, lean));
    })))),
    // ember[variant][frame]: smouldering peat over the whole tile top. The 2 frames swap the bright and the dim cracks.
    ember: Array.from({ length: FLAME_VARIANTS }, (_, v) => [0, 1].map(k => sprite((g, x, y) => {
      tileTop(g, x, y, '#4a2216'); // hot red-brown under the char
      g.fillStyle = CHAR; topPoints(300 + v, 40, (px, py) => g.fillRect(x + px, y + py, 3, 1));
      g.fillStyle = '#2a1e18'; topPoints(350 + v, 14, (px, py) => g.fillRect(x + px, y + py, 2, 1));
      cracks2(g, x, y, 400 + v * 13, 14, k ? [FLAME[0], FLAME[1], FLAME[0]] : [FLAME[1], FLAME[0], FLAME[2]]);
      g.fillStyle = FLAME[2]; topPoints(500 + v * 5 + k, 5, (px, py) => g.fillRect(x + px, y + py, 1, 1));
    }))),
    // cool[variant][frame]: a tile just put out. Grey ash on char, with a few dull glow pixels that flicker.
    cool: Array.from({ length: FLAME_VARIANTS }, (_, v) => [0, 1].map(k => sprite((g, x, y) => {
      tileTop(g, x, y, '#2e2420');
      g.fillStyle = '#6a625c'; topPoints(600 + v, 22, (px, py) => g.fillRect(x + px, y + py, 1 + (px & 1), 1));
      g.fillStyle = '#8e8680'; topPoints(700 + v, 6, (px, py) => g.fillRect(x + px, y + py, 1, 1));
      cracks2(g, x, y, 800 + v * 13, 3, ['#7a2a18', k ? FLAME[0] : '#7a2a18']);
    }))),
    puff: Array.from({ length: PUFF_R1 - PUFF_R0 + 1 }, (_, k) => puffSprite(PUFF_R0 + k)),
    heat: Array.from({ length: HEAT_BINS }, (_, b) => both((g, x, y, d) => block(g, x, y, heatColor(b / (HEAT_BINS - 1) * 1.5), d))),
    // Overlays for a block or a backfill. drawWorld draws them on top of the tile sprite.
    // [axis]: the sprite for a channel along AXES[axis]. A block lies across the channel.
    overlay: {
      [BLOCK.TEMP]: AXES.map((_, ax) => sprite((g, x, y) => { // sandbags in two rows
        for (const [s0, up] of [[-6, 0], [-4.75, 2]]) for (let s = s0; s <= -s0; s += 2.5) {
          const [bx, by] = across(ax, s, x, y);
          if (!up) { g.fillStyle = SHADOW; g.fillRect(bx - 2, by + 2, 5, 1); } // shadow under the front row
          g.fillStyle = '#a88a54'; g.fillRect(bx - 2, by - up + 1, 4, 1); g.fillStyle = '#e2c682'; g.fillRect(bx - 2, by - up - 1, 4, 2);
          g.fillStyle = '#f6e2aa'; g.fillRect(bx - 1, by - up - 1, 2, 1);
          g.fillStyle = '#6e5c3a'; g.fillRect(bx + 1, by - up, 1, 1); // the seam between 2 bags
        }
      })),
      [BLOCK.PERM]: AXES.map((_, ax) => sprite((g, x, y) => { // plank wall with posts, taller than the sandbags
        for (let s = -6.5; s <= 6.5; s += .5) {
          const [bx, by] = across(ax, s, x, y);
          for (let r = 0; r < 6; r++) { g.fillStyle = r ? r % 2 ? '#966640' : '#ac7848' : '#d8a462'; g.fillRect(bx, by - 5 + r, 2, 1); }
        }
        for (const s of [-7, -2.3, 2.3, 7]) {
          const [bx, by] = across(ax, s, x, y);
          g.fillStyle = '#604a34'; g.fillRect(bx, by - 8, 2, 11); g.fillStyle = '#987c5c'; g.fillRect(bx, by - 8, 1, 11); // lit left side
          g.fillStyle = '#bea07a'; g.fillRect(bx, by - 8, 2, 1); // cut top
        }
      })),
      [BLOCK.FILLED]: [sprite((g, x, y) => { // backfilled canal (sim sets kind PEAT): low peat mound with fill seams
        pool(g, x, y + HH + 1, 11, '#6a4e30'); pool(g, x, y + HH, 10, '#8a6a44');
        g.fillStyle = '#6a4e30'; g.fillRect(x - 7, y + HH - 1, 14, 1); g.fillRect(x - 4, y + HH + 2, 8, 1);
      })],
    },
    pond: sprite((g, x, y) => { // round pool with a fish cage, over the channel
      pool(g, x, y + HH, 12, rgb(WALL)); pool(g, x, y + HH + 1, 11, rgb(WATER));
      g.fillStyle = '#b4e8f8'; g.fillRect(x - 8, y + HH, 3, 1);
      g.fillStyle = '#f0dcaa'; g.fillRect(x - 4, y + HH - 2, 9, 1); g.fillRect(x - 4, y + HH + 2, 9, 1); g.fillRect(x - 4, y + HH - 2, 1, 5); g.fillRect(x + 4, y + HH - 2, 1, 5);
      g.fillStyle = '#ff9c3c'; g.fillRect(x - 1, y + HH, 2, 1); g.fillRect(x + 6, y + HH + 3, 2, 1); // fish
    }),
    // River: each variant moves the ripples, so a long river does not repeat one pattern.
    river: [0, 1, 2, 3].map(v => both((g, x, y, d) => {
      const top = [38, 112, 156];
      block(g, x, y + 4, top, d - 4);
      for (let k = 0; k < 3; k++) {
        const rx = Math.round((hash(v * 17 + k) - .5) * 18), ry = 6 + k * 3 + (v & 1), len = 2 + (hash(v * 5 + k) * 4 | 0);
        if (Math.abs(rx) + len < rowW(ry - 4)) { g.fillStyle = k ? '#8cd2ee' : '#c4eefa'; g.fillRect(x + rx, y + ry, len, 1); }
      }
    })),
    // Village variants: tile roofs, a zinc roof, a thatch roof, and a row of 3 small houses.
    village: [0, 1, 2, 3].map(v => both((g, x, y, d) => {
      const top = [112, 92, 62];
      block(g, x, y, top, d); texture(g, x, y, top, 42 + v);
      eachTop(g, x, y, (a, b) => Math.abs(a - b) < 1.6 && a > 2 && a < 14 ? rgb(mix(top, WHITE, .12)) : null); // a beaten path across the tile
      if (v === 0) { house(g, x - 10, y + 7, 10, ROOF.tile); house(g, x + 2, y + 10, 10, ROOF.tile); }
      if (v === 1) { tree(g, x - 8, y + 8, 4, 3); house(g, x - 3, y + 11, 12, ROOF.zinc, '#e6cf9c'); }
      if (v === 2) { house(g, x + 1, y + 7, 10, ROOF.thatch, '#dcb882'); house(g, x - 11, y + 10, 10, ROOF.tile); }
      if (v === 3) { for (const [hx, hy, r] of [[-11, 7, 'zinc'], [-3, 10, 'tile'], [5, 13, 'thatch']]) house(g, x + hx, y + hy, 7, ROOF[r]); }
    })),
    // Farm variants: crop rows along each tile axis, cassava mounds, and a part-planted plot.
    farm: [0, 1, 2, 3].map(v => both((g, x, y, d) => {
      const top = [128, 100, 60], leaf = '#8cc644', dark = '#5e9836';
      block(g, x, y, top, d); texture(g, x, y, top, 60 + v);
      eachTop(g, x, y, (a, b) => {
        if (a < 1.5 || b < 1.5 || a > 14.5 || b > 14.5) return null; // a bare rim
        const u = v === 1 ? a : b, m = u % 3;
        if (v === 2) return (a % 4 < 1.6 && b % 4 < 1.6) ? (a % 4 < .8 ? leaf : dark) : null;
        if (v === 3 && a > 9) return m < .8 ? rgb(mix(top, BLACK, .2)) : null; // ploughed furrows, not planted yet
        return m < .8 ? leaf : m < 1.4 ? dark : null;
      });
    })),
    bare: [1, 2].map(m => TREES.map(f => sprite((g, x, y) => { leafMode = m; f(g, x, y); leafMode = 0; }))), // [bare, budding][tree variant]: scorched trees
    veg: { // sprites for each type; drawWorld picks one from the tile hash
      [VEG.FERN]: [sprite((g, x, y) => { fern(g, x - 5, y + 8, 4); fern(g, x + 5, y + 11, 3); }), sprite((g, x, y) => { fern(g, x + 1, y + 10, 5); fern(g, x - 7, y + 9, 3); }),
        sprite((g, x, y) => { tuft(g, x - 4, y + 9); tuft(g, x + 5, y + 12); }), sprite((g, x, y) => { fern(g, x - 2, y + 11, 6); fern(g, x + 7, y + 9, 2); fern(g, x - 8, y + 8, 2); })],
      [VEG.SEEDLING]: [sprite((g, x, y) => { seedling(g, x - 5, y + 8, 4); seedling(g, x + 3, y + 7, 3); seedling(g, x, y + 12, 4); }),
        sprite((g, x, y) => { seedling(g, x - 3, y + 10, 4); seedling(g, x + 5, y + 9, 5); }),
        sprite((g, x, y) => { for (const [dx, dy, t] of [[-7, 8, 2], [-2, 7, 3], [4, 8, 2], [-4, 12, 3], [3, 12, 2]]) seedling(g, x + dx, y + dy, t); }),
        sprite((g, x, y) => { sapling(g, x - 2, y + 11, 8); seedling(g, x + 6, y + 9, 3); })],
      [VEG.SHRUB]: [sprite((g, x, y) => { shrub(g, x - 4, y + 8, 5); shrub(g, x + 5, y + 11, 4); }), sprite((g, x, y) => { shrub(g, x + 1, y + 10, 6); shrub(g, x - 8, y + 9, 3); }),
        sprite((g, x, y) => { shrub(g, x - 7, y + 9, 3); shrub(g, x + 1, y + 8, 3); shrub(g, x + 7, y + 11, 3); shrub(g, x - 3, y + 13, 3); }), sprite((g, x, y) => { lowShrub(g, x - 1, y + 10, 9); })],
      // Trees, drawn back to front in each sprite. They differ in shape (round, tall, flat, cone, 2 stems, open), in size and in colour.
      [VEG.TREE]: TREES.map(sprite),
    },
  };
  return cache;
}

// ---- wildlife: one 16x16 sprite per species, drawn once from a character grid (one letter per pixel, '.' is empty).
// The art sits at the bottom centre of the canvas, so the feet are at the tile centre. The silhouette is the same shape in one dark colour.
const AS = 16, SILHOUETTE = '#4a4338';
export const ANIMALS = {
  orangutan: { pal: { o: '#dc6a2a', O: '#fa984a', f: '#f0b878', m: '#c08454', k: '#1c120c' }, rows: [
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
  langur: { pal: { r: '#aa462e', e: '#70301e', k: '#1c120c' }, rows: [
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
  sunbear: { pal: { d: '#2c2420', t: '#dab068', y: '#f4c454', k: '#0e0a08' }, rows: [
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
  hornbill: { pal: { y: '#fad444', o: '#f08c2c', b: '#1c1a22', w: '#f0ece0', k: '#f0ece0', l: '#8a6a3a' }, rows: [
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
  stork: { pal: { b: '#1c1a22', w: '#f0ece0', r: '#ea523e', k: '#f0ece0' }, rows: [
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
  fishowl: { pal: { b: '#c89c58', d: '#7e5630', y: '#fadc44', k: '#1c120c', o: '#d8802c' }, rows: [
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
  snakehead: { pal: { n: '#2a4638', l: '#bfe6f2' }, rows: [
    '.....n......',
    '....nnn.....',
    '...nnnnn....',
    '.llllllllll.',
    'l..l....l..l'] },
  otter: { pal: { b: '#946038', t: '#ecd6ac', k: '#1c120c', l: '#bfe6f2' }, rows: [
    '..bb',
    '.bbbb',
    '.bkbbbbb',
    '.tttbbbbbb',
    '.ttbbbbbbbb',
    'lll.llll.lll',
    '.l..l..l..l.'] },
  gharial: { pal: { g: '#7a9640', d: '#4a5e2a', k: '#fadc44', b: '#c2cc80' }, rows: [
    '.......dd.d.d.d.',
    '....gggggggggggg',
    'ggggggkgggggggdd',
    'bbbbbbbbbbbbbb..',
    '......g.g..g.g..'] },
  monitor: { pal: { m: '#586840', l: '#a2b26c', k: '#f6e468', t: '#c04a3a' }, rows: [
    '..mm............',
    't.mmkmmmm.......',
    '..mmmlmlmmmmmm..',
    '..mmmmmmmmmmmmmm',
    '..mm.mm..mm.mm..'] },
};
// The plant sprite of tile i, or null: peat that is not burning, with a seedling or some cover.
function vegSprite(game, i) {
  const wd = game.world;
  if (wd.kind[i] !== KIND.PEAT || wd.fire[i]) return null;
  const veg = game.seedlings.has(i) ? VEG.SEEDLING : vegOf(wd.cover[i]);
  if (veg === VEG.NONE) return null;
  const vs = cache.veg[veg], k = Math.floor(hash(i) * vs.length); // for 4 sprites this is vegVariant(i)
  const st = veg === VEG.TREE && scorchAt ? treeState(scorchAt[i], game.tick ?? 0, wetSince) : 0;
  return st ? cache.bare[st - 1][k] : vs[k];
}

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
// One example tile for the journal, drawn as on the map, cropped to the tile and the art above it.
// Canals run straight along x: arms on DIRS 0 and 2, width step 0. Water step 1 is an open canal, 0 a full canal behind a block.
const ART_TOP = 14, CANAL_X = 1 | 1 << 4;
export function tileArt(name) {
  cache ??= buildCache();
  const layers = {
    peatWet: [cache.ground[1][0][0][0]], peatDry: [cache.ground[2][0][0][0]],
    canal: [canalSprite(CANAL_X | 1 << 18)],
    tempBlock: [canalSprite(CANAL_X), cache.overlay[BLOCK.TEMP][0]], permBlock: [canalSprite(CANAL_X), cache.overlay[BLOCK.PERM][0]],
    river: [cache.river[0][0]], village: [cache.village[0][0]], farm: [cache.farm[0][0]],
  }[name];
  const c = document.createElement('canvas'); c.width = SW; c.height = HEAD + TH + D + 1 - ART_TOP;
  const g = c.getContext('2d');
  for (const l of layers) g.drawImage(l, 0, -ART_TOP);
  return c;
}

// Slide state of each animal, by id: when its last move started, when it first showed, when its leave fade started.
const SLIDE_MS = 600;
const slides = new Map(), drawList = [], pa = [0, 0], pb = [0, 0];
let slideFrame = 0;
export const resetSlides = () => { slides.clear(); resetCrews(); };
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
// Adds a draw entry for each crew person (crew.js) to drawList, from index n. Returns the new count.
const phase = { t: 0, alpha: 0, walking: false };
function addCrews(game, now, w, h, kind, pos, n) {
  for (const j of game.jobs) { const key = `${j.id}:${j.i}:${j.doneAt}`; crewSeen(key, now, slideFrame, () => crewPlan(j.id, j.i, key, w, h, kind, j.tiles)); }
  for (const i of game.fireGroups ?? []) { const key = 'guard:' + i; crewSeen(key, now, slideFrame, () => crewPlan('guard', i, key, w, h, kind)); }
  if (game.level && game.tick < game.level.years * TICKS_PER_YEAR) (game.illegal ?? []).forEach((p, c) => { // diggers at the head of each illegal canal that still grows
    const path = game.level.illegalCanals?.[c]; if (!path || p < 0 || p >= path.length) return;
    const i = path[p][1] * w + path[p][0], key = `illegal:${c}:${p}`;
    crewSeen(key, now, slideFrame, () => crewPlan('illegal', i, key, w, h, kind));
  });
  for (const a of arsonsNow(now)) { const key = `arson:${a.i}:${a.born}`; crewSeen(key, now, slideFrame, () => crewPlan('arson', a.i, key, w, h, kind)); }
  crewSweep(now, slideFrame);
  for (const [key, s] of crewEntries()) {
    const ph = crewPhase(s, now, phase), walking = ph.walking && !REDUCED, u = REDUCED ? 0 : 1 - ph.t;
    const away = s.leaveAt >= 0 && now >= s.leaveAt, guard = key.startsWith('guard:');
    s.plan.forEach((m, k) => {
      const tx = m.tile % w, ty = (m.tile / w) | 0, fx = m.from[0] - tx, fy = m.from[1] - ty, d = drawList[n++] ??= { x: 0, y: 0, al: 1, a: null, xy: [0, 0] };
      d.x = pos[2 * m.tile] + m.ox + Math.round((fx - fy) * HW * u);
      d.y = pos[2 * m.tile + 1] + HH + m.oy + Math.round((fx + fy) * HH * u);
      const pose = walking ? 'walk' : guard ? guardPose(m.tile, now) : m.pose;
      const flip = walking ? (fx - fy > 0) !== away : m.flip; // walk in: face the spot; walk away: face the start point
      const frame = REDUCED ? 0 : Math.floor(now / (walking ? WALK_FRAME_MS : WORK_FRAME_MS) + crewHash(m.tile + k) * 2) % 2;
      d.spr = personSprite(pose, frame, m.pal, flip); d.al = ph.alpha; d.a = null;
    });
  }
  return n;
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
function specOf(key) {
  const arms = [];
  DIRS.forEach(([dx, dy], k) => { const v = (key >> 2 * k) & 3; if (v) arms.push([dx, dy, v - 1]); });
  return { arms, cs: (key >> 16) & 3, ws: (key >> 18) & 3 };
}
// Flow ripples: light dashes on the water pixels of a canal sprite that move toward DIRS[d]. RIP_F frames move them 1 period.
// The period (8 ground units) divides the tile size (16), so ripples line up across the tile joins.
const ripples = new Map(), RIP_F = 8, RIP_P = 8, RIPPLE = rgb(mix(WATER, WHITE, .45));
export function rippleSprite(key, o, d, f) {
  const id = canalId(key, o) * 64 + d * 8 + f;
  let c = ripples.get(id);
  if (c) return c;
  const spec = specOf(key), [ux, uy] = DIRS[d], n = Math.hypot(ux, uy), [ox, oy] = o < 0 ? [0, 0] : DIRS[o], fx = (ox - oy) * HW, fy = (ox + oy) * HH;
  c = sprite((g, x, y) => {
    g.fillStyle = RIPPLE;
    for (let r = fy; r < fy + TH; r++) for (let dx = fx - rowW(r - fy); dx < fx + rowW(r - fy); dx++) {
      if (canalZone(dx, r, spec) !== 3) continue;
      const a = r + .5 + (dx + .5) / 2, b = r + .5 - (dx + .5) / 2; // ground units, as in chan()
      const jit = hash(Math.floor((b * ux - a * uy) / 3) * 7 + d) * RIP_P; // cells across the flow get their own offset, so the ripples break into dashes
      if (((a * ux + b * uy - f * RIP_P / RIP_F - jit) % RIP_P + RIP_P) % RIP_P < n) g.fillRect(x + dx - fx, y + r - fy, 1, 1);
    }
  });
  ripples.set(id, c);
  return c;
}
export const canalId = (key, o = -1) => key + (o + 1) * (1 << 21);
export function canalSprite(key, o = -1) {
  const id = canalId(key, o);
  let c = canalSprites.get(id);
  if (c) return c;
  const spec = specOf(key), bed = rgb(spec.ws === 3 ? mix(MUD, DRY, .4) : MUD), bank = BANK_TOP[(key >> 24) & 3], edge = (key >> 20) & 1;
  const wall = rgb(mix(bank, BLACK, .25)); // the cut wall: a shade of its own bank, so a drained canal does not draw a black line
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
      g.fillStyle = zn === 1 ? wall : zn === 2 ? (v > .88 ? rgb(mix(MUD, WHITE, .35)) : bed)
        : canalZone(dx, r - 1, spec) !== 3 ? rgb(mix(WATER, WHITE, .3)) : v > .97 ? '#b4e8f8' : rgb(WATER);
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
export function resetSmoke() { litAt = null; smoke.length = 0; smokeHead = 0; smokeN = 0; nFire = 0; emitScale = 1; smokeSlot.clear(); }
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
    const snap = v => PUFF_CELL * Math.round(v / PUFF_CELL), half = (2 * r + 1) * PUFF_CELL / 2; // snap relative to the map origin, so the grid moves with a pan
    ctx.drawImage(cache.puff[r - PUFF_R0], originX + snap(p.x + p.vx * s - half), originY + snap(p.y + p.vy * s - half));
  }
  ctx.globalAlpha = 1;
}
// ---- scorched trees. Render-side only, like the fire age: the sim does not change.
// A large fire (SCORCH_N burning tiles or more within SCORCH_R tiles) scorches the trees within SCORCH_R tiles: no leaves, charred bark.
// The leaves come back in the wet season: buds for BUD_TICKS, then the full crown.
const SCORCH_R = 2, SCORCH_N = 3, BUD_TICKS = 16, NEVER = -1e9;
let scorchAt = null, wetSince = NEVER, wasWet = null;
// Pure. Marks the tiles near each large fire in at with the tick.
export function scorch(fire, w, h, at, tick) {
  const near = (i, f) => { const x0 = i % w, y0 = (i / w) | 0; for (let y = Math.max(0, y0 - SCORCH_R); y <= Math.min(h - 1, y0 + SCORCH_R); y++) for (let x = Math.max(0, x0 - SCORCH_R); x <= Math.min(w - 1, x0 + SCORCH_R); x++) f(y * w + x); };
  for (let i = 0; i < fire.length; i++) if (fire[i]) {
    let n = 0; near(i, k => { n += fire[k] ? 1 : 0; });
    if (n >= SCORCH_N) near(i, k => { at[k] = tick; });
  }
}
// Pure. 0: full leaves, 1: bare, 2: budding. at: the tick of the last scorch; wetFrom: the tick the wet season started (NEVER in the dry season).
export function treeState(at, tick, wetFrom) {
  if (at <= NEVER) return 0;
  if (wetFrom <= NEVER) return 1;
  const t = tick - Math.max(at, wetFrom);
  return t < 0 ? 1 : t < BUD_TICKS ? 2 : 0;
}
// The how-to slides draw their own game: clearTrack gives each demo a fresh start, keepTrack gives the level its scorch and fire age back after.
export function clearTrack() { scorchAt = null; litAt = null; }
export function keepTrack() { const s = { scorchAt, wetSince, wasWet, litAt, outAt, prevFire, trackTick }; return () => ({ scorchAt, wetSince, wasWet, litAt, outAt, prevFire, trackTick } = s); }
// Pure. At the start of the dry season: a tree with its full crown back (state 0) forgets its scorch, so the dry season does not make it bare again.
export function regrow(at, tick, wetFrom) { for (let i = 0; i < at.length; i++) if (at[i] > NEVER && treeState(at[i], tick, wetFrom) === 0) at[i] = NEVER; }
function trackScorch(game) {
  const { fire, w, h } = game.world, tick = game.tick ?? 0, wet = !!game.level && isWetSeason(game);
  if (!scorchAt || scorchAt.length !== fire.length || tick < trackTick) { scorchAt = new Int32Array(fire.length).fill(NEVER); wetSince = NEVER; wasWet = null; }
  if (wet !== wasWet) { if (wasWet) regrow(scorchAt, tick, wetSince); wetSince = wet && wasWet !== null ? tick : NEVER; wasWet = wet; } // a level that starts wet has no scorched trees yet
  scorch(fire, w, h, scorchAt, tick);
}
// ---- fire age. Render-side only: the tick each tile was lit, and the tick its fire went out. drawWorld updates it once for each tick.
const COOL_TICKS = 8; // a put-out tile shows ash and dull glow for 2 weeks
let litAt = null, outAt = null, prevFire = null, trackTick = -1;
function trackFire(fire, tick) {
  if (!litAt || litAt.length !== fire.length || tick < trackTick) {
    litAt = new Int32Array(fire.length).fill(tick); outAt = new Int32Array(fire.length).fill(-1e9); prevFire = Uint8Array.from(fire); trackTick = tick;
  }
  if (tick === trackTick) return;
  trackTick = tick;
  for (let i = 0; i < fire.length; i++) {
    const f = fire[i], p = prevFire[i];
    if (f === 1 && p !== 1) litAt[i] = tick;
    if (!f && p) outAt[i] = tick;
    prevFire[i] = f;
  }
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
  wind = yearDir(wd.seed, year); setFireCount(nFire); nFire = 0; trackScorch(game); trackFire(fire, game.tick ?? 0); // the fire count of the last frame sets the smoke rate
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { // water tiles stay flat, so a channel has no steps at the joins
    const i = y * w + x, [sx, sy] = tileToScreen(x, y, isWater(kind[i]) ? 0 : zMicro(w, h, z, x, y), view);
    pos[2 * i] = sx; pos[2 * i + 1] = sy;
  }
  originX = pos[0]; originY = pos[1];
  // Flow direction of each open canal tile (DIRS index), or -1 where a block stops the water at this tile or downstream.
  const flowDir = new Int8Array(w * h).fill(-1), rf = REDUCED ? 0 : Math.floor(now / 150) % RIP_F;
  if (!data) for (let i = 0; i < w * h; i++) {
    const n = flow[i];
    if (n < 0 || kind[i] !== KIND.CANAL || blk[i] !== BLOCK.NONE || blk[n] !== BLOCK.NONE) continue;
    const dx = n % w - i % w, dy = ((n / w) | 0) - ((i / w) | 0);
    flowDir[i] = DIRS.findIndex(([a, b]) => a === dx && b === dy);
  }
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
    if (k === KIND.CANAL && flowDir[i] >= 0) ctx.drawImage(rippleSprite(canalBase[i] | canalStep(cWater[i], cDepth[i]) << 18, -1, flowDir[i], rf), ax, ay);
    for (const [c, o] of patches.get(i) ?? []) { // a corner join crosses this tile: line up its channel pixels with the canal tile
      const [ox, oy] = DIRS[o], px = pos[2 * c] + (ox - oy) * HW - SW / 2, py = pos[2 * c + 1] + (ox + oy) * HH - HEAD, ck = canalBase[c] | canalStep(cWater[c], cDepth[c]) << 18;
      ctx.drawImage(canalSprite(ck, o), px, py);
      if (flowDir[c] >= 0) ctx.drawImage(rippleSprite(ck, o, flowDir[c], rf), px, py);
    }
    if (k === KIND.CANAL && game.ponds.has(i)) ctx.drawImage(cache.pond, ax, ay);
    const ov = cache.overlay[blk[i]];
    if (ov) ctx.drawImage(ov[axis[i]] ?? ov[0], ax, ay);
    const fv = Math.floor(hash(i + .71) * FLAME_VARIANTS);
    if (!fire[i] && (k === KIND.PEAT || k === KIND.FARM) && (game.tick ?? 0) - outAt[i] < COOL_TICKS) // put out lately: ash and dull glow
      ctx.drawImage(cache.cool[fv][REDUCED ? 0 : ((now / 700 + hash(i) * 2) | 0) % 2], ax, ay);
    const vs = vegSprite(game, i);
    if (vs) ctx.drawImage(vs, ax, ay);
    if (game.wells.has(i)) { ctx.fillStyle = '#2a2420'; ctx.fillRect(sx - 4, sy + 6, 8, 6); ctx.fillStyle = '#5ab4e0'; ctx.fillRect(sx - 2, sy + 8, 4, 2); }
    if (game.paluds.has(i)) { ctx.fillStyle = '#c8e070'; for (let r = 4; r < 14; r += 4) ctx.fillRect(sx - 8 + r % 8, sy + r, 2, 2), ctx.fillRect(sx + 4 - r % 8, sy + r, 2, 2); }
    if (game.fireGroups.has(i)) { ctx.fillStyle = '#d23a2a'; ctx.fillRect(sx + 12, sy - 8, 2, 12); ctx.fillRect(sx + 14, sy - 8, 6, 4); }
    if (fire[i] === 1) { // surface fire: size from its age, a variant and a phase for each tile
      nFire++; ctx.drawImage(cache.flame[fireSize((game.tick ?? 0) - litAt[i])][fv][REDUCED ? 0 : ((now / 120 + hash(i) * 4) | 0) % FLAME_FRAMES], ax, ay); emitSmoke(i, sx, sy + HH, 1, now);
    } else if (fire[i] === 2) { // smouldering peat: the whole tile glows, and thin smoke
      nFire++; ctx.drawImage(cache.ember[fv][REDUCED ? 0 : ((now / 400 + hash(i) * 2) | 0) % 2], ax, ay); emitSmoke(i, sx, sy + HH, 2, now);
    }
    if (jobs.has(i)) { ctx.fillStyle = '#efe6cf'; ctx.fillRect(sx - 1, sy - 10, 2, 16); ctx.fillStyle = '#e8b04a'; ctx.fillRect(sx + 1, sy - 10, 8, 4); } // work flag
  }
  const dbg = globalThis.rewet; // ?debug only
  if (!data) { // animals: their own pass, sorted by drawn y, so a slide keeps the depth order. The feet are at the tile centre.
    // After each animal, the plants of its tile and of the tiles in front of it draw again over it: a forest hides its wildlife.
    // Trade-off: those plants also draw over the small markers (work flag, well) of their own tiles.
    slideFrame++; if (dbg) dbg.slides = slides;
    const fauna = game.fauna ?? []; let n = 0;
    for (const a of fauna) {
      const from = a.from ?? a.i;
      const s = slideState(a, game.tick, now, w, h, slideFrame);
      const d = drawList[n] ??= { x: 0, y: 0, al: 1, a: null, xy: [0, 0] };
      pa[0] = pos[2 * from]; pa[1] = pos[2 * from + 1]; pb[0] = pos[2 * a.i]; pb[1] = pos[2 * a.i + 1];
      slidePos(pa, pb, clamp01((now - s.seenAt) / SLIDE_MS), d.xy);
      d.x = Math.round(d.xy[0]); d.y = Math.round(d.xy[1]) + HH + 3; d.a = a; d.spr = null; d.al = fadeAlpha(now - s.shownAt, s.leaveAt < 0 ? -1 : now - s.leaveAt);
      n++;
    }
    if (slides.size > n) for (const [id, s] of slides) if (s.f !== slideFrame) slides.delete(id);
    n = addCrews(game, now, w, h, kind, pos, n);
    drawList.length = n; drawList.sort((p, q) => p.y - q.y);
    for (const d of drawList) {
      if (d.spr) { // a crew person: not tappable
        if (d.al <= 0) continue;
        if (d.al < 1) ctx.globalAlpha = d.al;
        ctx.drawImage(d.spr, d.x - PS / 2, d.y - PS);
        ctx.globalAlpha = 1;
        continue;
      }
      const a = d.a, up = Math.sin(now / 700 + hash(a.id) * 6.28) > .7 ? 1 : 0; // 1 px idle step, slow
      if (d.al < 1) ctx.globalAlpha = d.al;
      ctx.drawImage(animalSprite(a.species), d.x - AS / 2, d.y - AS - up);
      ctx.globalAlpha = 1;
      for (const t of frontTiles(w, h, a.i)) { const vs = vegSprite(game, t); if (vs) ctx.drawImage(vs, pos[2 * t] - SW / 2, pos[2 * t + 1] - HEAD); }
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
  drawFx(ctx, game, pos, shown, hover, data, bw, bh, now, game.bankWeek == null); // the intro story sets bankWeek: no tick diffs there
  return hits;
}
