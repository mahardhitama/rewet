import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStory, storyAt } from '../src/render/introStory.js';
import { KIND, BLOCK, WET_WT } from '../src/sim/world.js';

const peat = (wd) => [...wd.kind.keys()].filter((i) => wd.kind[i] === KIND.PEAT);
const wetShare = (wd) => { const p = peat(wd); return p.filter((i) => wd.wt[i] <= WET_WT).length / p.length; };
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const count = (a, f) => a.reduce((s, v) => s + (f(v) ? 1 : 0), 0);

test('same seed builds the same story', () => {
  const a = buildStory(42), b = buildStory(42);
  assert.deepEqual(a.start.wt, b.start.wt);
  assert.deepEqual(a.end.cover, b.end.cover);
  assert.deepEqual(a.at, b.at);
});

test('h = 0 is dry with fire', () => {
  const s = buildStory(42); storyAt(s, 0);
  const wd = s.game.world;
  assert.ok(wetShare(wd) < 0.2);
  assert.ok(count(wd.fire, (f) => f > 0) >= 1);
});

test('h = 1 is wet, green, fire free and has animals', () => {
  const s = buildStory(42); storyAt(s, 0);
  const c0 = mean(s.game.world.cover);
  storyAt(s, 1);
  const wd = s.game.world;
  assert.ok(wetShare(wd) > 0.8);
  assert.equal(count(wd.fire, (f) => f > 0), 0);
  assert.ok(mean(wd.cover) > c0);
  assert.ok(s.game.fauna.length > 0);
});

test('blocks never disappear as h grows', () => {
  const s = buildStory(42);
  let last = 0;
  for (let k = 0; k <= 10; k++) {
    storyAt(s, k / 10);
    const n = count(s.game.world.block, (b) => b === BLOCK.PERM);
    assert.ok(n >= last);
    last = n;
  }
  assert.ok(last > 0);
});

test('storyAt is idempotent and clamps h', () => {
  const s = buildStory(42);
  storyAt(s, 0.5); const a = s.game.world.wt.slice();
  storyAt(s, 0.9); storyAt(s, 0.5);
  assert.deepEqual(s.game.world.wt, a);
  storyAt(s, 7); const hi = s.game.world.wt.slice();
  storyAt(s, 1);
  assert.deepEqual(s.game.world.wt, hi);
});

test('game holds every field drawWorld reads', () => {
  const g = buildStory(42).game;
  assert.equal(g.tick, 0);
  assert.deepEqual(g.jobs, []);
  for (const k of ['ponds', 'seedlings', 'wells', 'paluds', 'fireGroups']) assert.equal(g[k].size, 0);
  assert.ok(g.S);
});

test('different seeds give different maps', () => {
  assert.notDeepEqual(buildStory(1).game.world.kind, buildStory(2).game.world.kind);
});

test('water rises near the blocks first', () => {
  const s = buildStory(42); storyAt(s, 1);
  const wd = s.game.world, { w } = wd;
  const blocks = [...wd.block.keys()].filter((i) => wd.block[i] === BLOCK.PERM);
  const d = (i) => Math.min(...blocks.map((b) => Math.max(Math.abs((i % w) - (b % w)), Math.abs(((i / w) | 0) - ((b / w) | 0)))));
  const near = [], far = [];
  for (const i of peat(wd)) { const k = d(i); if (k <= 1) near.push(s.at[i]); else if (k > 5) far.push(s.at[i]); }
  assert.ok(near.length > 0 && far.length > 0);
  assert.ok(mean(near) < mean(far));
});

test('canal water rises behind the blocks', () => {
  const s = buildStory(42), wd = s.game.world;
  const canals = [...wd.kind.keys()].filter((i) => wd.kind[i] === KIND.CANAL && wd.cDepth[i] > 0);
  storyAt(s, 0); const c0 = mean(canals.map((i) => wd.cWater[i]));
  storyAt(s, 1); const c1 = mean(canals.map((i) => wd.cWater[i]));
  assert.ok(c1 < c0);
});

test('animals: at most 2 per species, at most 6, and none leave as h grows', () => {
  const s = buildStory(42); let last = 0;
  assert.ok(s.animals.length <= 6);
  const per = {};
  for (const a of s.animals) per[a.species] = (per[a.species] ?? 0) + 1;
  assert.ok(Object.values(per).every((c) => c <= 2));
  for (let k = 0; k <= 20; k++) {
    storyAt(s, k / 20);
    assert.ok(s.game.fauna.length >= last);
    last = s.game.fauna.length;
  }
  assert.equal(last, s.animals.length);
});
