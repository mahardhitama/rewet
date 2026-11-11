import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPORT, DEBRIEF, MENU } from '../src/strings.js';

test('REPORT.rows joins to the old report lines', () => {
  const j = rows => rows.map(([l, v]) => `${l}: ${v}`);
  assert.deepEqual(j(REPORT.rows('12', { alive: 3, planted: 5 }, 40, 2000, 3500)), [
    'Burnt so far: 12% of the site',
    'Seedling survival: 3/5 planted this year',
    'Village goodwill: 40',
    'Grant received: +2000 · Funds now 3500',
  ]);
  assert.equal(REPORT.rows('0', { alive: 0, planted: 0 }, 0, 0, 0)[1].join(': '), 'Seedling survival: none planted this year');
});

test('REPORT.speciesRow', () => {
  assert.deepEqual(REPORT.speciesRow(['A', 'B']), ['Species seen', '2', 'A, B']);
  assert.deepEqual(REPORT.speciesRow([]), ['Species seen', '0', '']);
});

test('DEBRIEF rows have 3 cells', () => {
  const r = { rewetPct: 80, coverPct: 20, goodwill: 50 }, p = { rewet: 60, reveg: 40, revit: 30 };
  const g = DEBRIEF.goalRows(r, p);
  assert.equal(g.length, 3);
  for (const row of g) assert.equal(row.length, 3);
  assert.deepEqual(g.map(x => x[0][0]), ['✓', '✗', '✓']);
  assert.equal(g[0][2], '60%');
  assert.deepEqual(g, [
    ['✓ Rewetting', '80% of the peat stayed wet through the last dry season', '60%'],
    ['✗ Revegetation', 'new forest cover is 20%', '40%'],
    ['✓ Revitalisation', 'village goodwill is 50', '30'],
  ]);
  assert.deepEqual(DEBRIEF.figureRows(r), [
    ['Rewetting', '80% of the peat stayed wet through the last dry season'],
    ['Revegetation', 'new forest cover is 20%'],
    ['Revitalisation', 'village goodwill is 50'],
  ]);
  assert.equal(DEBRIEF.figureHead.length, 2);
  assert.deepEqual(DEBRIEF.dataRows({ avoidedTCO2: 4.25, fireTCO2: 0 }, { alive: 1, planted: 2 }), [
    ['Drainage emissions avoided', '4.3 t CO2'],
    ['Fire emissions', '0.0 t CO2'],
    ['Seedling survival', '1/2'],
  ]);
});

test('MENU rows', () => {
  assert.deepEqual(MENU.found(3, 11), ['Wildlife found', '3 of 11']);
  assert.deepEqual(MENU.stars(4, 18), ['Stars', '4 of 18']);
});
