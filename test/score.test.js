import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, checkEarlyLoss, co2Estimate, seedlingSurvival } from '../src/sim/score.js';
import { KIND, WET_WT } from '../src/sim/world.js';
import { LEVELS, buildLevelWorld } from '../src/levels.js';
import { resolveLevel } from '../src/sim/mapgen.js';
import { createGame } from '../src/sim/game.js';

// Game-like stub: n peat tiles, `wet` of them with mean dry wt 0.3, rest 0.8.
function mk({ n = 10, wet = 6, cover = 0.4, goodwill = 60, burnt = 0, funds = 1000, crews = [0], jobs = [], tick = 2 * 208 + 200, upgrades = {} } = {}) {
  const wt = new Float32Array(n).fill(0.8).fill(0.3, 0, wet);
  return {
    world: { n, wt, kind: new Uint8Array(n).fill(KIND.PEAT), cover: new Float32Array(n).fill(cover) },
    level: { pass: { rewet: 60, reveg: 40, revit: 60 }, years: 3, elNinoYear: null }, upgrades,
    tick, funds, crews, jobs, goodwill,
    burnt: new Set(Array.from({ length: burnt }, (_, i) => i)),
    wt0: new Float32Array(n).fill(0.8),
    cover0: new Float32Array(n),
    wetTicks: new Uint16Array(n),
    dryWtHistory: [wt],
  };
}

test('T4 stars at exact boundaries', () => {
  let r = evaluate(mk());
  assert.equal(r.rewetPct, 60);
  assert.equal(r.passed, true);
  assert.equal(r.stars, 3);
  assert.deepEqual(r.hints, []);
  r = evaluate(mk({ n: 1000, wet: 599 }));
  assert.equal(r.rewetPct, 59.9);
  assert.equal(r.passed, false);
  assert.equal(r.stars, 0);
  assert.equal(r.hints[0], 'rewet');
  r = evaluate(mk({ goodwill: 59 }));
  assert.equal(r.stars, 2);
  assert.deepEqual(r.hints, ['revit']);
  r = evaluate(mk({ cover: 0.39 }));
  assert.equal(r.stars, 2);
  assert.deepEqual(r.hints, ['reveg']);
});

test('R21: early loss fails the level: passed false, stars 0, loss set', () => {
  const r = evaluate(mk({ n: 100, wet: 100, burnt: 36 }));
  assert.equal(r.rewetPct, 100);
  assert.equal(r.loss, 'fire');
  assert.equal(r.passed, false);
  assert.equal(r.stars, 0);
  assert.equal(evaluate(mk()).loss, null);
});

test('rewetPct uses mean over dry season, falls back to current wt', () => {
  const g = mk({ n: 1, wet: 1 });
  g.dryWtHistory = [new Float32Array([0.2]), new Float32Array([0.7])]; // mean 0.45
  assert.equal(evaluate(g).rewetPct, 0);
  g.dryWtHistory = [new Float32Array([WET_WT]), new Float32Array([WET_WT])];
  assert.equal(evaluate(g).rewetPct, 100);
  g.dryWtHistory = [];
  assert.equal(evaluate(g).rewetPct, 100);
});

test('coverPct skips canals and farms', () => {
  const g = mk({ n: 4, cover: 0.5 });
  g.world.kind[2] = KIND.CANAL; g.world.kind[3] = KIND.FARM;
  g.world.cover[2] = 0; g.world.cover[3] = 0;
  assert.equal(evaluate(g).coverPct, 50);
});

test('early loss at 35% burnt, not 34%', () => {
  assert.equal(checkEarlyLoss(mk({ n: 100, burnt: 34 })), null);
  assert.equal(checkEarlyLoss(mk({ n: 100, burnt: 36 })), 'fire');
  assert.equal(checkEarlyLoss(mk({ n: 100, burnt: 35 })), null);
});

test('early loss funds only when idle and broke', () => { // default tick: final year, dry season
  assert.equal(checkEarlyLoss(mk({ funds: 49 })), 'funds');
  assert.equal(checkEarlyLoss(mk({ funds: 50 })), null);
  assert.equal(checkEarlyLoss(mk({ funds: 0, crews: [9999] })), null);
  assert.equal(checkEarlyLoss(mk({ funds: 0, jobs: [{}] })), null);
  assert.equal(checkEarlyLoss(mk({ funds: 0, crews: [Infinity] })), null);
});

test('R25: no funds loss while a grant is still to come', () => {
  assert.equal(checkEarlyLoss(mk({ funds: 0, tick: 45 })), null); // year 1
  assert.equal(checkEarlyLoss(mk({ funds: 0, tick: 2 * 208 - 1 })), null); // last tick of year 2
  assert.equal(checkEarlyLoss(mk({ funds: 0, tick: 2 * 208 })), 'funds'); // final year
  assert.equal(checkEarlyLoss(mk({ funds: 0, tick: 3 * 208 })), null); // level over: the debrief judges the scores
});

test('R25: broke means below the cheapest action at today\'s price', () => {
  const wet = 2 * 208 + 4; // final year, wet season: mound 50 x 0.8 = 40
  assert.equal(checkEarlyLoss(mk({ funds: 45, tick: wet })), null);
  assert.equal(checkEarlyLoss(mk({ funds: 39, tick: wet })), 'funds');
  assert.equal(checkEarlyLoss(mk({ funds: 45 })), 'funds'); // dry season: mound 50
});

test('early loss goodwill', () => {
  assert.equal(checkEarlyLoss(mk({ goodwill: 0 })), 'goodwill');
  assert.equal(checkEarlyLoss(mk({ goodwill: 1 })), null);
});

test('fire CO2: one burnt tile = 0.25*353*0.464 t C', () => {
  const { fireTC } = co2Estimate(mk({ burnt: 1 }));
  assert.ok(Math.abs(fireTC - 40.946) < 0.01);
});

test('avoided CO2: only tiles that started dry and end wet', () => {
  const g = mk({ n: 3, wet: 3 });
  g.wt0[2] = 0.2; // started wet: excluded
  g.world.wt[1] = 0.9; // ends dry: excluded
  g.wetTicks[0] = 208 * 2; g.wetTicks[1] = 208; g.wetTicks[2] = 208;
  assert.ok(Math.abs(co2Estimate(g).avoidedTC - 14 * 0.25 * 2) < 1e-9);
});

test('seedlingSurvival counts every seeded tile since a tick; alive = seedling or full cover', () => {
  const g = mk({ n: 4 });
  g.planted = new Map([[0, 10], [1, 10], [2, 300], [3, 300]]);
  g.seedlings = new Map([[0, 0], [2, 0]]);
  g.world.cover[3] = 1; g.world.cover[1] = 0.5; // 1 died (no seedling, cover < 1)
  assert.deepEqual(seedlingSurvival(g), { alive: 3, planted: 4 });
  assert.deepEqual(seedlingSurvival(g, 200), { alive: 2, planted: 2 });
});

const start = (l) => createGame(l, {}, buildLevelWorld(l));

test('coverPct is 0 at the start of each level', () => {
  for (const l of LEVELS.map(resolveLevel)) assert.equal(evaluate(start(l)).coverPct, 0, `L${l.id}`);
});

test('full growth gives 100', () => {
  const g = start(resolveLevel(LEVELS[0])), { kind, cover } = g.world;
  for (let i = 0; i < g.world.n; i++) if (kind[i] !== KIND.CANAL && kind[i] !== KIND.FARM) cover[i] = 1;
  assert.equal(evaluate(g).coverPct, 100);
});

test('coverPct is the gain above the start cover', () => {
  const g = mk({ n: 2, cover: 0.8 });
  g.cover0.fill(0.6);
  assert.ok(Math.abs(evaluate(g).coverPct - 50) < 1e-4);
});
