import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { LEVELS, buildLevelWorld } from '../src/levels.js';
import { resolveLevel } from '../src/sim/mapgen.js';
import { KIND, BLOCK } from '../src/sim/world.js';
import { taught, inspect } from '../src/ui.js';
import { noteMs } from '../src/main.js';

test('a level shows only the actions that it or an earlier level teaches', () => {
  assert.deepEqual([...taught(1)].sort(), ['fireCrew', 'permBlock', 'tempBlock']);
  assert.deepEqual([...taught(2)].sort(), ['fireCrew', 'mound', 'permBlock', 'plant', 'tempBlock']);
  assert.ok(taught(4).has('backfill') && !taught(4).has('well'));
  assert.equal(taught(LEVELS.length + 1).size, 10); // the sandbox: all actions
});

test('the tile readout gives the kind, the water-table depth and what it means', () => {
  const L = resolveLevel(LEVELS[0]), g = createGame(L, {}, buildLevelWorld(L)), wd = g.world;
  const peat = wd.kind.indexOf(KIND.PEAT), canal = wd.kind.indexOf(KIND.CANAL);
  wd.wt[peat] = 0.62; wd.fire[peat] = 0;
  let [a, b] = inspect(g, peat);
  assert.match(a, /Peat/); assert.match(a, /62 cm/); assert.match(b, /burn/);
  wd.wt[peat] = 0.2; [a, b] = inspect(g, peat);
  assert.match(a, /20 cm/); assert.match(b, /^Wet/);
  wd.wt[peat] = -0.1; [a, b] = inspect(g, peat);
  assert.match(a, /10 cm above/); assert.match(b, /drown/);
  wd.fire[peat] = 1; assert.match(inspect(g, peat)[1], /Fire crew/);
  [a, b] = inspect(g, canal);
  assert.match(a, /Canal/); assert.match(b, /drains/);
  wd.block[canal] = BLOCK.PERM; assert.match(inspect(g, canal)[0], /permanent/);
});

test('a note stays 3 to 9 s, longer for more words', () => {
  assert.equal(noteMs('Hi.'), 3000);
  assert.equal(noteMs('word '.repeat(60)), 9000);
  assert.ok(noteMs('one two three four five six seven eight nine ten') > 3000);
});
