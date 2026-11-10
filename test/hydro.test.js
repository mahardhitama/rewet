import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, mulberry32 } from '../src/sim/world.js';
import { HYDRO, hydroTick } from '../src/sim/hydro.js';
import { seasonAt, TICKS_PER_YEAR } from '../src/sim/season.js';

const WET = { week: 10, dry: 0, L: 45 };
const S0 = n => new Float32Array(n); // no drainage; world.src stays -1
const sumH = W => { let s = 0; for (let i = 0; i < W.n; i++) s += W.z[i] - W.wt[i]; return s; };

test('T1 lateral flow conserves water', () => {
  const W = createWorld({ w: 12, h: 9, seed: 7 }), r = mulberry32(3);
  // wt kept below 0 so subsidence (wt > 0 only) does not change z
  for (let i = 0; i < W.n; i++) { W.z[i] = (r() - 0.5) * 0.2; W.wt[i] = -0.05 - r() * 0.2; }
  const before = sumH(W), S = S0(W.n), p = { ...HYDRO, kVert: 0 };
  for (let t = 0; t < 100; t++) hydroTick(W, S, WET, p);
  assert.ok(Math.abs(sumH(W) - before) < 1e-4, `${sumH(W)} != ${before}`);
});

test('flooded dips: lower z tile ends wetter', () => {
  const W = createWorld({ w: 3, h: 3, seed: 1 });
  W.z[4] = -0.3;
  const S = S0(W.n);
  for (let t = 0; t < 200; t++) hydroTick(W, S, WET);
  assert.ok(W.wt[4] < W.wt[0], `${W.wt[4]} !< ${W.wt[0]}`);
});

test('subsidence 0.1 x depth per year', () => {
  const W = createWorld({ w: 2, h: 2, seed: 1 });
  W.wt.fill(0.5);
  const S = S0(W.n), p = { ...HYDRO, kVert: 0, kLat: 0 };
  for (let t = 0; t < TICKS_PER_YEAR; t++) hydroTick(W, S, WET, p);
  assert.equal(W.wt[0], 0.5);
  assert.ok(Math.abs(W.z[0] + 0.05) < 0.005, `z ${W.z[0]}`);
});

test('seasonAt ramps dry from 0 to 1', () => {
  assert.equal(TICKS_PER_YEAR, 208);
  const a = seasonAt(10 * 4), b = seasonAt(45 * 4);
  assert.deepEqual([a.week, a.dry, a.L], [10, 0, 45]);
  assert.deepEqual([b.week, b.dry, b.L], [45, 1, 100]);
  const m = seasonAt(33 * 4);
  assert.ok(m.dry > 0 && m.dry < 1, `ramp ${m.dry}`);
  assert.equal(seasonAt(25 * 4, { elNino: true }).dry, 1);
  assert.equal(seasonAt(25 * 4).dry, 0);
  assert.equal(seasonAt(TICKS_PER_YEAR + 10 * 4).week, 10);
});
