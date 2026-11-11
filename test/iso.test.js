import { test } from 'node:test';
import assert from 'node:assert/strict';
import { downstream, canalStep, widthStep, canalMask, canalZone, canalSprite, canalId, bankStep, BANK_TOP, DIRS, vegVariant, nearestHit, hitRadius, ANIMALS, fireSize, flameFrames, FLAME_VARIANTS, FLAME_FRAMES, yearDir, emitSmoke, resetSmoke, setFireCount, smoke } from '../src/render/iso.js';
import { KIND, WET_WT } from '../src/sim/world.js';
import { SPECIES } from '../src/journal.js';

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
  // open canal: narrow strip in the wet season (fill 0.55), near-empty bed in the dry season (fill 0.9); a blocked canal is full
  assert.equal(canalStep(0.55 * 5, 5), 2);
  assert.equal(canalStep(0.9 * 5, 5), 3);
  assert.equal(canalStep(0.1 * 0.55 * 5, 5), 0);
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

test('vegVariant spreads over 4 variants', () => {
  const n = [0, 0, 0, 0];
  for (let i = 0; i < 1000; i++) { n[vegVariant(i)]++; assert.equal(vegVariant(i), vegVariant(i)); }
  for (const c of n) assert.ok(c >= 150, `counts ${n}`);
});

test('nearestHit picks the closest animal inside the radius', () => {
  const hits = [{ species: 'otter', bx: 10, by: 10 }, { species: 'stork', bx: 14, by: 10 }];
  assert.equal(nearestHit(hits, 100, 100, 22), null);
  assert.equal(nearestHit([], 0, 0, 22), null);
  assert.equal(nearestHit(hits, 13, 10, 22).species, 'stork');
  assert.equal(nearestHit(hits, 11, 10, 22).species, 'otter');
  assert.equal(nearestHit(hits, 30, 10, 22).species, 'stork'); // 16 from stork, 20 from otter
  assert.equal(nearestHit(hits, 37, 10, 22), null); // 23 from stork
  assert.equal(nearestHit(hits, 14, 40, 22), null);
});

test('hitRadius never falls below the sprite reach', () => {
  assert.equal(hitRadius(1), 22);
  assert.equal(hitRadius(2), 11);
  assert.equal(hitRadius(3), 9); // 22 / 3 = 7.3 is below the 8 px reach of the sprite from its centre
});

test('ANIMALS has one sprite for each journal species', () => {
  assert.deepEqual(Object.keys(ANIMALS).sort(), SPECIES.map(s => s.id).sort());
});

// bankStep: a 3x3 map with the canal tile in the middle. Its 4 side neighbours are peat with the given wt and cover.
const bankWorld = (wt, cover, kinds = [P, P, P, P]) => {
  const kind = Uint8Array.from([P, kinds[0], P, kinds[1], KIND.CANAL, kinds[2], P, kinds[3], P]);
  const arr = v => Float32Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => [1, 3, 5, 7].includes(i) ? v : 9));
  return { w: 3, h: 3, kind, wt: arr(wt), cover: arr(cover) };
};
const P = KIND.PEAT;

test('bankStep: dry, damp, wet and green steps', () => {
  assert.equal(bankStep(bankWorld(1.2, 0.1), 4), 0);
  assert.equal(bankStep(bankWorld(0.6, 0.1), 4), 1);
  assert.equal(bankStep(bankWorld(0.8, 0.1), 4), 1);
  assert.equal(bankStep(bankWorld(WET_WT, 0.1), 4), 2);
  assert.equal(bankStep(bankWorld(-0.1, 0.1), 4), 2);
  assert.equal(bankStep(bankWorld(1.2, 0.6), 4), 3); // green wins, also on dry peat
  assert.equal(bankStep(bankWorld(0.2, 0.59), 4), 2);
});

test('bankStep: only peat sides count, and no peat side gives 0', () => {
  const C = KIND.CANAL;
  const w = bankWorld(0.2, 0.1, [C, P, C, C]); // one peat side left
  w.wt[3] = 1.5; // the left side is dry, the canal sides hold wt 9 and must not count
  assert.equal(bankStep(w, 4), 0);
  assert.equal(bankStep(bankWorld(0.2, 0.9, [C, C, C, KIND.RIVER]), 4), 0);
});

test('canal key: the bank step and the patch index decode back from the sprite id', () => {
  const key = 0x2a5 | 2 << 18 | 1 << 20 | 3 << 24;
  const id = canalId(key, 2); // patch 2 stores (2 + 1) in bits 21-23
  assert.equal(id >> 21 & 7, 3);
  assert.equal(id >> 24 & 3, 3);
  assert.equal(id & 0xfffff, 0x2a5 | 2 << 18);
  assert.equal(canalId(key, -1) >> 21 & 7, 0);
});

// A canvas stub that keeps the last colour of each pixel, so a test can read a sprite.
// The size is SW x (HEAD + TH + EDGE + 1) in iso.js: 32 x (28 + 16 + 22 + 1).
const SPRITE_W = 32, SPRITE_H = 67;
function stubDocument(t) {
  const old = globalThis.document;
  t.after(() => { globalThis.document = old; }); // put back the old document after the test
  globalThis.document = { createElement: () => {
    const px = new Array(SPRITE_W * SPRITE_H).fill(null);
    const g = { fillStyle: '', fillRect(x, y, w, h) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (x + i >= 0 && x + i < SPRITE_W && y + j >= 0 && y + j < SPRITE_H) px[(y + j) * SPRITE_W + x + i] = this.fillStyle; } };
    return { px, getContext: () => g };
  } };
}
const lum = c => { const [r, g, b] = c.match(/\d+/g).map(Number); return .3 * r + .59 * g + .11 * b; };
// Edge canal along y: arms +y and -y, width step 0. Key bits: arm k at 2k, width step at 16, water step at 18, edge flag at 20, bank step at 24.
const edgeKey = (ws, bank) => 1 << 2 | 1 << 6 | ws << 18 | 1 << 20 | bank << 24;

test('canal end on the map edge: the notch wall is not much darker than the face beside it (the black bar)', (t) => {
  stubDocument(t);
  for (let bank = 0; bank < 4; bank++) for (const ws of [1, 2, 3]) {
    const px = canalSprite(edgeKey(ws, bank)).px;
    const face = lum(px[(28 + 8 + 8) * SPRITE_W + 0]); // the face colour at the left edge of the sprite
    for (let dx = 4; dx <= 11; dx++) for (let r = 1; r < ws * 2; r++) { // the notch columns, the wall rows (row 0 is the last row of the top, which the channel paints)
      const c = px[(28 + 8 + (dx >> 1) + r) * SPRITE_W + dx];
      assert.ok(lum(c) >= face * .5, `bank ${bank} ws ${ws} dx ${dx} row ${r}: ${c} against face ${face}`);
    }
  }
});

test('canal sprite: the top takes the bank colour of its step', (t) => {
  stubDocument(t);
  const count = (px, c) => px.slice(28 * SPRITE_W, 44 * SPRITE_W).filter(v => v === `rgb(${c})`).length;
  const seen = new Set();
  for (let bank = 0; bank < 4; bank++) {
    const px = canalSprite(edgeKey(1, bank)).px, top = count(px, BANK_TOP[bank]); // water step 1: no seep line
    assert.ok(top > 100, `bank ${bank}: ${top} pixels of the bank colour`);
    seen.add(BANK_TOP[bank].join());
  }
  assert.equal(seen.size, 4);
});

test('canal sprite: a full canal (water step 0) soaks the bank, a lower canal does not', (t) => {
  stubDocument(t);
  const bankPx = (ws) => canalSprite(edgeKey(ws, 0)).px.filter(v => v === `rgb(${BANK_TOP[0]})`).length;
  assert.ok(bankPx(0) < bankPx(1) - 15, `${bankPx(0)} vs ${bankPx(1)}`);
});

test('slidePos blends linearly', async () => {
  const { slidePos } = await import('../src/render/iso.js');
  assert.deepEqual(slidePos([0, 0], [10, -4], 0), [0, 0]);
  assert.deepEqual(slidePos([0, 0], [10, -4], 0.5), [5, -2]);
  assert.deepEqual(slidePos([0, 0], [10, -4], 1), [10, -4]);
});

test('fadeAlpha fades in, and fades out when leaving', async () => {
  const { fadeAlpha } = await import('../src/render/iso.js');
  assert.equal(fadeAlpha(0), 0);
  assert.equal(fadeAlpha(300), 0.5);
  assert.equal(fadeAlpha(5000), 1);
  assert.equal(fadeAlpha(5000, 0), 1);
  assert.equal(fadeAlpha(5000, 300), 0.5);
  assert.equal(fadeAlpha(5000, 900), 0);
  assert.equal(fadeAlpha(100, 300), Math.min(100 / 600, 0.5));
});

test('slideState: spawn fades in, an old move is settled, a new move restarts the slide', async () => {
  const { slideState } = await import('../src/render/iso.js');
  const m = new Map(), st = (a, tick, now, f = 1) => slideState(a, tick, now, 8, 8, f, m);
  const spawn = st({ id: 1, i: 5, from: 5, moved: 10, born: 10 }, 10, 1000);
  assert.deepEqual([spawn.seenAt, spawn.shownAt], [1000, 1000]); // fade in
  const old = st({ id: 2, i: 5, from: 4, moved: 3, born: 0 }, 20, 1000);
  assert.deepEqual([old.seenAt, old.shownAt], [400, 400]); // settled: no slide, no fade
  assert.equal(st({ id: 3, i: 5, from: 4, moved: 19, born: 0 }, 20, 1000).seenAt, 1000); // a move in this week step slides
  assert.equal(st({ id: 1, i: 6, from: 5, moved: 14, born: 10 }, 14, 1700, 2).seenAt, 1700); // a new move restarts the slide
  assert.equal(st({ id: 4, i: 0, from: 1, moved: 5, born: 0, leaving: true }, 5, 2000).leaveAt, 2000); // leaving on an edge tile
  assert.equal(st({ id: 5, i: 27, from: 27, moved: 5, born: 0, leaving: true }, 5, 2000).leaveAt, -1); // not on an edge tile
});

test('resetSlides empties the module slide map', async () => {
  const { slideState, resetSlides, slideCount } = await import('../src/render/iso.js');
  resetSlides();
  slideState({ id: 9, i: 5, from: 5, moved: 0, born: 0 }, 0, 0, 8, 8, 1);
  assert.equal(slideCount(), 1);
  resetSlides();
  assert.equal(slideCount(), 0);
});

test('yearDir is stable for one year and changes in the next year', () => {
  assert.equal(yearDir(7, 3), yearDir(7, 3));
  assert.notEqual(yearDir(7, 3), yearDir(7, 4));
  const a = yearDir(12345, 0);
  assert.ok(a >= 0 && a < 2 * Math.PI);
});

test('the smoke ring never holds more than 160 puffs, and resetSmoke empties it', () => {
  resetSmoke();
  for (let k = 0; k < 1000; k++) emitSmoke(k, 0, 0, 1, k * 500);
  assert.equal(smoke.length, 160);
  assert.ok(smoke.every(p => p.born >= 0 && p.life >= 3000 && p.life <= 6000));
  resetSmoke();
  assert.equal(smoke.length, 0);
});

test('a tile emits about 1 puff each 400 ms for a surface fire, whatever the frame rate', () => {
  resetSmoke();
  for (let t = 0; t < 4000; t += 16) emitSmoke(5, 0, 0, 1, t);
  const n = smoke.length;
  resetSmoke();
  for (let t = 0; t < 4000; t += 100) emitSmoke(5, 0, 0, 1, t);
  assert.ok(n >= 9 && n <= 11, `n=${n}`);
  assert.equal(smoke.length, n);
  resetSmoke();
});

test('with 100 burning tiles a replaced puff is at least 3 s old', () => {
  resetSmoke(); setFireCount(100);
  const ages = [];
  for (let t = 0; t < 40000; t += 16) {
    for (let i = 0; i < 100; i++) {
      if (t > 15000 && smoke.length === 160) { const before = smoke.map(p => p.born); emitSmoke(i, 0, 0, 1, t); smoke.forEach((p, k) => { if (p.born !== before[k]) ages.push(t - before[k]); }); } // a replaced puff: its age at the swap
      else emitSmoke(i, 0, 0, 1, t);
    }
  }
  const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
  assert.ok(ages.length > 100 && mean >= 3000, `mean=${mean} n=${ages.length}`);
  resetSmoke();
});

test('fire size grows with the ticks since the tile was lit', () => {
  assert.deepEqual([0, 2, 3, 5, 6, 7].map(fireSize), [0, 0, 1, 1, 2, 2]);
});

test('flame frames: more and taller tongues for bigger fires, all inside the sprite', () => {
  for (let size = 0; size < 3; size++) for (let v = 0; v < FLAME_VARIANTS; v++) {
    const frames = flameFrames(size, v);
    assert.equal(frames.length, FLAME_FRAMES);
    assert.deepEqual(flameFrames(size, v), frames, 'deterministic');
    for (const f of frames) {
      assert.equal(f.length, [2, 3, 5][size]);
      for (const [dx, dy, h, wd, lean] of f) {
        assert.ok(Math.abs(dx) + Math.round(wd / 2) + Math.abs(lean) <= 15, 'inside the 32 px sprite');
        assert.ok(h - dy - 11 <= 28 && h > 0, 'inside HEAD');
      }
    }
  }
  const tallest = s => Math.max(...flameFrames(s, 0).flat().map(t => t[2]));
  assert.ok(tallest(0) < tallest(1) && tallest(1) < tallest(2));
});
