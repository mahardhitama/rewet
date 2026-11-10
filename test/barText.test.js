import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTION_TEXT, SELECT_HINT } from '../src/strings.js';

// The action bar shows one name line and one how-to line. 32 characters fit on one line at 320 px.
test('each action bar line fits one line on a 320 px phone', () => {
  for (const s of [...SELECT_HINT, ...Object.values(ACTION_TEXT).map(a => a[1])]) assert.ok(s.length <= 32, `${s.length}: ${s}`);
});
