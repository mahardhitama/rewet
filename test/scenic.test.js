import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, scenicStep } from '../src/sim/game.js';
import { LEVELS } from '../src/levels.js';

test('scenicStep moves water and time on, but puts out fire and keeps cover, funds and jobs', () => {
  const g = createGame(LEVELS[0]);
  for (let k = 0; k < 130; k++) step(g); // into the dry season
  g.events.length = 0;
  g.world.fire[5] = 1; g.world.fireT[5] = 9;
  const cover = Float32Array.from(g.world.cover), funds = g.funds, wt = Float32Array.from(g.world.wt), t = g.tick;
  for (let k = 0; k < 40; k++) scenicStep(g);
  assert.equal(g.tick, t + 40);
  assert.equal(g.world.fire.reduce((a, b) => a + b, 0), 0);
  assert.deepEqual(g.world.cover, cover);
  assert.equal(g.funds, funds);
  assert.ok(g.world.wt.some((v, i) => v !== wt[i]), 'the water table moves');
  assert.equal(g.events.length, 0);
});
