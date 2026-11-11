// Render-only intro story: a generated map that changes from degraded to restored over story time h in [0, 1].
// All values here are game art, NOT real-world values.
import { LEVELS, buildLevelWorld } from '../levels.js';
import { resolveLevel } from '../sim/mapgen.js';
import { computeStrength } from '../sim/drainage.js';
import { FAUNA } from '../sim/fauna.js';
import { KIND, BLOCK, mulberry32 } from '../sim/world.js';
import { downstream } from './iso.js';

export const INTRO_LEVEL = (seed) => ({ ...LEVELS[5], size: 15, seed, sandbox: true });

const hash = (i) => {
  let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const MAX_ANIMALS = 6, PER_SPECIES = 2, WATER_SPAN = 0.25, COVER_LAG = 0.1;
// Story order in h: dams 0.04-0.24, canals fill by 0.44, peat wet by 0.69, towers 0.5-0.65, lush by 0.79, wildlife from 0.8.
const DAM_GAP = 4, DAM_H0 = 0.04, DAM_SPAN = 0.2, FILL_SPAN = 0.2, SHALLOW = 0.7, AT_MAX = 0.44, TOWER_H0 = 0.5, TOWER_SPAN = 0.15;

export function buildStory(seed) {
  const world = buildLevelWorld(resolveLevel(INTRO_LEVEL(seed)));
  const { n, w, h, kind, wt, cover, z, cDepth, cWater } = world;
  const game = { world, S: computeStrength(world), tick: 0, jobs: [], fauna: [], ponds: new Set(), seedlings: new Set(), wells: new Set(), paluds: new Set(), fireGroups: new Set() };
  const start = { wt: wt.slice(), cover: cover.slice(), cWater: cWater.slice() }, end = { wt: wt.slice(), cover: cover.slice(), cWater: cWater.slice() };
  const at = new Float32Array(n), cAt = new Float32Array(n).fill(2), fire0 = new Uint8Array(n), blockAt = new Float32Array(n).fill(2);
  let firstPeat = -1;
  for (let i = 0; i < n; i++) {
    if (kind[i] !== KIND.PEAT) continue;
    firstPeat = firstPeat < 0 ? i : firstPeat;
    start.wt[i] = Math.max(wt[i], 0.6); start.cover[i] = cover[i] * 0.15;
    end.wt[i] = Math.min(wt[i], 0.15); end.cover[i] = Math.max(cover[i], 0.6 + 0.4 * hash(i + 7));
    if (hash(i) < 0.03) fire0[i] = hash(i + 5) < 0.4 ? 2 : 1;
  }
  if (firstPeat >= 0 && !fire0.some(Boolean)) fire0[firstPeat] = 1;
  // Dams: a cascade along the flow that the ripples show. A dam on the outlet tile, then one each DAM_GAP canal tiles upstream.
  // Each canal tile fills after the first dam downstream of it (hold), from shallow water to the bank.
  const down = downstream(w, h, z, kind), up = new Int32Array(n), hold = new Int32Array(n).fill(-1), dams = [];
  const canals = [];
  for (let i = 0; i < n; i++) if (kind[i] === KIND.CANAL) canals.push(i);
  canals.sort((a, b) => z[a] - z[b]); // a downstream tile has a lower z, so it comes first
  for (const i of canals) {
    const d = down[i], onCanal = d >= 0 && kind[d] === KIND.CANAL;
    up[i] = onCanal ? up[d] + 1 : 0;
    if (up[i] % DAM_GAP === 0) { hold[i] = i; dams.push(i); } else hold[i] = hold[d];
    start.cWater[i] = SHALLOW; end.cWater[i] = 0; // cWater is depth below the bank: 0 is a full canal
  }
  dams.sort((a, b) => (z[b] - cDepth[b]) - (z[a] - cDepth[a])); // higher bed first
  dams.forEach((i, r) => { blockAt[i] = DAM_H0 + DAM_SPAN * (dams.length > 1 ? r / (dams.length - 1) : 0); });
  // water order: near the blocks first. Multi-source BFS (8 neighbours) gives the tile distance to the nearest dam.
  const dist = new Int32Array(n).fill(-1), queue = new Int32Array(n);
  let qh = 0, qt = 0, maxDist = 0;
  for (let i = 0; i < n; i++) if (blockAt[i] < 2) { dist[i] = 0; queue[qt++] = i; }
  while (qh < qt) {
    const i = queue[qh++], x = i % w, y = (i / w) | 0;
    for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++)
      for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) {
        const j = yy * w + xx;
        if (dist[j] < 0) { dist[j] = dist[i] + 1; maxDist = Math.max(maxDist, dist[j]); queue[qt++] = j; }
      }
  }
  for (let i = 0; i < n; i++) {
    at[i] = Math.min(AT_MAX, 0.15 + 0.2 * (maxDist && dist[i] > 0 ? dist[i] / maxDist : 0) + 0.1 * hash(i + 11));
    if (kind[i] === KIND.CANAL) cAt[i] = blockAt[hold[i]];
  }
  // Watch towers (fire groups): one in each village, after the canals fill and before the map is lush.
  const towers = [], seen = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (kind[i] !== KIND.VILLAGE || seen[i]) continue;
    towers.push(i); seen[i] = 1;
    const stack = [i];
    while (stack.length) {
      const j = stack.pop(), x = j % w, y = (j / w) | 0;
      for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++)
        for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) { const k = yy * w + xx; if (kind[k] === KIND.VILLAGE && !seen[k]) { seen[k] = 1; stack.push(k); } }
    }
  }
  const story = { game, start, end, at, cAt, fire0, blockAt, towers, animals: [] };
  // animals: test each rule on the end state, then return to the start state
  storyAt(story, 1);
  const rng = mulberry32(seed + 1), pool = [];
  for (const f of FAUNA) {
    const ok = [];
    for (let i = 0; i < n; i++) if (f.rule(game, i)) ok.push(i);
    for (let k = 0; k < PER_SPECIES && ok.length; k++) pool.push({ species: f.id, i: ok.splice(Math.floor(rng() * ok.length), 1)[0] });
  }
  for (let k = pool.length - 1; k > 0; k--) { const j = Math.floor(rng() * (k + 1)); [pool[k], pool[j]] = [pool[j], pool[k]]; }
  story.animals = pool.slice(0, MAX_ANIMALS).map((a, k) => ({ id: k + 1, species: a.species, i: a.i, born: 0 }));
  storyAt(story, 0);
  return story;
}

export function storyAt(story, h) {
  h = clamp01(h);
  const { world: wd } = story.game, { start, end, at, cAt, fire0, blockAt } = story;
  for (let i = 0; i < wd.n; i++) {
    const tw = clamp01((h - at[i]) / WATER_SPAN), tc = clamp01((h - at[i] - COVER_LAG) / WATER_SPAN);
    wd.wt[i] = start.wt[i] + (end.wt[i] - start.wt[i]) * tw;
    wd.cover[i] = start.cover[i] + (end.cover[i] - start.cover[i]) * tc;
    wd.cWater[i] = start.cWater[i] + (end.cWater[i] - start.cWater[i]) * clamp01((h - cAt[i]) / FILL_SPAN);
    wd.fire[i] = h < at[i] ? fire0[i] : 0;
    wd.block[i] = h >= blockAt[i] ? BLOCK.PERM : BLOCK.NONE;
  }
  story.game.bankWeek = Math.round(h * 20); // the story peat changes with h: this gives 20 canal bank updates
  const t = story.towers.filter((_, k) => h >= TOWER_H0 + TOWER_SPAN * (story.towers.length > 1 ? k / (story.towers.length - 1) : 0)).length;
  if (story.game.fireGroups.size !== t) story.game.fireGroups = new Set(story.towers.slice(0, t));
  let n = 0; // animal k shows from h = 0.8 + 0.015 k; slice only when the count changes
  while (n < story.animals.length && h >= 0.8 + 0.015 * n) n++;
  if (story.game.fauna.length !== n) story.game.fauna = story.animals.slice(0, n);
}
