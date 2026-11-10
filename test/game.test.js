import test from 'node:test';
import assert from 'node:assert/strict';
import { KIND, BLOCK, idx } from '../src/sim/world.js';
import { createGame, applyAction, step, costOf } from '../src/sim/game.js';

const S = 12;
const canal = [[0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6]]; // edge toward dome centre
const lvl = (o = {}) => ({
  id: 1, size: S, years: 2, seed: 7, grant: 1000, arson: 0, illegalCanals: [], elNinoYear: null, pass: {},
  canals: canal, villages: [[10, 10]], ...o,
});
const at = (x, y) => idx(S, x, y);
const busyCrews = (g) => g.crews.filter((t) => t > g.tick).length;

test('action spends funds and occupies a crew', () => {
  const g = createGame(lvl());
  assert.deepEqual(applyAction(g, 'tempBlock', at(3, 6)), { ok: true });
  assert.equal(g.funds, 1000 - 80);
  assert.equal(busyCrews(g), 1);
  assert.equal(g.jobs.length, 1);
  for (let t = 0; t < 4; t++) step(g);
  assert.equal(g.world.block[at(3, 6)], BLOCK.TEMP);
  assert.equal(busyCrews(g), 0);
  assert.equal(g.jobs.length, 0);
});

test('Review: second action on same tile -> busy, funds unchanged', () => {
  const g = createGame(lvl());
  applyAction(g, 'tempBlock', at(3, 6));
  const f = g.funds;
  assert.deepEqual(applyAction(g, 'tempBlock', at(3, 6)), { ok: false, reason: 'busy' });
  assert.deepEqual(applyAction(g, 'well', at(3, 6)), { ok: false, reason: 'busy' });
  assert.equal(g.funds, f);
  assert.equal(busyCrews(g), 1);
});

test('refuses invalid tile, no funds, no crew', () => {
  const g = createGame(lvl());
  assert.deepEqual(applyAction(g, 'tempBlock', at(8, 8)), { ok: false, reason: 'invalid' });
  assert.deepEqual(applyAction(g, 'permBlock', at(3, 6)), { ok: false, reason: 'invalid' });
  assert.deepEqual(applyAction(g, 'fireGroup', at(8, 8)), { ok: false, reason: 'invalid' });
  assert.deepEqual(applyAction(g, 'fireCrew', at(8, 8)), { ok: false, reason: 'invalid' });
  for (const x of [1, 2, 3]) assert.equal(applyAction(g, 'tempBlock', at(x, 6)).ok, true);
  assert.deepEqual(applyAction(g, 'tempBlock', at(4, 6)), { ok: false, reason: 'crew' });
  assert.deepEqual(applyAction(g, 'tempBlock', at(3, 6)), { ok: false, reason: 'busy' }); // busy before crew

  const poor = createGame(lvl({ grant: 50 }));
  assert.deepEqual(applyAction(poor, 'tempBlock', at(3, 6)), { ok: false, reason: 'funds' });
  assert.equal(poor.funds, 50);
  assert.equal(busyCrews(poor), 0);

  const more = createGame(lvl(), { crew: 1 });
  assert.equal(more.crews.length, 4);
});

test('wet season discount 0.8', () => {
  const g = createGame(lvl());
  assert.equal(costOf(g, 'tempBlock'), 80);
  assert.equal(costOf(g, 'backfill'), 480);
  g.tick = 31 * 4; // dry
  assert.equal(costOf(g, 'tempBlock'), 100);
  g.tick = 25 * 4; // wet normally
  assert.equal(costOf(g, 'plant'), 48);
  const n = createGame(lvl({ elNinoYear: 0 }));
  n.tick = 25 * 4; // El Nino year: dry from week 21
  assert.equal(costOf(n, 'plant'), 60);
  const c = createGame(lvl(), { cheapBlocks: true });
  assert.equal(costOf(c, 'tempBlock'), 60);
  assert.equal(costOf(c, 'well'), 64);
});

test('backfill removes drainage source after job completes', () => {
  const g = createGame(lvl());
  const i = at(2, 6);
  assert.ok(g.S[i] > 0);
  assert.equal(applyAction(g, 'backfill', i).ok, true);
  for (let t = 0; t < 23; t++) step(g);
  assert.ok(g.S[i] > 0, 'not done before 6 weeks');
  step(g);
  assert.equal(g.S[i], 0);
  assert.equal(g.world.block[i], BLOCK.FILLED);
  assert.notEqual(g.world.src[i], i);
});

test('Review: illegal canal stops at block / village / filled tile', () => {
  const path = [0, 1, 2, 3, 4, 5, 6].map((x) => [x, 2]);
  const run = (setup) => {
    const g = createGame(lvl({ canals: [], illegalCanals: [path] }));
    setup(g.world, at(3, 2));
    for (let t = 0; t < 80; t++) step(g);
    return g.world;
  };
  const block = run((w, i) => { w.kind[i] = KIND.CANAL; w.block[i] = BLOCK.TEMP; });
  const village = run((w, i) => { w.kind[i] = KIND.VILLAGE; });
  const filled = run((w, i) => { w.block[i] = BLOCK.FILLED; });
  for (const w of [block, village, filled]) {
    for (const x of [0, 1, 2]) assert.equal(w.kind[at(x, 2)], KIND.CANAL);
    for (const x of [4, 5, 6]) assert.equal(w.kind[at(x, 2)], KIND.PEAT);
  }
  assert.equal(block.block[at(3, 2)], BLOCK.TEMP);
  assert.equal(village.kind[at(3, 2)], KIND.VILLAGE);
  assert.equal(filled.kind[at(3, 2)], KIND.PEAT);
  assert.equal(filled.block[at(3, 2)], BLOCK.FILLED);
  const open = run(() => {});
  for (const x of [0, 1, 2, 3, 4, 5, 6]) assert.equal(open.kind[at(x, 2)], KIND.CANAL);
});

test('low goodwill -> more arson (seeded, 200 runs)', () => {
  const count = (goodwill) => {
    let n = 0;
    for (let s = 1; s <= 200; s++) {
      const g = createGame(lvl({ seed: s, arson: 20, canals: [] }));
      g.goodwill = goodwill;
      g.tick = 31 * 4;
      for (let t = 0; t < 84; t++) step(g);
      n += g.events.filter((e) => e.type === 'arson').length;
    }
    return n;
  };
  const low = count(10), high = count(90);
  assert.ok(low > 4 * high, `low ${low} high ${high}`);
  assert.ok(high > 0);
});

test('T5 determinism: same seed + action list -> identical wt and z arrays after 2 years', () => {
  const plan = [[0, 'tempBlock', at(4, 6)], [10, 'mound', at(8, 8)], [20, 'plant', at(8, 8)], [40, 'permBlock', at(4, 6)],
    [130, 'well', at(9, 9)], [150, 'fireGroup', at(10, 10)]];
  const run = () => {
    const g = createGame(lvl({ arson: 30, elNinoYear: 1, illegalCanals: [[[11, 2], [10, 2], [9, 2], [8, 3]]] }));
    for (let t = 0; t < 416; t++) {
      for (const [tt, id, i] of plan) if (tt === t) applyAction(g, id, i);
      for (let i = 0; i < g.world.n; i++) if (g.world.fire[i]) applyAction(g, 'fireCrew', i);
      step(g);
    }
    return g;
  };
  const a = run(), b = run();
  assert.deepEqual(a.world.wt, b.world.wt);
  assert.deepEqual(a.world.z, b.world.z);
  assert.deepEqual(a.world.cover, b.world.cover);
  assert.deepEqual(a.events, b.events);
  assert.equal(a.funds, b.funds);
  assert.equal(a.events.filter((e) => e.type === 'yearEnd').length, 2);
  assert.ok(a.events.some((e) => e.type === 'elNinoWarning'));
});
