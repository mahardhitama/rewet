import test from 'node:test';
import assert from 'node:assert/strict';
import { ticksForFrame } from '../src/main.js';

// Sum ticks over many small frames; a frame gap of 100 ms stays under the 8-tick cap.
const run = (frames, dt, speed) => {
  let carry = 0, total = 0;
  for (let i = 0; i < frames; i++) { const r = ticksForFrame(dt, speed, carry); total += r.ticks; carry = r.carry; }
  return total;
};

test('150 s at x1 = 208 ticks (1 year)', () => assert.equal(run(1500, 100, 1), 208));
test('75 s at x2 = 208 ticks, the old x1 pace', () => assert.equal(run(750, 100, 2), 208));
test('paused -> 0 ticks', () => assert.equal(ticksForFrame(1000, 0, 0).ticks, 0));
test('carry keeps the fraction between frames', () => {
  const r = ticksForFrame(100, 1, 0);
  assert.equal(r.ticks, 0);
  assert.ok(r.carry > 0.138 && r.carry < 0.139);
});
test('Review: 60 s frame gap -> 8 ticks, carry reset', () => assert.deepEqual(ticksForFrame(60000, 1, 0), { ticks: 8, carry: 0 }));
test('exactly the cap keeps its carry', () => assert.equal(ticksForFrame(150000 * 8 / 208, 1, 0).ticks, 8));
