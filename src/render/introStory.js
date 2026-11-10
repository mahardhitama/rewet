// Render-only intro story: a generated map that changes from degraded to restored over story time h in [0, 1].
// All values here are game art, NOT real-world values.
import { LEVELS, buildLevelWorld } from '../levels.js';
import { resolveLevel } from '../sim/mapgen.js';
import { computeStrength } from '../sim/drainage.js';
import { FAUNA } from '../sim/fauna.js';
import { KIND, BLOCK, mulberry32 } from '../sim/world.js';

export const INTRO_LEVEL = (seed) => ({ ...LEVELS[5], size: 30, seed, sandbox: true });

const hash = (i) => {
  let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const MAX_ANIMALS = 12, PER_SPECIES = 2, WATER_SPAN = 0.25, COVER_LAG = 0.1;

export function buildStory(seed) {
  const world = buildLevelWorld(resolveLevel(INTRO_LEVEL(seed)));
  const { n, kind, wt, cover, z, cDepth } = world;
  const game = { world, S: computeStrength(world), tick: 0, jobs: [], fauna: [], ponds: new Set(), seedlings: new Set(), wells: new Set(), paluds: new Set(), fireGroups: new Set() };
  const start = { wt: wt.slice(), cover: cover.slice() }, end = { wt: wt.slice(), cover: cover.slice() };
  const at = new Float32Array(n), fire0 = new Uint8Array(n), blockAt = new Float32Array(n).fill(2);
  let firstPeat = -1;
  for (let i = 0; i < n; i++) {
    at[i] = 0.2 + 0.4 * hash(i + 11);
    if (kind[i] !== KIND.PEAT) continue;
    firstPeat = firstPeat < 0 ? i : firstPeat;
    start.wt[i] = Math.max(wt[i], 0.6); start.cover[i] = cover[i] * 0.15;
    end.wt[i] = Math.min(wt[i], 0.15); end.cover[i] = Math.max(cover[i], 0.6 + 0.4 * hash(i + 7));
    if (hash(i) < 0.03) fire0[i] = hash(i + 5) < 0.4 ? 2 : 1;
  }
  if (firstPeat >= 0 && !fire0.some(Boolean)) fire0[firstPeat] = 1;
  // blocks: higher bed first
  const canals = [];
  for (let i = 0; i < n; i++) if (kind[i] === KIND.CANAL) canals.push(i);
  canals.sort((a, b) => (z[a] - cDepth[a]) - (z[b] - cDepth[b]));
  canals.forEach((i, r) => { if (hash(i + 3) < 0.12) blockAt[i] = 0.05 + 0.25 * (1 - (canals.length > 1 ? r / (canals.length - 1) : 1)); });
  const story = { game, start, end, at, fire0, blockAt, animals: [] };
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
  const { world: wd } = story.game, { start, end, at, fire0, blockAt } = story;
  for (let i = 0; i < wd.n; i++) {
    const tw = clamp01((h - at[i]) / WATER_SPAN), tc = clamp01((h - at[i] - COVER_LAG) / WATER_SPAN);
    wd.wt[i] = start.wt[i] + (end.wt[i] - start.wt[i]) * tw;
    wd.cover[i] = start.cover[i] + (end.cover[i] - start.cover[i]) * tc;
    wd.fire[i] = h < at[i] ? fire0[i] : 0;
    wd.block[i] = h >= blockAt[i] ? BLOCK.PERM : BLOCK.NONE;
  }
  story.game.fauna = story.animals.filter((_, k) => h >= 0.8 + 0.015 * k);
}
