import test from 'node:test';
import assert from 'node:assert/strict';
import { KIND, BLOCK, mulberry32, idx, createWorld } from '../src/sim/world.js';

test('rng is deterministic', () => {
  const a = mulberry32(7), b = mulberry32(7);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});
test('rng values in [0,1)', () => {
  const r = mulberry32(1);
  for (let i = 0; i < 1000; i++) { const v = r(); assert.ok(v >= 0 && v < 1); }
});
test('world arrays sized w*h', () => {
  const W = createWorld({ w: 5, h: 4, seed: 1 });
  assert.equal(W.n, 20);
  for (const k of ['z', 'wt', 'cover', 'dist', 'kind', 'block', 'fire', 'src']) assert.equal(W[k].length, 20, k);
  assert.equal(W.kind[0], KIND.PEAT);
  assert.equal(W.block[0], BLOCK.NONE);
  assert.equal(W.src[0], -1);
  assert.ok(Math.abs(W.wt[0] - 0.3) < 1e-6);
  assert.ok(typeof W.rng() === 'number');
});
test('idx row-major', () => assert.equal(idx(5, 2, 3), 17));
