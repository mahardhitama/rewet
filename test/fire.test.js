import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, KIND } from '../src/sim/world.js';
import { FIRE, ignite, fireTick } from '../src/sim/fire.js';

const mk = (w, h, seed, wt) => {
  const world = createWorld({ w, h, seed });
  world.wt.fill(wt);
  world.cover.fill(1);
  return world;
};
const DRY = { week: 40, dry: 1, L: 100 };
const OFF = { week: 0, dry: 0, L: 45 };

test('T3 wet peat never ignites', () => {
  const world = mk(10, 10, 1, 0.3);
  for (let i = 0; i < world.n; i++) assert.equal(ignite(world, i), false);
  for (let t = 0; t < 10000; t++) fireTick(world, DRY, [0, 0]);
  assert.equal(world.fire.reduce((a, b) => a + b, 0), 0);
});

test('ignite refuses non-peat/farm tiles and sets cover 0', () => {
  const world = mk(3, 3, 1, 0.6);
  world.kind[0] = KIND.VILLAGE;
  assert.equal(ignite(world, 0), false);
  assert.equal(world.fire[0], 0);
  assert.equal(ignite(world, 4), true);
  assert.equal(world.fire[4], 1);
  assert.equal(world.fireT[4], FIRE.surfaceTicks);
  assert.equal(world.cover[4], 0);
  assert.equal(ignite(world, 4), false);
});

test('fire spreads downwind more', () => {
  let east = 0, west = 0;
  const c = 20;
  for (let s = 0; s < 50; s++) {
    const world = mk(41, 41, s + 1, 0.6);
    ignite(world, c * 41 + c);
    for (let t = 0; t < 6; t++) fireTick(world, OFF, [1, 0]);
    for (let i = 0; i < world.n; i++) if (world.fire[i] || world.cover[i] === 0) {
      const x = i % 41;
      if (x > c) east++; else if (x < c) west++;
    }
  }
  assert.ok(east > west * 1.3, `east ${east} west ${west}`);
});

test('smouldering flares again only if dry', () => {
  for (const [wt, want] of [[0.6, 1], [0.2, 0]]) {
    const world = mk(3, 3, 1, wt);
    world.fire[4] = 2; world.fireT[4] = 1;
    const { burnt } = fireTick(world, OFF, [0, 0]);
    assert.equal(world.fire[4], want);
    assert.deepEqual(burnt, want ? [4] : []);
  }
});

test('surface fire ends in smoulder or out, deterministic per seed', () => {
  const run = (seed) => {
    const world = mk(1, 1, seed, 0.6);
    ignite(world, 0);
    for (let t = 0; t < FIRE.surfaceTicks; t++) fireTick(world, OFF, [0, 0]);
    return world.fire[0];
  };
  const outs = new Set();
  for (let s = 0; s < 40; s++) { outs.add(run(s)); assert.equal(run(s), run(s)); }
  assert.deepEqual([...outs].sort(), [0, 2]);
});

test('spontaneous ignition happens on dry peat in dry season', () => {
  const world = mk(40, 40, 3, 1.0);
  let n = 0;
  for (let t = 0; t < 20; t++) n += fireTick(world, DRY, [0, 0]).burnt.length;
  assert.ok(n > 0);
});
