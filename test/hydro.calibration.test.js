import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, KIND } from '../src/sim/world.js';
import { computeStrength, computeDistance } from '../src/sim/drainage.js';
import { hydroTick } from '../src/sim/hydro.js';

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
