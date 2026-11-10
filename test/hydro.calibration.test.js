import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, KIND, BLOCK, idx } from '../src/sim/world.js';
import { generateTerrain } from '../src/sim/terrain.js';
import { computeStrength, computeDistance } from '../src/sim/drainage.js';
import { HYDRO, hydroTick } from '../src/sim/hydro.js';
import { seasonAt, TICKS_PER_YEAR } from '../src/sim/season.js';

// targets = the exp fit at tile centres 50/100/400/1000 m (spec §2.3, Ritzema 2014 Table 4)
const DRY = { 1: 0.70, 2: 0.54, 8: 0.35, 20: 0.33 }, WET = { 1: 0.24, 2: 0.13, 8: 0.05, 20: 0.06 };

function transect(env) {
  const W = createWorld({ w: 41, h: 1, seed: 1 });
  W.kind[0] = KIND.CANAL;
  const S = computeStrength(W);
  computeDistance(W, S);
  for (let t = 0; t < 2000; t++) hydroTick(W, S, env);
  return W.wt;
}

for (const [name, env, target] of [['dry', { week: 45, dry: 1, L: 100 }, DRY], ['wet', { week: 10, dry: 0, L: 45 }, WET]]) {
  test(`C1 Ritzema Table 4 transect, ${name} season`, () => {
    const wt = transect(env);
    for (const [x, want] of Object.entries(target))
      assert.ok(Math.abs(wt[x] - want) <= 0.10, `x=${x}: ${wt[x].toFixed(3)} vs ${want}`);
  });
}

// 20x20 dome peaking at the top edge; canal down x=10 with dome-only z, so it falls toward the outlet at y=19.
const N = 20, CX = 10;
function slopedSite() {
  const W = createWorld({ w: N, h: N, seed: 7 });
  generateTerrain(W, { centre: [CX, 0] });
  const rMax = Math.hypot(CX, N);
  for (let y = 0; y < N; y++) { const i = idx(N, CX, y); W.kind[i] = KIND.CANAL; W.z[i] = 2 * (1 - (y / rMax) ** 2); }
  const site = { W, S: null, tick: 0 };
  drain(site);
  return site;
}
function drain(site) { site.S = computeStrength(site.W); computeDistance(site.W, site.S); }
const meanWt = (W, tiles) => tiles.reduce((a, i) => a + W.wt[i], 0) / tiles.length;
// One year of seasonAt; returns the year-mean of the tile mean, and its max over dry weeks (31-51).
function runYear(site, tiles, params) {
  let sum = 0, dryMax = 0;
  for (let k = 0; k < TICKS_PER_YEAR; k++, site.tick++) {
    const env = seasonAt(site.tick);
    hydroTick(site.W, site.S, env, params);
    const m = meanWt(site.W, tiles);
    sum += m;
    if (env.week >= 31) dryMax = Math.max(dryMax, m);
  }
  return { mean: sum / TICKS_PER_YEAR, dryMax };
}
const peatWhere = (f) => { const t = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (f(x, y)) t.push(idx(N, x, y)); return t; };

test('T2 block raises wt upstream', () => {
  const open = slopedSite(), blocked = slopedSite();
  for (const s of [open, blocked]) for (let k = 0; k < 3; k++) runYear(s, [0], HYDRO);
  const B = 15; // upstream = the 6 canal tiles above the block (y 9-14); tiles within 4 of them
  blocked.W.block[idx(N, CX, B)] = BLOCK.PERM;
  drain(blocked);
  const up = peatWhere((x, y) => x !== CX && Math.abs(x - CX) <= 4 && y >= B - 6 && y < B);
  const a = runYear(open, up, HYDRO).mean, b = runYear(blocked, up, HYDRO).mean;
  assert.ok(b < a - 0.02, `blocked ${b.toFixed(3)} vs open ${a.toFixed(3)}`);
});

// Degraded site: a deep, actively drained canal (eq raised) on default far-field water; the canal sets the 1.1 m start.
const DEGRADED = { ...HYDRO, eqDry: 2.5, eqWet: 2.0 };
test('C2 cascade: 1.1 m -> 0.30–0.45 m mean, dry season still > 0.40 on degraded', () => {
  const site = slopedSite();
  // transect tiles = peat within 50 m of the canal (the adjacent columns), where Ritzema's dam effect is measured
  const tiles = peatWhere((x) => Math.abs(x - CX) === 1);
  for (let k = 0; k < 3; k++) runYear(site, tiles, DEGRADED); // warm-up
  const before = runYear(site, tiles, DEGRADED);
  assert.ok(before.mean >= 1.0 && before.mean <= 1.2, `open-canal start ${before.mean.toFixed(3)}`);
  for (let y = N - 1; y >= 0; y -= 6) site.W.block[idx(N, CX, y)] = BLOCK.PERM; // y 19,13,7,1: every maxHeadTiles
  drain(site);
  const after = runYear(site, tiles, DEGRADED);
  assert.ok(after.mean >= 0.30 && after.mean <= 0.45, `after cascade ${after.mean.toFixed(3)} (start ${before.mean.toFixed(3)})`);
  assert.ok(after.dryMax > 0.40, `dry-season max ${after.dryMax.toFixed(3)}`);
});
