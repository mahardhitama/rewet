import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ICONS } from '../src/icons.js';

// The icon names in spec section 3 (docs/superpowers/specs/2026-11-10-rewet-ui-layout-design.md).
const NAMES = ['time', 'funds', 'crew', 'goodwill', 'wet', 'score', 'pause', 'play', 'fast', 'data', 'journal',
  'tempBlock', 'permBlock', 'backfill', 'well', 'plant', 'mound', 'palud', 'pond', 'fireGroup', 'fireCrew',
  'zoomIn', 'zoomOut', 'fit', 'new', 'continue', 'settings', 'credits', 'back', 'close', 'sound', 'replay',
  'delete', 'level', 'sandbox', 'upgrade', 'menu', 'tree'];

test('each spec name has an icon', () => {
  for (const n of NAMES) assert.ok(ICONS[n], n);
});

test('each icon is SVG path data on the 24x24 grid, with whole-pixel moves', () => {
  for (const [n, d] of Object.entries(ICONS)) {
    assert.match(d, /^M[\d\s.MmHhVvZzLl-]+$/, n);
    for (const v of d.match(/-?\d+(\.\d+)?/g)) assert.ok(Number.isInteger(+v) && Math.abs(+v) <= 24, `${n}: ${v}`);
  }
});
