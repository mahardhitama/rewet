import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOWTO, ACTION_TEXT } from '../src/strings.js';
import { LEVELS } from '../src/levels.js';
import { ICONS } from '../src/icons.js';

const icons = id => HOWTO.items[id].map(x => x.icon);
const all = id => HOWTO.items[id].map(x => `${x.name} ${x.text}`).join(' ');

test('HOWTO has items for each level but the last, and each item has a real icon and text', () => {
  for (const L of LEVELS.slice(0, -1)) {
    const items = HOWTO.items[L.id];
    assert.ok(items?.length, `level ${L.id} has no items`);
    for (const x of items) {
      assert.ok(ICONS[x.icon], `level ${L.id}: no icon ${x.icon}`);
      assert.ok(x.name && x.text, `level ${L.id}: empty item`);
    }
  }
  assert.equal(HOWTO.items[LEVELS.length], undefined); // nothing new on the last level: no dialog at its start
  assert.equal(HOWTO.items[LEVELS.length + 1], undefined); // the sandbox has no dialog
});

test('level 1 shows the basics: blocks, the 40 cm line and fire crews', () => {
  for (const i of ['tempBlock', 'permBlock', 'fireCrew']) assert.ok(icons(1).includes(i), i);
  assert.match(all(1), /40 cm/);
  assert.match(all(1), /arrow/); // the water flow slide
});

test('each later level shows only what is new in it', () => {
  assert.deepEqual(icons(2), ['plant', 'mound']);
  assert.ok(['palud', 'pond', 'fireGroup'].every(i => icons(3).includes(i)));
  assert.match(all(3), /arson/i);
  assert.ok(icons(4).includes('backfill'));
  assert.match(all(4), /illegal canal/i);
  assert.match(all(4), /cascade/i);
  assert.ok(icons(5).includes('well'));
  assert.match(all(5), /smoulder/i);
  const seen = new Set();
  for (const L of LEVELS) for (const x of HOWTO.items[L.id] ?? []) { assert.ok(!seen.has(x.name), `level ${L.id} repeats ${x.name}`); seen.add(x.name); }
  for (let n = 2; n <= LEVELS.length; n++) for (const i of ['permBlock']) assert.ok(!(HOWTO.items[n] ?? []).some(x => x.icon === i), `level ${n} repeats ${i}`);
});

test('an action item uses the action name and the slot label of its button', () => {
  const plant = HOWTO.items[2][0];
  assert.ok(plant.name.includes(ACTION_TEXT.plant[0]) && plant.name.includes(ACTION_TEXT.plant[2]));
  assert.equal(HOWTO.title(LEVELS[0]), 'Level 1: Small drained plot');
});
