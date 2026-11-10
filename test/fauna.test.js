import test from 'node:test';
import assert from 'node:assert/strict';
import { FAUNA, MAX_FAUNA, faunaTick } from '../src/sim/fauna.js';
import { SPECIES } from '../src/journal.js';
import { LEVELS, buildLevelWorld } from '../src/levels.js';
import { resolveLevel } from '../src/sim/mapgen.js';
import { createGame, applyAction, step } from '../src/sim/game.js';
import { blockPlan } from '../scripts/auto-plan.js';
import { TICKS_PER_YEAR } from '../src/sim/season.js';
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
    for (const a of g.fauna) assert.ok(a.leaving || rule(a)(g, a.i), `${a.species} at ${a.i}`);
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

const green = (g) => {
  const wd = g.world;
  for (let i = 0; i < wd.n; i++) if (wd.kind[i] === KIND.PEAT) { wd.cover[i] = 1; wd.wt[i] = 0.1; }
  return g;
};
const cheb = (w, a, b) => Math.max(Math.abs((a % w) - (b % w)), Math.abs(((a / w) | 0) - ((b / w) | 0)));
const nearFire = (g) => {
  const { w, fire, n } = g.world;
  return g.fauna.filter((a) => { for (let i = 0; i < n; i++) if (fire[i] && cheb(w, a.i, i) <= 2) return true; return false; });
};

test('a full green wet map reaches exactly MAX_FAUNA animals', () => {
  const l = resolveLevel(LEVELS.find((x) => x.id === 6)); // has a river, so every species has a habitat
  const g = green(createGame(l, {}, buildLevelWorld(l)));
  for (let t = 0; t < 100; t++) faunaTick(g);
  assert.equal(g.fauna.length, MAX_FAUNA);
});

test('spawn never places an animal within 2 tiles of fire', () => {
  const g = green(L1()), { w, h, fire } = g.world;
  for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) fire[y * w + x] = 1; // every tile is within 2 of a fire
  for (let t = 0; t < 50; t++) { faunaTick(g); assert.deepEqual(nearFire(g), []); }
  assert.equal(g.fauna.length, 0);
});

test('move never steps an animal within 2 tiles of fire', () => {
  const g = green(L1()), { w, fire } = g.world;
  for (let t = 0; t < 100; t++) faunaTick(g);
  for (let r = 0; r < 20; r++) {
    fire.fill(0);
    for (const a of g.fauna) { // fire 3 tiles away: the animal stays, but a step toward it must be refused
      const x = (a.i % w) + (a.i % w < w - 3 ? 3 : -3);
      fire[(((a.i / w) | 0) * w) + x] = 1;
    }
    for (const a of nearFire(g)) fire[a.i] = 0; // keep the test about moves: drop fires that already cover an animal
    faunaTick(g);
    assert.deepEqual(nearFire(g), []);
  }
});

test('balance: a restored map shows more wildlife than a neglected one (L1, L2)', () => {
  // mean over the weekly steps of the final year: one end tick is too noisy now that animals come and go
  const final = (level, plan) => {
    const g = createGame(level, {}, buildLevelWorld(level));
    let k = 0, all = 0, forest = 0, steps = 0;
    for (let t = 0; t < level.years * TICKS_PER_YEAR; t++) {
      for (; k < plan.length && plan[k].tick <= t; k++) applyAction(g, plan[k].id, plan[k].y * level.size + plan[k].x);
      step(g);
      if (t >= (level.years - 1) * TICKS_PER_YEAR && g.tick % 4 === 0) {
        steps++; all += g.fauna.length; forest += g.fauna.filter((a) => FOREST.includes(a.species)).length;
      }
    }
    return { all: all / steps, forest: forest / steps };
  };
  for (const id of [1, 2]) {
    const level = resolveLevel(LEVELS.find((l) => l.id === id));
    const none = final(level, []), plan = final(level, blockPlan(level));
    assert.ok(plan.forest > none.forest, `L${id} forest ${plan.forest} vs ${none.forest}`);
    assert.ok(plan.all >= none.all + 1, `L${id} total ${plan.all} vs ${none.all}`);
  }
});

// run a level with its blockPlan; each(g) runs after each step
function runPlan(id, years, each) {
  const level = resolveLevel(LEVELS.find((l) => l.id === id));
  const plan = blockPlan(level), g = createGame(level, {}, buildLevelWorld(level));
  let k = 0;
  for (let t = 0; t < (years ?? level.years) * TICKS_PER_YEAR; t++) {
    for (; k < plan.length && plan[k].tick <= t; k++) applyAction(g, plan[k].id, plan[k].y * level.size + plan[k].x);
    step(g);
    each?.(g);
  }
  return g;
}
const edgeDist = (w, h, i) => Math.min(i % w, ((i / w) | 0), w - 1 - (i % w), h - 1 - ((i / w) | 0));

test('wildlife: at most 8 animals, one tile per step, stay is bounded, leaving animals walk to the edge (L1 to L6)', () => {
  assert.equal(MAX_FAUNA, 8);
  for (const id of [1, 2, 3, 4, 5, 6]) {
    const prev = new Map();
    runPlan(id, null, (g) => {
      const { w, h } = g.world;
      assert.ok(g.fauna.length <= 8, `L${id} count ${g.fauna.length}`);
      for (const a of g.fauna) {
        const p = prev.get(a.id);
        if (p) {
          assert.ok(Math.abs((a.i % w) - (p.i % w)) <= 1 && Math.abs(((a.i / w) | 0) - ((p.i / w) | 0)) <= 1, `L${id} ${a.species} jumped`);
          if (a.i !== p.i) { assert.equal(a.from, p.i); assert.equal(a.moved, g.tick - 1); }
          if (p.leaving) assert.ok(edgeDist(w, h, a.i) <= edgeDist(w, h, p.i), `L${id} ${a.species} walks away from the edge`);
        } else { assert.equal(a.from, a.i); assert.equal(a.moved, a.born); }
        assert.ok(g.tick - 1 <= a.leave + 4 * (w + h), `L${id} ${a.species} stays too long`);
        assert.ok(a.leave - a.born >= 16 && a.leave - a.born <= 52 && (a.leave - a.born) % 4 === 0);
        prev.set(a.id, { i: a.i, leaving: a.leaving });
      }
    });
  }
});

test('wildlife: the spawn mix differs between wet and dry weeks for at least 3 species (L6, 3 years)', () => {
  const wet = {}, dry = {}, seen = new Set();
  runPlan(6, 3, (g) => {
    for (const a of g.fauna) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      const o = a.born % TICKS_PER_YEAR / 4 < 31 ? wet : dry; // born is the tick of the faunaTick call
      o[a.species] = (o[a.species] || 0) + 1;
    }
  });
  const differ = FAUNA.filter((f) => (wet[f.id] || 0) !== (dry[f.id] || 0)).length;
  assert.ok(differ >= 3, JSON.stringify({ wet, dry }));
});

test('wildlife: an animal past its stay is leaving', () => {
  const g = green(L1());
  for (let t = 0; t < 100; t++) faunaTick(g);
  g.tick = Math.max(...g.fauna.map((a) => a.leave));
  faunaTick(g);
  assert.ok(g.fauna.every((a) => a.leaving || a.leave > g.tick));
});
