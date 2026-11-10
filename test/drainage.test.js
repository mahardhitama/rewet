import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, KIND, BLOCK } from '../src/sim/world.js';
import { DRAIN, computeStrength, computeDistance } from '../src/sim/drainage.js';

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

// w x 1 strip, z rising with x, canal along the whole strip
function slope(w) {
  const W = createWorld({ w, h: 1, seed: 1 });
  for (let x = 0; x < w; x++) { W.z[x] = x * 0.1; W.kind[x] = KIND.CANAL; }
  return W;
}

test('distance in metres from a canal line', () => {
  const W = createWorld({ w: 10, h: 1, seed: 1 });
  W.kind[0] = KIND.CANAL;
  computeDistance(W, computeStrength(W));
  assert.equal(W.dist[0], 0);
  assert.equal(W.dist[1], 50);
  assert.equal(W.dist[4], 200);
  assert.equal(W.src[4], 0);
});
test('diagonal uses 70.71 m', () => {
  const W = createWorld({ w: 3, h: 3, seed: 1 });
  W.kind[0] = KIND.CANAL;
  computeDistance(W, computeStrength(W));
  near(W.dist[4], 70.71);
  near(W.dist[8], 141.42);
  assert.equal(W.src[8], 0);
});
test('block lowers S upstream only, up to maxHeadTiles', () => {
  const W = slope(12);
  W.block[2] = BLOCK.TEMP;
  const S = computeStrength(W);
  for (let x = 2; x <= 8; x++) near(S[x], DRAIN.temp, 1e-6);
  near(S[9], 1, 1e-6);
  near(S[0], 1, 1e-6);
  near(S[1], 1, 1e-6);
});
test('second block stops the walk', () => {
  const W = slope(14);
  W.block[2] = BLOCK.TEMP;
  W.block[5] = BLOCK.PERM;
  const S = computeStrength(W);
  near(S[3], DRAIN.temp, 1e-6); near(S[4], DRAIN.temp, 1e-6);
  for (let x = 5; x <= 11; x++) near(S[x], DRAIN.perm, 1e-6);
  near(S[12], 1, 1e-6);
});
test('river tiles get river strength and are sources', () => {
  const W = createWorld({ w: 3, h: 1, seed: 1 });
  W.kind[0] = KIND.RIVER;
  const S = computeStrength(W);
  near(S[0], DRAIN.river, 1e-6);
  assert.equal(S[1], 0);
});
test('backfilled canal is not a source', () => {
  const W = createWorld({ w: 4, h: 1, seed: 1 });
  W.kind[0] = KIND.CANAL; W.block[0] = BLOCK.FILLED;
  const S = computeStrength(W);
  assert.equal(S[0], 0);
  computeDistance(W, S);
  for (let i = 0; i < 4; i++) { assert.equal(W.dist[i], Infinity); assert.equal(W.src[i], -1); }
});
