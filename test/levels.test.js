import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEVELS, buildLevelWorld } from '../src/levels.js';
import { KIND, BLOCK } from '../src/sim/world.js';
import { DRAIN, walkUp } from '../src/sim/drainage.js';
import { createGame, step } from '../src/sim/game.js';
import { evaluate } from '../src/sim/score.js';
import { TICKS_PER_YEAR } from '../src/sim/season.js';
import { runPlan } from '../scripts/sim-run.js';
import { blockPlan } from '../scripts/auto-plan.js';
import { resolveLevel } from '../src/sim/mapgen.js';

const SIZES = [22, 24, 26, 30, 30, 40], YEARS = [3, 3, 4, 4, 4, 5];

test('six levels match spec section 5 sizes, years and R17 pass lines', () => {
  assert.equal(LEVELS.length, 6);
  LEVELS.map(resolveLevel).forEach((l, k) => {
    assert.equal(l.id, k + 1);
    assert.equal(l.size, SIZES[k]);
    assert.equal(l.years, YEARS[k]);
    assert.deepEqual(l.pass, { rewet: 60 + 3 * k, reveg: 40 + 3 * k, revit: 60 + 2 * k });
    for (const key of ['name', 'teaches']) assert.equal(typeof l[key], 'string');
    for (const [x, y] of [...l.canals, ...l.rivers, ...l.villages, ...l.farms, ...l.illegalCanals.flat()])
      assert.ok(x >= 0 && y >= 0 && x < l.size && y < l.size, `L${l.id} tile ${x},${y} off map`);
  });
});

test('pass lines rise monotonically 1..6', () => {
  for (let k = 1; k < 6; k++) for (const g of ['rewet', 'reveg', 'revit'])
    assert.ok(LEVELS[k].pass[g] > LEVELS[k - 1].pass[g], `L${k + 1} ${g}`);
});

test('level 5 has an El Nino year; illegal canals only from level 4', () => {
  assert.notEqual(LEVELS[4].elNinoYear, null);
  for (const l of LEVELS.slice(0, 3)) assert.equal(resolveLevel(l).illegalCanals.length, 0);
  assert.ok(resolveLevel(LEVELS[3]).illegalCanals.length > 0);
});

// Every checked seed of each level, so the random pick in main.js gives a fair map.
const SEEDED = LEVELS.flatMap((l) => l.seeds.map((seed) => ({ ...l, seed })));

test('each level lists its fixed seed among 8 distinct checked seeds', () => {
  for (const l of LEVELS) {
    assert.ok(l.seeds.includes(l.seed), `L${l.id}`);
    assert.equal(new Set(l.seeds).size, 8, `L${l.id}`);
  }
});

test('each level places map.villages villages (3x3 tiles) and the same number of farms (4x3 tiles)', () => {
  for (const l of SEEDED.map(resolveLevel)) {
    assert.equal(l.villages.length, 9 * l.map.villages, `L${l.id} villages`);
    assert.equal(l.farms.length, 12 * l.map.villages, `L${l.id} farms`);
  }
});

test('every canal tile but the outlet has a downhill canal neighbour (block walks go upstream)', () => {
  for (const l of LEVELS.map(resolveLevel)) {
    const wd = buildLevelWorld(l);
    for (let i = 0; i < wd.n; i++) {
      if (wd.kind[i] !== KIND.CANAL) continue;
      const x = i % wd.w, y = (i / wd.w) | 0;
      if (x === 0 || y === 0 || x === wd.w - 1 || y === wd.h - 1) continue; // outlet at the edge
      let down = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const j = (y + dy) * wd.w + x + dx;
        if ((dx || dy) && ((wd.kind[j] === KIND.CANAL && wd.z[j] < wd.z[i]) || wd.kind[j] === KIND.RIVER)) down = true; // or outlet into a river
      }
      assert.ok(down, `L${l.id} canal ${x},${y} has no downhill neighbour`);
    }
  }
});

test('every level builds and opens drained (rewetPct < pass.rewet)', () => {
  for (const l of SEEDED.map(resolveLevel)) {
    const g = createGame(l, {}, buildLevelWorld(l));
    // opening state: no dry history yet, so evaluate uses current wt (end of the warm-up year's dry season)
    const { rewetPct } = evaluate(g);
    assert.ok(rewetPct < l.pass.rewet, `L${l.id} opens at ${rewetPct.toFixed(1)}% >= ${l.pass.rewet}`);
  }
});

test('buildLevelWorld is deterministic', () => {
  const a = buildLevelWorld(resolveLevel(LEVELS[0])), b = buildLevelWorld(resolveLevel(LEVELS[0]));
  assert.deepEqual(a.wt, b.wt);
  assert.deepEqual(a.z, b.z);
});

test('no-action run fails every level (early loss or below the pass line)', () => {
  for (const l of SEEDED) {
    const r = runPlan(l.id, [], l.seed);
    assert.ok(r.loss !== null || !r.evaluate.passed, `L${l.id} seed ${l.seed} passes with no action`);
  }
});

test('each level passes with blockPlan and fails with no action', () => {
  for (const l of SEEDED) {
    const r = runPlan(l.id, blockPlan, l.seed), at = `L${l.id} seed ${l.seed}`;
    assert.deepEqual(r.refused, [], `${at} refused`);
    assert.equal(r.loss, null, `${at} loss ${r.loss}`);
    assert.equal(r.evaluate.passed, true, `${at} rewet ${r.evaluate.rewetPct.toFixed(1)}%`);
  }
});

test('fixture l1-cascade passes level 1 through the sim-run code path', () => {
  const plan = JSON.parse(readFileSync(new URL('./fixtures/l1-cascade.json', import.meta.url)));
  const r = runPlan(1, plan);
  assert.deepEqual(r.refused, []);
  assert.equal(r.loss, null);
  assert.equal(r.evaluate.passed, true, `rewet ${r.evaluate.rewetPct.toFixed(1)}%`);
});

test('R27: fixture l1-reveg (cascade, then a 5-tile planting grid) reaches the L1 revegetation star', () => {
  const plan = JSON.parse(readFileSync(new URL('./fixtures/l1-reveg.json', import.meta.url)));
  const r = runPlan(1, plan);
  assert.deepEqual(r.refused, []);
  assert.equal(r.loss, null);
  assert.ok(r.evaluate.coverPct >= LEVELS[0].pass.reveg, `cover ${r.evaluate.coverPct.toFixed(1)}%`);
  assert.equal(r.evaluate.stars, 2);
});

// C3: PERM blocks set directly on the world before the run; 1 year, no threats (hydrology only).
function wetAfterYear(level, blocks) {
  const wd = buildLevelWorld(level);
  for (const i of blocks) wd.block[i] = BLOCK.PERM;
  const g = createGame(level, {}, wd);
  for (let t = 0; t < TICKS_PER_YEAR; t++) step(g);
  const e = evaluate(g);
  let peat = 0;
  for (let i = 0; i < wd.n; i++) if (wd.kind[i] === KIND.PEAT) peat++;
  return Math.round((e.rewetPct / 100) * peat);
}

const front = (wd, b) => (b < 0 ? [] : walkUp(wd, b, DRAIN.maxHeadTiles, () => {}));

// "Rewets" = tiles wet by evaluate's rule after 1 year, minus the no-block run (absolute counts can never reach
// 1.5x: the undrained far field is already ~60% of the peat). Cascade: b, then each b2 maxHeadTiles up the channel
// (every branch of the walk's far front), then each b3 maxHeadTiles above b2. Every canal tile is a start.
test('C3 on level 4: best 3-block cascade rewets >= 1.5x tiles of best single block', () => {
  const level = { ...resolveLevel(LEVELS[3]), arson: 0, illegalCanals: [] };
  const wd = buildLevelWorld(level);
  const canals = [];
  for (let i = 0; i < wd.n; i++) if (wd.kind[i] === KIND.CANAL) canals.push(i);
  const base = wetAfterYear(level, []);
  let single = 0, cascade = 0, runs = 0;
  for (const b of canals) {
    single = Math.max(single, wetAfterYear(level, [b]) - base);
    for (const b2 of front(wd, b)) for (const b3 of front(wd, b2)) {
      cascade = Math.max(cascade, wetAfterYear(level, [b, b2, b3]) - base);
      runs++;
    }
  }
  console.log(`C3: canal tiles ${canals.length}, cascades ${runs}, no-block wet ${base}, best single +${single}, best cascade +${cascade}`);
  assert.ok(single > 0);
  assert.ok(cascade >= 1.5 * single, `cascade +${cascade} < 1.5 x single +${single}`);
});
