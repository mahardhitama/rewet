import { createWorld, KIND, BLOCK, WET_WT, idx, mulberry32 } from './world.js';
import { generateTerrain } from './terrain.js';
import { DRAIN, computeStrength, computeDistance, walkUp } from './drainage.js';
import { seasonAt, TICKS_PER_YEAR, year, elNino, dryStart, isWetSeason } from './season.js';
export { isWetSeason };
import { hydroTick, canalTick, canalTarget } from './hydro.js';
import { ignite, fireTick } from './fire.js';
import { BRANCH } from './mapgen.js';
import { faunaTick, FAUNA_SALT } from './fauna.js';

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
const plantable = (wd, g) => (j) => wd.kind[j] === KIND.PEAT && !g.seedlings.has(j) && wd.cover[j] < 1;

export const PLANT_TILE = 8; // price of one seedling tile in funds, game value, NOT SOURCED
export const PLANT_R = 2; // stamp radius: 2 gives a 5x5 patch, game value, NOT SOURCED
export const plantWeeks = (n) => Math.max(1, Math.ceil(n / 10)); // 10 tiles per crew-week, game value, NOT SOURCED
const SEEDLING_GROWTH = 1 / 312; // cover gained per tick in the band, game value, NOT SOURCED
export const SEEDLING_DEATH = 48; // stress at which a seedling dies, game value, NOT SOURCED
const NURSE = { growth: 2, dry: 0.5 }; // a seedling beside cover >= 0.6 (canopy shade), game values, NOT SOURCED

// Stress per tick out of the band. Flood: 4 (death in 3 weeks). Dry: 1 per tick up to 0.5 m, then 10 per m of depth
// (0.6 m: 6 weeks, 0.8 m: 3 weeks); a nurse tree halves dry stress. Game values, NOT SOURCED.
export const seedlingStress = (wt, nurse = false) =>
  inBand(wt) ? 0 : wt < 0 ? SEEDLING_DEATH / 12 : Math.max(1, (wt - WET_WT) * 10) * (nurse ? NURSE.dry : 1);

// Seedlings grow in the band and gain stress out of it. One tick in the band clears the stress.
export function growSeedlings(g) {
  const wd = g.world, { wt, cover } = wd;
  for (const [i, s] of g.seedlings) {
    const nurse = nextTo(wd, i, (k) => cover[k] >= 0.6);
    if (inBand(wt[i])) { cover[i] = Math.min(1, cover[i] + SEEDLING_GROWTH * (nurse ? NURSE.growth : 1)); g.seedlings.set(i, 0); }
    else if (s + seedlingStress(wt[i], nurse) >= SEEDLING_DEATH) { cover[i] = 0; g.seedlings.delete(i); }
    else g.seedlings.set(i, s + seedlingStress(wt[i], nurse));
    if (cover[i] >= 1) g.seedlings.delete(i);
  }
}

// Plantable tiles in the stamp, nearest first. A tile that an open plant job will seed does not count.
export function plantTiles(g, i) {
  const wd = g.world, { w, h } = wd, x = i % w, y = (i / w) | 0, can = plantable(wd, g), taken = new Set();
  for (const j of g.jobs) if (j.id === 'plant') for (const t of j.tiles) taken.add(t);
  const out = [];
  for (let yy = Math.max(0, y - PLANT_R); yy <= Math.min(h - 1, y + PLANT_R); yy++)
    for (let xx = Math.max(0, x - PLANT_R); xx <= Math.min(w - 1, x + PLANT_R); xx++) {
      const j = yy * w + xx;
      if (can(j) && !taken.has(j)) out.push([Math.max(Math.abs(xx - x), Math.abs(yy - y)), j]);
    }
  return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((e) => e[1]);
}

export const ACTIONS = {
  tempBlock: { cost: 100, weeks: 1, r: 'rewet', valid: (wd, i) => ok(isCanal(wd, i) && wd.block[i] === BLOCK.NONE) },
  permBlock: { cost: 250, weeks: 3, r: 'rewet', valid: (wd, i) => ok(isCanal(wd, i) && wd.block[i] === BLOCK.TEMP) },
  backfill: { cost: 600, weeks: 6, r: 'rewet', valid: (wd, i) => ok(isCanal(wd, i)) },
  well: { cost: 80, weeks: 1, r: 'defense', valid: (_wd, i, g) => ok(!g.wells.has(i)) },
  plant: { cost: PLANT_TILE, weeks: 1, r: 'reveg', valid: (wd, i, g) => (wd.kind[i] !== KIND.PEAT ? 'invalid' : plantTiles(g, i).length > 0 || 'nothingToPlant') }, // cost is per tile, weeks is the minimum
  mound: { cost: 50, weeks: 1, r: 'reveg', valid: (wd, i, g) => (g.mounds.has(i) ? 'mounded' : ok(wd.kind[i] === KIND.PEAT)) }, // one per tile
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
  generateTerrain(d, { ...level.terrain, microAmp: 0 });
  return d.z;
}

export function placeLevel(level) {
  const world = createWorld({ w: level.size, h: level.size, seed: level.seed });
  generateTerrain(world, level.terrain);
  const dome = level.canalZ ? null : domeZ(level);
  const set = (list, k) => { for (const [x, y] of list || []) world.kind[idx(world.w, x, y)] = k; };
  set(level.rivers, KIND.RIVER); set(level.villages, KIND.VILLAGE); set(level.farms, KIND.FARM); set(level.canals, KIND.CANAL);
  (level.canals || []).forEach(([x, y], k) => {
    const i = idx(world.w, x, y);
    world.z[i] = dome ? dome[i] : level.canalZ[k]; // monotone canal bed (R8)
    if (level.canalW) { world.cWidth[i] = level.canalW[k]; world.cDepth[i] = level.canalD[k]; }
  });
  const S = computeStrength(world);
  computeDistance(world, S);
  for (let i = 0; i < world.n; i++) world.cWater[i] = canalTarget(world, S, i, 1); // buildLevelWorld ends in the dry season
  return world;
}

const redrain = (g) => { g.S = computeStrength(g.world); computeDistance(g.world, g.S); };
const crewFree = (g) => (t) => t <= g.tick;
export const freeCrews = (g) => g.crews.filter(crewFree(g)).length;
const randWind = (rng) => N8[Math.floor(rng() * 8)];

export function createGame(level, upgrades = {}, world = placeLevel(level)) {
  const S = computeStrength(world);
  computeDistance(world, S);
  const g = {
    world, level, upgrades, tick: 0, funds: level.grant,
    crews: new Array(3 + (upgrades.crew || 0)).fill(0), jobs: [], goodwill: 50, burnt: new Set(),
    dryWtHistory: [], wind: randWind(world.rng), events: [], S,
    wt0: Float32Array.from(world.wt), cover0: Float32Array.from(world.cover), wetTicks: new Uint16Array(world.n),
    wells: new Set(), mounds: new Set(), seedlings: new Map(), planted: new Map(), paluds: new Set(), ponds: new Set(), fireGroups: new Set(), // planted: tile -> tick it was last seeded
    fauna: [], seen: new Set(), faunaRng: mulberry32(world.seed ^ FAUNA_SALT), faunaNext: 0, // wildlife (fauna.js): display only, no effect on the sim
    dome: null, // lazy domeZ(level), for illegal-canal beds
    illegal: (level.illegalCanals || []).map(() => 0), // next path index per illegal canal; -1 = stopped
  };
  if (level.elNinoYear === 1) g.events.push({ type: 'elNinoWarning', year: 1 });
  return g;
}

export function costOf(g, id) {
  let c = ACTIONS[id].cost;
  if (isWetSeason(g)) c *= 0.8;
  if (id === 'plant') return Math.round(c * 10) / 10; // price per tile, 1 decimal
  if (g.upgrades.cheapBlocks && BLOCKS.has(id)) c *= 0.75;
  return Math.round(c);
}

export function applyAction(g, id, i) {
  const a = ACTIONS[id];
  if (!a || i < 0 || i >= g.world.n) return { ok: false, reason: 'invalid' };
  const v = a.valid(g.world, i, g);
  if (v !== true) return { ok: false, reason: v };
  const k = g.jobs.findIndex((j) => j.i === i);
  if (k >= 0 && id === 'fireCrew' && g.jobs[k].id !== 'fireCrew') { // the fire ends the build job here (funds not refunded)
    g.crews[g.jobs[k].crew] = g.tick;
    g.jobs.splice(k, 1);
  } else if (k >= 0) return { ok: false, reason: 'busy' };
  const crew = g.crews.findIndex(crewFree(g));
  if (crew < 0) return { ok: false, reason: 'crew' };
  let cost = costOf(g, id), weeks = a.weeks, tiles;
  if (id === 'plant') { // the stamp shrinks to the nearest tiles the funds can pay
    const all = plantTiles(g, i), n = Math.min(all.length, Math.floor(g.funds / cost + 1e-9));
    if (n === 0) return { ok: false, reason: 'funds' };
    tiles = all.slice(0, n); weeks = plantWeeks(n); cost = Math.round(n * cost);
  }
  if (cost > g.funds) return { ok: false, reason: 'funds' };
  g.funds -= cost;
  const doneAt = g.tick + weeks * TPW;
  g.crews[crew] = doneAt;
  g.jobs.push(tiles ? { id, i, doneAt, crew, tiles, weeks } : { id, i, doneAt, crew });
  return { ok: true };
}

function finish(g, { id, i, tiles }) {
  const wd = g.world;
  if (id === 'tempBlock') { wd.block[i] = BLOCK.TEMP; redrain(g); }
  else if (id === 'permBlock') { wd.block[i] = BLOCK.PERM; redrain(g); }
  else if (id === 'backfill') { wd.block[i] = BLOCK.FILLED; wd.kind[i] = KIND.PEAT; wd.cWidth[i] = wd.cDepth[i] = wd.cWater[i] = 0; redrain(g); }
  else if (id === 'well') g.wells.add(i);
  else if (id === 'plant') { // the paid tiles of the 5x5 stamp (R27); eligibility checked now, not at order time (R32)
    const can = plantable(wd, g);
    for (const j of tiles) if (can(j)) { g.seedlings.set(j, 0); g.planted.set(j, g.tick); }
  }
  else if (id === 'mound') { g.mounds.add(i); wd.z[i] += 0.2; wd.wt[i] = Math.min(WT_MAX, Math.max(WT_MIN, wd.wt[i] + 0.2)); } // head z - wt unchanged
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
  canalTick(wd, g.S, env);
  for (let i = 0; i < n; i++) if (wt[i] <= WET_WT) g.wetTicks[i]++;
  if (dry && g.tick % TPW === 0) {
    if (env.week === dryStart(g)) g.dryWtHistory = [];
    g.dryWtHistory.push(Float32Array.from(wt));
  }

  // 4. fire; a crew fights every burning tile in the 3x3 square around its fire (once per tile, even where crews overlap):
  // timers are capped every tick (also after a re-light), put out at <= 1, 2x with a well within 3 tiles
  const fought = new Set();
  for (const j of g.jobs) {
    if (j.id === 'fireCrew' && fire[j.i]) near(wd, j.i, 1, (k) => { if (fire[k]) fought.add(k); return false; });
  }
  for (const k of fought) {
    fireT[k] = Math.min(fireT[k], crewCap(g, fire[k]));
    if (fireT[k] > 1 && near(wd, k, 3, (m) => g.wells.has(m))) fireT[k]--;
    if (fireT[k] <= 1) { fire[k] = 0; fireT[k] = 0; }
  }
  // when a crew's own fire is out, every fire in its 3x3 square goes out with it
  for (const j of g.jobs) {
    if (j.id === 'fireCrew' && !fire[j.i]) near(wd, j.i, 1, (k) => { fire[k] = 0; fireT[k] = 0; return false; });
  }
  const { burnt } = fireTick(wd, env, g.wind);
  for (const i of burnt) onLit(g, i);
  if (g.tick % 4 === 0) faunaTick(g);

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
    const dug = [];
    g.illegal.forEach((p, c) => {
      const path = g.level.illegalCanals[c];
      if (p < 0 || p >= path.length) return;
      const i = idx(wd.w, path[p][0], path[p][1]);
      if (wd.block[i] !== BLOCK.NONE || kind[i] === KIND.VILLAGE || kind[i] === KIND.RIVER) { g.illegal[c] = -1; return; }
      if (kind[i] !== KIND.CANAL) {
        kind[i] = KIND.CANAL; fire[i] = fireT[i] = 0; wd.z[i] = Math.min(wd.z[i], (g.dome ??= domeZ(g.level))[i]);
        wd.cWidth[i] = BRANCH.w; wd.cDepth[i] = BRANCH.d;
        dug.push(i);
      }
      g.illegal[c] = p + 1;
    });
    if (dug.length) {
      redrain(g);
      for (const i of dug) wd.cWater[i] = canalTarget(wd, g.S, i, env.dry);
    }
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
  growSeedlings(g);
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

// After the debrief, the player can look at the map. Water, seasons and wildlife go on; jobs, fire, growth, threats and money stop,
// so the site stays as the player left it.
export function scenicStep(g) {
  const wd = g.world, env = seasonAt(g.tick, { elNino: elNino(g) });
  wd.fire.fill(0); wd.fireT.fill(0);
  hydroTick(wd, g.S, env);
  canalTick(wd, g.S, env);
  if (g.tick % 4 === 0) faunaTick(g);
  g.tick++;
}
