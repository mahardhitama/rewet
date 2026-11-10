import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SAVE, loadSave, writeSave, clearSave, recordResult, buyUpgrade, availableStars, SAVE_KEY } from '../src/save.js';

const mem = (init = {}) => {
  const d = { ...init };
  return { d, getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; } };
};

test('Review: corrupt JSON -> DEFAULT_SAVE, no throw', () => {
  assert.deepEqual(loadSave(mem({ [SAVE_KEY]: '{not json' })), DEFAULT_SAVE);
  assert.deepEqual(loadSave(mem({ [SAVE_KEY]: '42' })), DEFAULT_SAVE);
  assert.deepEqual(loadSave(mem({ [SAVE_KEY]: 'null' })), DEFAULT_SAVE);
});

test('Review: getItem throws (blocked storage) -> DEFAULT_SAVE', () => {
  const blocked = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('Quota'); } };
  const s = loadSave(blocked);
  assert.deepEqual(s, DEFAULT_SAVE);
  assert.notEqual(s, DEFAULT_SAVE); // a copy: mutating it never corrupts the default
  assert.equal(writeSave(blocked, s), false);
});

test('Review: version 0 save -> DEFAULT_SAVE', () => {
  const old = { ...DEFAULT_SAVE, version: 0, unlocked: 5 };
  assert.deepEqual(loadSave(mem({ [SAVE_KEY]: JSON.stringify(old) })), DEFAULT_SAVE);
});

test('save round-trips and sanitizes junk fields', () => {
  const st = mem();
  const s = recordResult(DEFAULT_SAVE, 1, 2);
  assert.equal(writeSave(st, s), true);
  assert.deepEqual(loadSave(st), s);
  st.d[SAVE_KEY] = JSON.stringify({ version: 1, unlocked: 99, stars: { 1: 9, x: 3 }, upgrades: { crew: 5 }, extra: 1 });
  assert.deepEqual(loadSave(st), DEFAULT_SAVE);
});

test('recordResult keeps best and unlocks next only on pass', () => {
  let s = recordResult(DEFAULT_SAVE, 1, 0);
  assert.equal(s.unlocked, 1); assert.deepEqual(s.stars, {});
  s = recordResult(s, 1, 2);
  assert.equal(s.unlocked, 2); assert.equal(s.stars[1], 2);
  s = recordResult(s, 1, 1);
  assert.equal(s.stars[1], 2); // best kept
  s = recordResult(s, 1, 0);
  assert.equal(s.unlocked, 2); // never decreases
  s = recordResult(s, 6, 1);
  assert.equal(s.unlocked, 7);
  assert.equal(recordResult(DEFAULT_SAVE, 7, 3).unlocked, 7);
  assert.deepEqual(DEFAULT_SAVE.stars, {}); // input not mutated
});

test('buyUpgrade refuses when stars insufficient', () => {
  assert.deepEqual(buyUpgrade(DEFAULT_SAVE, 'crew'), { error: 'stars' });
  assert.deepEqual(buyUpgrade(DEFAULT_SAVE, 'nope'), { error: 'unknown' });
  assert.deepEqual(buyUpgrade(DEFAULT_SAVE, 'toString'), { error: 'unknown' });
  let s = { ...DEFAULT_SAVE, stars: { 1: 3, 2: 3, 3: 1 } }; // 7 stars
  s = buyUpgrade(s, 'crew');
  assert.equal(s.upgrades.crew, 1); assert.equal(availableStars(s), 4);
  assert.deepEqual(buyUpgrade(s, 'crew'), { error: 'owned' });
  s = buyUpgrade(s, 'fastCrew');
  assert.equal(availableStars(s), 0);
  assert.deepEqual(buyUpgrade(s, 'cheapBlocks'), { error: 'stars' });
});

test('migration: rewet_mute folds into rewet_v1, old keys removed; no old keys -> no write', () => {
  const st = mem({ rewet_mute: '1', rewet_save: '{"started":true}' });
  const s = loadSave(st);
  assert.equal(s.settings.mute, true);
  assert.deepEqual(Object.keys(st.d), [SAVE_KEY]);
  assert.equal(loadSave(st).settings.mute, true);
  const empty = mem();
  assert.deepEqual(loadSave(empty), DEFAULT_SAVE);
  assert.deepEqual(empty.d, {});
});

test('clearSave removes the key and survives blocked storage', () => {
  const st = mem({ [SAVE_KEY]: '{}' });
  clearSave(st); assert.equal(st.getItem(SAVE_KEY), null);
  clearSave({ removeItem() { throw new Error('x'); } });
});
