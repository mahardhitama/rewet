import { KIND, WET_WT, mulberry32 } from './world.js';

export const FAUNA_SALT = 0xfa07a;
export const MAX_FAUNA = 24;

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

// Every rule, cap, share and divisor is a game value, NOT SOURCED. Rules follow the "Game mapping" rows in
// docs/references/peat-swamp-wildlife.md. Target = min(cap, floor(suitable / divisor)). The divisor is
// share * (peat tiles) when the entry has a share, so a big map does not fill its caps on day one,
// and 30 otherwise.
export const FAUNA = [
  { id: 'orangutan', rule: closed(0.6), cap: 2, share: 0.12 },
  { id: 'gibbon', rule: closed(0.7), cap: 3, share: 0.12 },
  { id: 'langur', rule: closed(0.6), cap: 3, share: 0.12 },
  { id: 'sunbear', rule: closed(0.5), cap: 2, share: 0.12 },
  { id: 'hornbill', rule: closed(0.6), cap: 3, share: 0.12 },
  { id: 'stork', rule: ({ world: wd }, i) => wetPeat(wd, i) && some8(wd, i, (j) => forest(wd, j)), cap: 2, share: 0.12 },
  // water tile next to forest (the game has no night, so no time rule)
  { id: 'fishowl', rule: ({ world: wd }, i) => isWater(wd, i) && some8(wd, i, (j) => forest(wd, j)), cap: 2 },
  { id: 'otter', rule: ({ world: wd }, i) => wetWater(wd, i), cap: 3 },
  { id: 'gharial', rule: ({ world: wd }, i) => wd.kind[i] === KIND.RIVER, cap: 1 },
  { id: 'monitor', rule: ({ world: wd }, i) => isWater(wd, i) || (wetPeat(wd, i) && some8(wd, i, (j) => isWater(wd, j))), cap: 2 },
  // fish: a canal or river with water, or a pool. The pool is flooded peat (wt < 0), not the pond action.
  { id: 'snakehead', rule: ({ world: wd }, i) => wetWater(wd, i) || (wd.kind[i] === KIND.PEAT && wd.wt[i] < 0), cap: 3 },
];

const by = new Map(FAUNA.map((f) => [f.id, f]));

export function faunaTick(g) {
  const wd = g.world, { w, h, n, fire, cover } = wd;
  const { faunaRng: rng } = g;
  const pick = (a) => a[Math.floor(rng() * a.length)];

  // tiles within 2 of fire (Chebyshev)
  const hot = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (fire[i] > 0) {
    const x = i % w, y = (i / w) | 0;
    for (let yy = Math.max(0, y - 2); yy <= Math.min(h - 1, y + 2); yy++)
      for (let xx = Math.max(0, x - 2); xx <= Math.min(w - 1, x + 2); xx++) hot[yy * w + xx] = 1;
  }

  // leave: rule fails or fire close
  g.fauna = g.fauna.filter((a) => !hot[a.i] && by.get(a.species).rule(g, a.i));

  // move: random suitable 8-neighbour, or stay
  for (const a of g.fauna) {
    const { rule } = by.get(a.species), x = a.i % w, y = (a.i / w) | 0, opts = [];
    for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++)
      for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) {
        const j = yy * w + xx;
        if (j !== a.i && !hot[j] && rule(g, j)) opts.push(j);
      }
    const k = Math.floor(rng() * (opts.length + 1));
    if (k < opts.length) a.i = opts[k];
  }

  // spawn: one per species per call, up to the target
  for (const { id, rule, cap, share } of FAUNA) {
    let s = 0, have = 0, peat = 0;
    const all = [], pref = [];
    for (let i = 0; i < n; i++) {
      if (wd.kind[i] === KIND.PEAT) peat++;
      if (hot[i] || !rule(g, i)) continue;
      s++; all.push(i);
      if (i % w === 0 || i % w === w - 1 || i < w || i >= n - w || cover[i] >= 0.85) pref.push(i);
    }
    for (const a of g.fauna) if (a.species === id) have++;
    if (have < Math.min(cap, Math.floor(s / (share ? share * peat : 30))) && g.fauna.length < MAX_FAUNA)
      g.fauna.push({ id: ++g.faunaNext, species: id, i: pick(pref.length ? pref : all), born: g.tick });
  }

  for (const a of g.fauna) g.seen.add(a.species);
}
