import test from 'node:test';
import assert from 'node:assert/strict';
import { FAUNA, MAX_FAUNA, faunaTick } from '../src/sim/fauna.js';
import { SPECIES } from '../src/journal.js';
import { LEVELS, buildLevelWorld } from '../src/levels.js';
import { resolveLevel } from '../src/sim/mapgen.js';
import { createGame, applyAction, step } from '../src/sim/game.js';
import { KIND } from '../src/sim/world.js';

const L1 = () => { const l = resolveLevel(LEVELS[0]); return createGame(l, {}, buildLevelWorld(l)); };
const rule = (a) => FAUNA.find((f) => f.id === a.species).rule;
const FOREST = ['orangutan', 'gibbon', 'langur', 'sunbear', 'hornbill'];

function run(g, steps, each) {
  for (let t = 0; t < steps; t++) {
    if (t === 0) applyAction(g, 'tempBlock', 21 * g.world.w + 18);
    step(g);
    each?.(g);
  }
}

test('species ids match SPECIES ids in src/journal.js', () => {
  assert.deepEqual(FAUNA.map((f) => f.id).sort(), SPECIES.map((s) => s.id).sort());
});

test('same seed and actions give the same fauna', () => {
  const a = L1(), b = L1();
  run(a, 400); run(b, 400);
  assert.ok(a.fauna.length > 0);
  assert.deepEqual(a.fauna, b.fauna);
});

test('faunaTick does not use world.rng', () => {
  const a = L1(), b = L1();
  for (let t = 0; t < 50; t++) faunaTick(a);
  assert.equal(a.world.rng(), b.world.rng());
});

test('animals stand only on tiles that meet their rule, and never exceed MAX_FAUNA', () => {
  const g = L1();
  run(g, 400, () => {
    assert.ok(g.fauna.length <= MAX_FAUNA);
    if ((g.tick - 1) % 4) return; // animals move only on the steps that call faunaTick
    for (const a of g.fauna) assert.ok(rule(a)(g, a.i), `${a.species} at ${a.i}`);
  });
});

test('no animal within 2 tiles of fire', () => {
  const g = L1();
  for (let t = 0; t < 40; t++) faunaTick(g);
  assert.ok(g.fauna.length > 0);
  const { w } = g.world;
  for (const a of g.fauna.slice()) g.world.fire[a.i + (a.i % w < w - 1 ? 1 : -1)] = 1;
  faunaTick(g);
  const lit = [];
  g.world.fire.forEach((f, i) => f && lit.push(i));
  for (const a of g.fauna) for (const i of lit)
    assert.ok(Math.max(Math.abs((a.i % w) - (i % w)), Math.abs(((a.i / w) | 0) - ((i / w) | 0))) > 2);
});

test('a wet green map has more animals than a dry bare map', () => {
  const mk = (cover, wt) => {
    const g = L1(), wd = g.world;
    for (let i = 0; i < wd.n; i++) if (wd.kind[i] === KIND.PEAT) { wd.cover[i] = cover; wd.wt[i] = wt; }
    for (let t = 0; t < 30; t++) faunaTick(g);
    return g;
  };
  const a = mk(1, 0.1), b = mk(0, 1.0);
  assert.ok(a.fauna.length > b.fauna.length);
  assert.ok(a.fauna.length <= MAX_FAUNA);
  assert.equal(b.fauna.filter((x) => FOREST.includes(x.species)).length, 0);
  assert.ok(a.fauna.some((x) => FOREST.includes(x.species)));
  for (const s of FOREST) assert.ok(!b.seen.has(s));
});
