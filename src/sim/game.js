import { createWorld, KIND, BLOCK, WET_WT, idx } from './world.js';
import { generateTerrain } from './terrain.js';
import { DRAIN, computeStrength, computeDistance, walkUp } from './drainage.js';
import { seasonAt, TICKS_PER_YEAR } from './season.js';
import { hydroTick } from './hydro.js';
import { ignite, fireTick } from './fire.js';

const TPW = 4; // ticks per week
const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const CREW_TICKS = [0, 1, 8]; // crewed fire: surface 2 days, smoulder 2 weeks (spec section 3)
const BLOCKS = new Set(['tempBlock', 'permBlock', 'backfill']);

const near = (world, i, r, test) => {
  const { w, h } = world, x = i % w, y = (i / w) | 0;
  for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy++)
    for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx++) if (test(yy * w + xx)) return true;
  return false;
};
const nextTo = (world, i, test) => near(world, i, 1, (j) => j !== i && test(j));
const ok = (cond) => cond || 'invalid';
const isCanal = (wd, i) => wd.kind[i] === KIND.CANAL;

export const ACTIONS = {
  tempBlock: { cost: 100, weeks: 1, r: 'rewet', valid: (wd, i) => ok(isCanal(wd, i) && wd.block[i] === BLOCK.NONE) },
  permBlock: { cost: 250, weeks: 3, r: 'rewet', valid: (wd, i) => ok(isCanal(wd, i) && wd.block[i] === BLOCK.TEMP) },
  backfill: { cost: 600, weeks: 6, r: 'rewet', valid: (wd, i) => ok(isCanal(wd, i)) },
  well: { cost: 80, weeks: 1, r: 'defense', valid: (_wd, i, g) => ok(!g.wells.has(i)) },
  plant: { cost: 60, weeks: 1, r: 'reveg', valid: (wd, i, g) => ok(wd.kind[i] === KIND.PEAT && !g.seedlings.has(i)) },
  mound: { cost: 50, weeks: 1, r: 'reveg', valid: (wd, i) => ok(wd.kind[i] === KIND.PEAT) },
  palud: {
    cost: 200, weeks: 2, r: 'revit',
    valid: (wd, i, g) => ok(wd.kind[i] === KIND.PEAT && wd.wt[i] <= WET_WT && !g.paluds.has(i) &&
      nextTo(wd, i, (j) => wd.kind[j] === KIND.VILLAGE)),
  },
  // behind a block = canal tile whose strength a downstream block has lowered
  pond: { cost: 200, weeks: 2, r: 'revit', valid: (wd, i, g) => ok(isCanal(wd, i) && wd.block[i] === BLOCK.NONE && g.S[i] < DRAIN.canal && !g.ponds.has(i)) },
  fireGroup: { cost: 250, weeks: 2, r: 'revit', valid: (wd, i, g) => ok(wd.kind[i] === KIND.VILLAGE && !g.fireGroups.has(i)) },
  fireCrew: { cost: 0, weeks: Infinity, r: 'defense', valid: (wd, i) => ok(wd.fire[i] > 0) },
};

function domeZ(level) {
  const d = createWorld({ w: level.size, h: level.size, seed: level.seed });
  generateTerrain(d, { microAmp: 0 });
  return d.z;
}

export function placeLevel(level) {
  const world = createWorld({ w: level.size, h: level.size, seed: level.seed });
  generateTerrain(world);
  const dome = domeZ(level);
  const set = (list, k) => { for (const [x, y] of list || []) world.kind[idx(world.w, x, y)] = k; };
  set(level.rivers, KIND.RIVER); set(level.villages, KIND.VILLAGE); set(level.farms, KIND.FARM); set(level.canals, KIND.CANAL);
  for (const [x, y] of level.canals || []) { const i = idx(world.w, x, y); world.z[i] = dome[i]; } // monotone canal bed (R8)
  computeDistance(world, computeStrength(world));
  return world;
}

const redrain = (g) => { g.S = computeStrength(g.world); computeDistance(g.world, g.S); };
const year = (g) => Math.floor(g.tick / TICKS_PER_YEAR);
const elNino = (g) => g.level.elNinoYear != null && year(g) === g.level.elNinoYear;
const dryStart = (g) => (elNino(g) ? 21 : 31);
const randWind = (rng) => N8[Math.floor(rng() * 8)];

export function createGame(level, upgrades = {}, world = placeLevel(level)) {
  const S = computeStrength(world);
  computeDistance(world, S);
  const g = {
    world, level, upgrades, tick: 0, funds: level.grant,
    crews: new Array(3 + (upgrades.crew || 0)).fill(0), jobs: [], goodwill: 50, burnt: new Set(),
    dryWtHistory: [], wind: randWind(world.rng), events: [], S,
    wt0: Float32Array.from(world.wt), wetTicks: new Uint16Array(world.n),
    wells: new Set(), seedlings: new Map(), paluds: new Set(), ponds: new Set(), fireGroups: new Set(),
    dome: null, // lazy domeZ(level), for illegal-canal beds
    illegal: (level.illegalCanals || []).map(() => 0), // next path index per illegal canal; -1 = stopped
  };
  if (level.elNinoYear === 1) g.events.push({ type: 'elNinoWarning', year: 1 });
  return g;
}

export function costOf(g, id) {
  let c = ACTIONS[id].cost;
  if (seasonAt(g.tick).week < dryStart(g)) c *= 0.8;
  if (g.upgrades.cheapBlocks && BLOCKS.has(id)) c *= 0.75;
  return Math.round(c);
}

export function applyAction(g, id, i) {
  const a = ACTIONS[id];
  if (!a || i < 0 || i >= g.world.n || a.valid(g.world, i, g) !== true) return { ok: false, reason: 'invalid' };
  if (g.jobs.some((j) => j.i === i)) return { ok: false, reason: 'busy' };
  const crew = g.crews.findIndex((t) => t <= g.tick);
  if (crew < 0) return { ok: false, reason: 'crew' };
  const cost = costOf(g, id);
  if (cost > g.funds) return { ok: false, reason: 'funds' };
  g.funds -= cost;
  const doneAt = g.tick + a.weeks * TPW;
  g.crews[crew] = doneAt;
  g.jobs.push({ id, i, doneAt, crew });
  return { ok: true };
}

function finish(g, { id, i }) {
  const wd = g.world;
  if (id === 'tempBlock') { wd.block[i] = BLOCK.TEMP; redrain(g); }
  else if (id === 'permBlock') { wd.block[i] = BLOCK.PERM; redrain(g); }
  else if (id === 'backfill') { wd.block[i] = BLOCK.FILLED; wd.kind[i] = KIND.PEAT; redrain(g); }
  else if (id === 'well') g.wells.add(i);
  else if (id === 'plant') g.seedlings.set(i, 0);
  else if (id === 'mound') { wd.z[i] += 0.2; wd.wt[i] = Math.min(WT_MAX, Math.max(WT_MIN, wd.wt[i] + 0.2)); } // head z - wt unchanged
  else if (id === 'palud') g.paluds.add(i);
  else if (id === 'pond') g.ponds.add(i);
  else if (id === 'fireGroup') g.fireGroups.add(i);
}

const WT_MIN = -0.3, WT_MAX = 1.5; // hydro.js clamp
const crewCap = (g, f) => (g.upgrades.fastCrew ? Math.ceil(CREW_TICKS[f] * 0.7) : CREW_TICKS[f]);

function onLit(g, i) {
  const wd = g.world;
  g.burnt.add(i);
  g.seedlings.delete(i);
  if (near(wd, i, 6, (k) => g.fireGroups.has(k))) g.events.push({ type: 'fireSpotted', i });
  if (nextTo(wd, i, (k) => wd.kind[k] === KIND.VILLAGE)) {
    g.goodwill = Math.max(0, g.goodwill - 10);
    g.events.push({ type: 'villageFire', i });
  }
}

const inBand = (wt) => wt >= 0 && wt <= WET_WT;

export function step(g) {
  const wd = g.world, { n, wt, fire, fireT, rng, kind, cover } = wd;
  // 1. season, wind
  const env = seasonAt(g.tick, { elNino: elNino(g) });
  const dry = env.week >= dryStart(g);
  if (g.tick > 0 && g.tick % (4 * TPW) === 0) g.wind = randWind(rng);

  // 2. jobs (fire crews finish when their fire is out)
  g.jobs = g.jobs.filter((j) => {
    const done = j.id === 'fireCrew' ? fire[j.i] === 0 : j.doneAt <= g.tick + 1; // done during the tick that ends at doneAt
    if (!done) return true;
    if (j.id === 'fireCrew') g.crews[j.crew] = g.tick;
    finish(g, j);
    return false;
  });

  // 3. hydrology
  hydroTick(wd, g.S, env);
  for (let i = 0; i < n; i++) if (wt[i] <= WET_WT) g.wetTicks[i]++;
  if (dry && g.tick % TPW === 0) {
    if (env.week === dryStart(g)) g.dryWtHistory = [];
    g.dryWtHistory.push(Float32Array.from(wt));
  }

  // 4. fire; crewed timers are capped every tick (also after a re-light), put out at <= 1, 2x with a well within 3 tiles
  for (const j of g.jobs) {
    if (j.id !== 'fireCrew' || !fire[j.i]) continue;
    fireT[j.i] = Math.min(fireT[j.i], crewCap(g, fire[j.i]));
    if (fireT[j.i] > 1 && near(wd, j.i, 3, (k) => g.wells.has(k))) fireT[j.i]--;
    if (fireT[j.i] <= 1) { fire[j.i] = 0; fireT[j.i] = 0; }
  }
  const { burnt } = fireTick(wd, env, g.wind);
  for (const i of burnt) onLit(g, i);

  // 5. threats
  if (dry && rng() < (g.level.arson * (1 - g.goodwill / 100)) / 147) {
    const i = Math.floor(rng() * n);
    if (!near(wd, i, 6, (k) => g.fireGroups.has(k)) || rng() < 0.5) {
      const lit = ignite(wd, i);
      if (lit) onLit(g, i);
      g.events.push({ type: 'arson', i, lit });
    }
  }
  if (g.tick % 8 === 7) {
    let changed = false;
    g.illegal.forEach((p, c) => {
      const path = g.level.illegalCanals[c];
      if (p < 0 || p >= path.length) return;
      const i = idx(wd.w, path[p][0], path[p][1]);
      if (wd.block[i] !== BLOCK.NONE || kind[i] === KIND.VILLAGE || kind[i] === KIND.RIVER) { g.illegal[c] = -1; return; }
      if (kind[i] !== KIND.CANAL) { kind[i] = KIND.CANAL; wd.z[i] = Math.min(wd.z[i], (g.dome ??= domeZ(g.level))[i]); changed = true; }
      g.illegal[c] = p + 1;
    });
    if (changed) redrain(g);
  }
  if (!dry && g.tick % TPW === 0) {
    let washed = false;
    for (let i = 0; i < n; i++) {
      if (wd.block[i] !== BLOCK.TEMP || !walkUp(wd, i, DRAIN.maxHeadTiles + 1, () => {}).length) continue;
      if (rng() < 0.02) { wd.block[i] = BLOCK.NONE; washed = true; g.events.push({ type: 'washout', i }); }
    }
    if (washed) redrain(g);
  }

  // 6. growth: seedlings, then natural regrowth beside cover >= 0.6
  for (const [i, bad] of g.seedlings) {
    if (inBand(wt[i])) { cover[i] = Math.min(1, cover[i] + 1 / 416); g.seedlings.set(i, 0); }
    else if (bad + 1 >= 12) { cover[i] = 0; g.seedlings.delete(i); }
    else g.seedlings.set(i, bad + 1);
    if (cover[i] >= 1) g.seedlings.delete(i);
  }
  for (let i = 0; i < n; i++) {
    if (kind[i] === KIND.PEAT && !fire[i] && cover[i] < 1 && inBand(wt[i]) && nextTo(wd, i, (k) => cover[k] >= 0.6))
      cover[i] = Math.min(1, cover[i] + 1 / 1248);
  }

  // 7. year end
  g.tick++;
  if (g.tick % TICKS_PER_YEAR === 0) {
    const y = year(g);
    g.funds += g.level.grant;
    for (const i of g.paluds) if (wt[i] <= WET_WT) g.funds += 40;
    g.goodwill = Math.min(100, g.goodwill + 5 * (g.paluds.size + g.ponds.size));
    g.events.push({ type: 'yearEnd', year: y - 1 });
    if (g.level.elNinoYear != null && y + 1 === g.level.elNinoYear) g.events.push({ type: 'elNinoWarning', year: g.level.elNinoYear });
  }
}
