import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cue, resetCues, setMuted, CUES, sfx, SFX, setAmbience, slendro, phrase } from '../src/audio.js';

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

test('slendro has 5 notes per octave and doubles each octave', () => {
  for (let n = -7; n < 12; n++) {
    assert.ok(Math.abs(slendro(n + 5, 233) / slendro(n, 233) - 2) < 1e-9);
    assert.ok(slendro(n + 1, 233) > slendro(n, 233));
  }
  assert.equal(slendro(0, 220), 220);
});

test('phrase is deterministic, has 8 beats in range and ends on a stable note', () => {
  for (const h of [0, 0.5, 1]) for (let seed = 1; seed <= 20; seed++) {
    const p = phrase(seed, h);
    assert.deepEqual(p, phrase(seed, h));
    assert.equal(p.length, 8);
    assert.ok(p.every(s => s >= -1 && s <= 7));
    assert.ok([0, 2, 4].includes(p[7]));
  }
  const notes = h => { let n = 0; for (let s = 1; s <= 50; s++) n += phrase(s, h).filter(x => x >= 0).length; return n; };
  assert.ok(notes(1) > notes(0)); // health makes it denser
});

test('sfx throttles per name, obeys mute and does not throw without AudioContext', () => {
  setMuted(false);
  assert.equal(sfx('wet', 0, 1000), true);
  assert.equal(sfx('wet', 1, 1050), false);
  assert.equal(sfx('done', 0, 1050), true); // the gap is per name
  assert.equal(sfx('wet', 2, 1000 + SFX.wet.gap), true);
  assert.equal(sfx('nope', 0, 5000), false);
  setMuted(true); assert.equal(sfx('deny', 0, 9000), false); setMuted(false);
  for (const n of Object.keys(SFX)) assert.doesNotThrow(() => sfx(n, 2, 1e6));
});

test('setAmbience and mute are no-ops without AudioContext', () => {
  assert.doesNotThrow(() => { setAmbience({ on: true, rain: true, health: 0.8, fire: 0.2 }); setMuted(true); setMuted(false); setAmbience({ on: false }); });
});

test('a fire makes the music beat faster', async () => {
  const { beatLen } = await import('../src/audio.js');
  assert.ok(beatLen(0.125) < beatLen(0) / 1.5);
  assert.equal(beatLen(0), beatLen(0));
});
