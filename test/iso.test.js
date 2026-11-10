import { test } from 'node:test';
import assert from 'node:assert/strict';
import { downstream, canalStep, widthStep } from '../src/render/iso.js';
import { KIND } from '../src/sim/world.js';

test('downstream picks the lowest lower canal or river neighbour', () => {
  const C = KIND.CANAL, P = KIND.PEAT, R = KIND.RIVER;
  // 3x3 grid, a canal on the middle row that runs into a river in the corner
  const kind = [P, P, P, C, C, C, P, P, R], z = [9, 9, 0, 3, 2, 1, 9, 9, 0.5];
  const ds = downstream(3, 3, Float32Array.from(z), Uint8Array.from(kind));
  assert.deepEqual([...ds], [-1, -1, -1, 4, 8, 8, -1, -1, -1]); // peat at z 0 is not a target
});

test('downstream gives -1 at a local low point', () => {
  const ds = downstream(2, 1, Float32Array.from([1, 1]), Uint8Array.from([KIND.CANAL, KIND.CANAL]));
  assert.deepEqual([...ds], [-1, -1]);
});

test('canal steps', () => {
  assert.equal(canalStep(0.75, 5), 0);
  assert.equal(canalStep(3.5, 5), 2);
  assert.equal(canalStep(5, 5), 3);
  assert.equal(canalStep(1, 0), 0);
  assert.deepEqual([4.9, 5, 8, 8.1].map(widthStep), [0, 1, 1, 2]);
});
