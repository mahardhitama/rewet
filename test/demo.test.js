import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMOS, newDemo, demoStep } from '../src/demo.js';
import { HOWTO } from '../src/strings.js';
import { LEVELS } from '../src/levels.js';
import { resolveLevel } from '../src/sim/mapgen.js';
import { KIND, WET_WT } from '../src/sim/world.js';

const keyOf = x => x.demo ?? x.icon;
const run = d => { const done = []; while (d.t < d.ticks) done.push(...demoStep(d)); return done; };

test('each how-to item has a demo', () => {
  for (const items of Object.values(HOWTO.items)) for (const x of items) assert.ok(DEMOS[keyOf(x)], keyOf(x));
});

// Help in a level shows the items of that level and of all levels before it, on that level's map.
test('on each level seed, each demo up to that level finds its site and each scripted step works', () => {
  const bad = [];
  for (const L of LEVELS) for (const seed of L.seeds) {
    const level = resolveLevel({ ...L, seed });
    for (const x of LEVELS.filter(M => M.id <= L.id).flatMap(M => HOWTO.items[M.id] ?? [])) {
      const d = newDemo(level, keyOf(x));
      if (!d.plan.length && keyOf(x) !== 'wetLine') bad.push(`${L.id}/${seed} ${d.key}: no site`);
      for (const [id, i, ok] of run(d)) if (!ok) bad.push(`${L.id}/${seed} ${d.key}: ${id} at ${i}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the cascade demo ends with more wet peat than one block', () => {
  const level = resolveLevel({ ...LEVELS[3], seed: LEVELS[3].seed });
  const wet = d => { run(d); const wd = d.g.world; let n = 0; for (let i = 0; i < wd.n; i++) n += wd.kind[i] === KIND.PEAT && wd.wt[i] <= WET_WT; return n; };
  assert.ok(wet(newDemo(level, 'cascade')) > wet(newDemo(level, 'tempBlock')));
});
