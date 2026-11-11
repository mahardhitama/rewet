import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FRAMES, CREW, PS, crewPlan, crewPal, crewSeen, crewSweep, crewPhase, guardPose, resetCrews, crewCount, WALK_MS, STAY_MS } from '../src/render/crew.js';
import { ACTIONS } from '../src/sim/game.js';
import { KIND } from '../src/sim/world.js';

const KEYS = new Set('kspht mwgbe'.replace(' ', ''));

test('each pose has 2 frames that fit the sprite, with known keys, feet on the bottom row', () => {
  for (const [pose, frames] of Object.entries(FRAMES)) {
    assert.equal(frames.length, 2, pose);
    for (const rows of frames) {
      assert.ok(rows.length <= PS, pose);
      for (const r of rows) {
        assert.ok(r.length <= PS, `${pose}: ${r}`);
        for (const ch of r) assert.ok(ch === '.' || KEYS.has(ch), `${pose}: ${ch}`);
      }
      assert.ok(/[pb]/.test(rows.at(-1)), `${pose}: feet row`);
    }
  }
});

test('each action has a crew with poses that exist', () => {
  for (const id of [...Object.keys(ACTIONS), 'guard']) {
    const c = CREW[id];
    assert.ok(c, id);
    assert.ok(c.poses.length >= 2, id);
    for (const p of c.poses) assert.ok(FRAMES[p], `${id}: ${p}`);
    assert.ok(c.size[0] >= 1 && c.size[1] <= 3 && c.size[0] <= c.size[1], id);
  }
});

const W = 10, H = 10, kind = new Uint8Array(W * H);
kind[0] = KIND.VILLAGE; // the village is at the top-left corner

test('crewPlan: size in range, same plan for the same key, 2 tiles differ', () => {
  for (const id of Object.keys(ACTIONS)) for (let i = 0; i < 40; i++) {
    const p = crewPlan(id, 55, `${id}:${i}`, W, H, kind);
    assert.ok(p.length >= CREW[id].size[0] && p.length <= CREW[id].size[1], id);
  }
  assert.deepEqual(crewPlan('tempBlock', 55, 'a', W, H, kind), crewPlan('tempBlock', 55, 'a', W, H, kind));
  const sig = k => JSON.stringify(crewPlan('tempBlock', 55, k, W, H, kind).map(m => [m.pose, m.pal.s, m.ox]));
  assert.ok(Array.from({ length: 20 }, (_, k) => sig('x' + k)).some(s => s !== sig('x0')));
});

test('crewPlan: plant crew on different tiles; walk in from the nearest village', () => {
  const p = crewPlan('plant', 55, 'plant:55:9', W, H, kind, [55, 56, 65]);
  if (p.length > 1) assert.ok(new Set(p.map(m => m.tile)).size > 1);
  const [m] = crewPlan('well', 55, 'w', W, H, kind); // tile (5, 5); village (0, 0)
  assert.ok(Math.abs(Math.hypot(m.from[0] - 5, m.from[1] - 5) - 2) < 1e-9);
  assert.ok(m.from[0] < 5 && m.from[1] < 5);
  const [q] = crewPlan('well', 55, 'w', W, H, new Uint8Array(W * H)); // no village: from the bottom of the screen
  assert.ok(q.from[0] > 5 && q.from[1] > 5);
});

test('fire crew wears the fire palette', () => {
  for (const m of crewPlan('fireCrew', 5, 'f', W, H, kind)) assert.equal(m.pal.hat, 'helmet');
  assert.equal(crewPal(1, 0, true).s, '#e8c030');
});

test('crew life: fade in, minimum stay, walk away, delete', () => {
  const m = new Map(), make = () => [];
  const s = crewSeen('j', 1000, 1, make, m);
  assert.equal(crewPhase(s, 1000).alpha, 0);
  assert.equal(crewPhase(s, 1000 + WALK_MS / 2).alpha, 1);
  assert.equal(crewPhase(s, 1000 + WALK_MS).t, 1);
  crewSweep(1000, 1, m);
  crewSweep(1200, 2, m); // the job ended at 1200
  assert.equal(s.leaveAt, 1000 + WALK_MS + STAY_MS);
  assert.ok(crewPhase(s, 1300).walking); // still walks in after the job ended
  assert.equal(crewPhase(s, s.leaveAt - 1).t, 1); // works until the stay ends
  assert.equal(crewPhase(s, s.leaveAt + WALK_MS).alpha, 0);
  crewSweep(s.leaveAt + WALK_MS - 1, 3, m);
  assert.equal(m.size, 1);
  crewSweep(s.leaveAt + WALK_MS, 4, m);
  assert.equal(m.size, 0);
});

test('resetCrews empties the crew map', () => {
  resetCrews();
  crewSeen('k', 0, 1, () => []);
  assert.equal(crewCount(), 1);
  resetCrews();
  assert.equal(crewCount(), 0);
});

test('guard pose changes within 6 s and uses at least 3 poses in 30 s', () => {
  for (const i of [3, 17, 42]) {
    assert.notEqual(guardPose(i, 0), guardPose(i, 6000)) ;
    assert.ok(new Set(Array.from({ length: 30 }, (_, s) => guardPose(i, s * 1000))).size >= 3);
  }
});
