import { test } from 'node:test';
import assert from 'node:assert/strict';
import { downstream, canalStep, widthStep, canalMask, canalZone, DIRS } from '../src/render/iso.js';
import { KIND } from '../src/sim/world.js';

test('downstream picks the lowest lower canal or river neighbour', () => {
  const C = KIND.CANAL, P = KIND.PEAT, R = KIND.RIVER;
  // 3x3 grid, a canal on the middle row that runs into a river in the corner
  const kind = [P, P, P, C, C, C, P, P, R], z = [9, 9, 0, 3, 2, 1, 9, 9, 0.5];
  const ds = downstream(3, 3, Float32Array.from(z), Uint8Array.from(kind));
  assert.deepEqual([...ds], [-1, -1, -1, 4, 8, 8, -1, -1, -1]); // peat at z 0 is not a target
});

test('downstream gives -1 at a local low point', () => {
  const ds = downstream(2, 1, Float32Array.from([1, 1]), Uint8Array.from([KIND.CANAL, KIND.CANAL]));
  assert.deepEqual([...ds], [-1, -1]);
});

test('canal steps', () => {
  assert.equal(canalStep(0.75, 5), 0);
  assert.equal(canalStep(3.5, 5), 2);
  assert.equal(canalStep(5, 5), 3);
  assert.equal(canalStep(1, 0), 0);
  assert.deepEqual([4.9, 5, 8, 8.1].map(widthStep), [0, 1, 1, 2]);
});

// Map from rows of characters: c canal, r river, . peat.
const grid = rows => ({ w: rows[0].length, h: rows.length, kind: Uint8Array.from(rows.join(''), ch => ch === 'c' ? KIND.CANAL : ch === 'r' ? KIND.RIVER : KIND.PEAT) });
const dirs = m => DIRS.filter((_, k) => m >> k & 1).map(d => d.join(','));

test('canalMask: straight run, bend, junction and end tile', () => {
  const g = grid(['.....', 'ccccc', '..c..', '..c..', '..rr.']);
  assert.deepEqual(dirs(canalMask(g.w, g.h, g.kind, 6)), ['1,0', '-1,0']); // straight
  assert.deepEqual(dirs(canalMask(g.w, g.h, g.kind, 7)), ['1,0', '0,1', '-1,0']); // junction
  assert.deepEqual(dirs(canalMask(g.w, g.h, g.kind, 5)), ['1,0', '-1,0']); // end tile on the map edge: the arm runs off the map
  assert.deepEqual(dirs(canalMask(g.w, g.h, g.kind, 17)), ['0,1', '0,-1']); // into the river; the corner river tile is not joined
  const b = grid(['c..', '.c.', '.cc']); // a meander step on a corner, then a bend
  assert.deepEqual(dirs(canalMask(b.w, b.h, b.kind, 4)), ['0,1', '-1,-1']);
  assert.deepEqual(dirs(canalMask(b.w, b.h, b.kind, 7)), ['1,0', '0,-1']); // bend: the corner tile is joined through the side tile
});

const edgeDirs = (rows, x, y) => { const g = grid(rows); return dirs(canalMask(g.w, g.h, g.kind, y * g.w + x)); };

test('canalMask: a canal end on the map edge gets an arm off the map', () => {
  assert.deepEqual(edgeDirs(['.....', '.....', '..c..', '..c..', '..c..'], 2, 4), ['0,1', '0,-1']);
  assert.deepEqual(edgeDirs(['..c..', '..c..', '.....', '.....', '.....'], 2, 0), ['0,1', '0,-1']);
});

test('canalMask: a canal that runs along the edge gets no off-map arm', () => {
  assert.deepEqual(edgeDirs(['.....', '.....', '.....', '.....', '.ccc.'], 2, 4), ['1,0', '-1,0']);
});

test('canalMask: a canal end next to the river gets no off-map arm', () => {
  assert.deepEqual(edgeDirs(['.....', '.....', '..c..', '..c..', 'rrrrr'], 2, 3), ['0,1', '0,-1']);
});

test('canalMask: a canal end on a corner gets one off-map arm', () => {
  assert.deepEqual(edgeDirs(['.....', '.....', '.....', '.....', '...cc'], 4, 4), ['1,0', '-1,0']);
});

test('canalZone: two neighbours with the same steps meet without a seam', () => {
  for (const [dx, dy] of DIRS) for (let ws = 0; ws < 4; ws++) for (let cs = 0; cs < 3; cs++) {
    const a = { cs, ws, arms: [[dx, dy, cs], [-dx, -dy, cs]] }, sx = (dx - dy) * 16, sy = (dx + dy) * 8;
    // Pixels in a band around the midpoint between the two tile centres, in each tile's own frame.
    for (let py = -3; py <= 3; py++) for (let px = -3; px <= 3; px++) {
      const x = sx / 2 + px, y = 8 + sy / 2 + py;
      assert.equal(canalZone(x, y, a), canalZone(x - sx, y - sy, a), `dir ${dx},${dy} ws ${ws} cs ${cs} at ${x},${y}`);
    }
  }
});

test('canalZone: each water step above 0 shows the wet bed, and full water shows none', () => {
  for (let cs = 0; cs < 3; cs++) for (const arms of [[[1, 0, cs], [-1, 0, cs]], [[1, 1, cs], [-1, -1, cs]], [[1, -1, cs], [-1, 1, cs]]]) {
    const zones = ws => { const n = [0, 0, 0, 0]; for (let r = 0; r < 16; r++) for (let x = -16; x < 16; x++) n[canalZone(x, r, { cs, ws, arms })]++; return n; };
    assert.equal(zones(0)[2], 0);
    for (let ws = 1; ws < 4; ws++) assert.ok(zones(ws)[2] > 0, `cs ${cs} ws ${ws} arms ${arms[0]}`);
    assert.ok(zones(1)[3] > zones(2)[3] && zones(2)[3] > zones(3)[3], `water shrinks, cs ${cs}`);
  }
});
