import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, idx } from '../src/sim/world.js';
import { generateTerrain } from '../src/sim/terrain.js';

const mk = (seed = 1, w = 40, h = 40) => createWorld({ w, h, seed });

test('micro-relief within ±0.3 m of dome', () => {
  const W = mk();
  generateTerrain(W, { domeRise: 0 });
  let min = Infinity, max = -Infinity;
  for (const v of W.z) { min = Math.min(min, v); max = Math.max(max, v); assert.ok(v >= -0.3 - 1e-6 && v <= 0.3 + 1e-6); }
  assert.ok(max - min > 0.3);
});
test('dome highest at centre', () => {
  const W = mk();
  generateTerrain(W, { domeRise: 2, microAmp: 0 });
  assert.ok(Math.abs(W.z[idx(40, 20, 20)] - 2) < 1e-6);
  assert.ok(W.z[0] < 0.5);
  assert.ok(W.z.every((v) => v <= W.z[idx(40, 20, 20)] + 1e-6));
});
test('same seed same terrain', () => {
  const A = mk(3), B = mk(3);
  generateTerrain(A, {}); generateTerrain(B, {});
  assert.deepEqual(A.z, B.z);
});
test('smoothed: neighbour diff small', () => {
  const W = mk();
  generateTerrain(W, { domeRise: 0 });
  let s = 0, c = 0;
  for (let y = 0; y < W.h; y++) for (let x = 0; x < W.w - 1; x++) { s += Math.abs(W.z[idx(W.w, x, y)] - W.z[idx(W.w, x + 1, y)]); c++; }
  assert.ok(s / c < 0.1);
});
