import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ICONS, PAL, iconRects } from '../src/icons.js';

// The icon names in spec section 3 (docs/superpowers/specs/2026-11-10-rewet-ui-layout-design.md).
const NAMES = ['time', 'funds', 'crew', 'goodwill', 'wet', 'score', 'pause', 'play', 'fast', 'data', 'journal',
  'tempBlock', 'permBlock', 'backfill', 'well', 'plant', 'mound', 'palud', 'pond', 'fireGroup', 'fireCrew',
  'zoomIn', 'zoomOut', 'fit', 'new', 'continue', 'settings', 'credits', 'back', 'close', 'sound', 'replay',
  'delete', 'level', 'sandbox', 'upgrade', 'menu', 'tree'];

test('each spec name has an icon', () => {
  for (const n of NAMES) assert.ok(ICONS[n], n);
});

test('each icon is 12 rows of 12 known characters', () => {
  for (const [n, rows] of Object.entries(ICONS)) {
    assert.equal(rows.length, 12, `${n} rows`);
    rows.forEach((r, y) => {
      assert.equal(r.length, 12, `${n} row ${y} length`);
      for (const ch of r) assert.ok(ch === ' ' || ch === '#' || ch in PAL, `${n} row ${y}: "${ch}"`);
    });
  }
});

test('iconRects is deterministic', () => {
  assert.deepEqual(iconRects('tree'), iconRects('tree'));
});

test('iconRects covers each non-space pixel once', () => {
  for (const [n, rows] of Object.entries(ICONS)) {
    const px = rows.join('').replace(/ /g, '').length;
    assert.equal(iconRects(n).reduce((s, r) => s + r.w, 0), px, n);
  }
});

test('iconRects fills: # is currentColor, a letter is its PAL hex', () => {
  const fills = new Set(iconRects('tree').map(r => r.fill));
  assert.ok(fills.has(PAL.g) && fills.has(PAL.b));
  assert.ok(iconRects('close').every(r => r.fill === 'currentColor'));
});
