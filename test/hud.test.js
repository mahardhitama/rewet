import test from 'node:test';
import assert from 'node:assert/strict';
import { HUD } from '../src/strings.js';

const time = { year: 1, years: 5, wet: true, week: 2 };

test('HUD.parts returns the 6 parts with labels, values and accessible names', () => {
  const p = HUD.parts(time, 3600, 2, 3, 40, 45, null, false);
  assert.deepEqual(p.map(x => x.id), ['time', 'funds', 'crew', 'goodwill', 'wet', 'score']);
  assert.deepEqual(p[0], { id: 'time', label: '', value: 'Year 1/5 · Wet season · wk 2', full: 'Year 1/5 · Wet season · wk 2' });
  assert.deepEqual(p[1], { id: 'funds', label: 'Funds', value: '3600', full: 'Funds 3600' });
  assert.equal(p[2].full, 'Crews 2/3');
  assert.equal(p[4].full, 'Wet now 45%');
  assert.equal(p[5].full, 'Dry-season wet – (scored)');
  assert.equal(HUD.parts(time, 0, 0, 0, 0, 0, 12, false)[5].full, 'Dry-season wet 12% (scored)');
});

test('HUD.parts uses the short time value on a phone and keeps the long name', () => {
  const t = HUD.parts(time, 0, 0, 0, 0, 0, null, true)[0];
  assert.equal(t.value, '1/5 · Wet · wk 2');
  assert.equal(t.full, 'Year 1/5 · Wet season · wk 2');
});
