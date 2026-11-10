import { KIND, WET_WT, mulberry32 } from './world.js';
import { isWetSeason } from './season.js';

export const FAUNA_SALT = 0xfa07a;
export const MAX_FAUNA = 8; // game value, NOT SOURCED

const isWater = (wd, i) => wd.kind[i] === KIND.CANAL || wd.kind[i] === KIND.RIVER;
const some8 = (wd, i, test) => {
  const { w, h } = wd, x = i % w, y = (i / w) | 0;
  for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++)
    for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++)
      if ((yy * w + xx !== i) && test(yy * w + xx)) return true;
  return false;
};
// a canal tile holds water when the surface (cWater, depth below the bank) is above the bed (cDepth)
const wetWater = (wd, i) => wd.kind[i] === KIND.RIVER || (wd.kind[i] === KIND.CANAL && wd.cWater[i] < wd.cDepth[i]);
const wetPeat = (wd, i) => wd.kind[i] === KIND.PEAT && wd.wt[i] <= WET_WT;
const forest = (wd, i) => wd.cover[i] >= 0.6;
const closed = (min) => ({ world: wd }, i) => wetPeat(wd, i) && wd.cover[i] >= min;

// Every rule, cap, share, divisor and season weight is a game value, NOT SOURCED. Rules follow the "Game mapping" rows in
// docs/references/peat-swamp-wildlife.md. Target = min(cap, floor(suitable / divisor)). The divisor is
// share * (peat tiles) when the entry has a share, so a big map does not fill its caps on day one,
// and 30 otherwise. wet and dry are spawn weights in [0, 1]: the spawn chance is SPAWN * weight.
export const FAUNA = [
  { id: 'orangutan', rule: closed(0.6), cap: 2, share: 0.12, wet: 1, dry: 1 },
  { id: 'gibbon', rule: closed(0.7), cap: 3, share: 0.12, wet: 1, dry: 1 },
  { id: 'langur', rule: closed(0.6), cap: 3, share: 0.12, wet: 1, dry: 1 },
  { id: 'sunbear', rule: closed(0.5), cap: 2, share: 0.12, wet: 0.5, dry: 1 },
  { id: 'hornbill', rule: closed(0.6), cap: 3, share: 0.12, wet: 1, dry: 0.5 },
  { id: 'stork', rule: ({ world: wd }, i) => wetPeat(wd, i) && some8(wd, i, (j) => forest(wd, j)), cap: 2, share: 0.12, wet: 1, dry: 0.3 },
  // water tile next to forest (the game has no night, so no time rule)
  { id: 'fishowl', rule: ({ world: wd }, i) => isWater(wd, i) && some8(wd, i, (j) => forest(wd, j)), cap: 2, wet: 0.6, dry: 1 },
  { id: 'otter', rule: ({ world: wd }, i) => wetWater(wd, i), cap: 3, wet: 1, dry: 0.6 },
  { id: 'gharial', rule: ({ world: wd }, i) => wd.kind[i] === KIND.RIVER, cap: 1, wet: 1, dry: 0.5 },
  { id: 'monitor', rule: ({ world: wd }, i) => isWater(wd, i) || (wetPeat(wd, i) && some8(wd, i, (j) => isWater(wd, j))), cap: 2, wet: 0.5, dry: 1 },
  // fish: a canal or river with water, or a pool. The pool is flooded peat (wt < 0), not the pond action.
  { id: 'snakehead', rule: ({ world: wd }, i) => wetWater(wd, i) || (wd.kind[i] === KIND.PEAT && wd.wt[i] < 0), cap: 3, wet: 1, dry: 0.4 },
];

const SPAWN = 0.35; // spawn chance per call at weight 1, game value, NOT SOURCED
const STAY_MIN = 4, STAY_SPAN = 10; // stay of 4 to 13 weeks, game values, NOT SOURCED
const FAR = 2; // fire within this many tiles (Chebyshev) removes an animal, game value, NOT SOURCED

const by = new Map(FAUNA.map((f) => [f.id, f]));

export function faunaTick(g) {
  const wd = g.world, { w, h, n, fire, cover } = wd;
  const { faunaRng: rng } = g;
  const pick = (a) => a[Math.floor(rng() * a.length)];

  // tiles within FAR of fire (Chebyshev)
  const hot = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (fire[i] > 0) {
    const x = i % w, y = (i / w) | 0;
    for (let yy = Math.max(0, y - FAR); yy <= Math.min(h - 1, y + FAR); yy++)
      for (let xx = Math.max(0, x - FAR); xx <= Math.min(w - 1, x + FAR); xx++) hot[yy * w + xx] = 1;
  }
  const edge = (i) => Math.min(i % w, (i / w) | 0, w - 1 - (i % w), h - 1 - ((i / w) | 0));
  const go = (a, j) => { a.from = a.i; a.i = j; a.moved = g.tick; };

  // leave: fire close removes an animal at once. A stay that ends or a failed rule makes it leave.
  // A leaving animal is removed on an edge tile.
  g.fauna = g.fauna.filter((a) => {
    if (hot[a.i]) return false;
    if (!a.leaving && (g.tick >= a.leave || !by.get(a.species).rule(g, a.i))) a.leaving = true;
    return !(a.leaving && edge(a.i) === 0);
  });

  // move: a leaving animal steps to the neighbour nearest to the edge (ties: lowest index), and ignores the habitat rule.
  // Other animals step to a random suitable 8-neighbour, or stay. No animal steps into fire range.
  for (const a of g.fauna) {
    const { rule } = by.get(a.species), x = a.i % w, y = (a.i / w) | 0, opts = [];
    for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++)
      for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) {
        const j = yy * w + xx;
        if (j !== a.i && !hot[j] && (a.leaving || rule(g, j))) opts.push(j);
      }
    if (a.leaving) {
      let best = -1;
      for (const j of opts) if (best < 0 || edge(j) < edge(best)) best = j; // opts is in index order
      if (best >= 0 && edge(best) < edge(a.i)) go(a, best);
      continue;
    }
    const k = Math.floor(rng() * (opts.length + 1));
    if (k < opts.length) go(a, opts[k]);
  }

  // spawn: one per species per call, up to the target, with a chance that depends on the season
  const wet = isWetSeason(g);
  let peat = 0;
  for (let i = 0; i < n; i++) if (wd.kind[i] === KIND.PEAT) peat++;
  for (const f of FAUNA) {
    const { id, rule, cap, share } = f;
    let s = 0, have = 0;
    const all = [], edges = [], dense = [];
    for (let i = 0; i < n; i++) {
      if (hot[i] || !rule(g, i)) continue;
      s++; all.push(i);
      if (edge(i) === 0) edges.push(i);
      else if (cover[i] >= 0.85) dense.push(i);
    }
    for (const a of g.fauna) if (a.species === id) have++;
    if (have < Math.min(cap, Math.floor(s / (share ? share * peat : 30))) && g.fauna.length < MAX_FAUNA && rng() < SPAWN * (wet ? f.wet : f.dry)) {
      const i = pick(edges.length ? edges : dense.length ? dense : all);
      g.fauna.push({ id: ++g.faunaNext, species: id, i, from: i, moved: g.tick, born: g.tick,
        leave: g.tick + 4 * (STAY_MIN + Math.floor(rng() * STAY_SPAN)), leaving: false });
    }
  }

  for (const a of g.fauna) g.seen.add(a.species);
}
