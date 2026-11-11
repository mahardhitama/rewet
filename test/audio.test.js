import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cue, resetCues, setMuted, CUES } from '../src/audio.js';

test('cue plays each sim event type once per gap', () => {
  resetCues(); setMuted(false);
  assert.equal(cue('fireSpotted', 0), true);
  assert.equal(cue('fireSpotted', 100), false); // many fires in one tick give one crackle
  assert.equal(cue('villageFire', 100), true); // the gap is per type
  assert.equal(cue('fireSpotted', CUES.fireSpotted.gap), true);
});

test('cue is silent when muted or for an unknown type', () => {
  resetCues();
  setMuted(true); assert.equal(cue('yearEnd', 0), false);
  setMuted(false); assert.equal(cue('nope', 0), false);
  assert.equal(cue('yearEnd', 0), true); // a muted call does not start the gap
});

test('each sim event type has a cue', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/sim/game.js', import.meta.url), 'utf8');
  for (const [, t] of src.matchAll(/events\.push\(\{ type: '(\w+)'/g)) assert.ok(CUES[t], t);
});
