import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawFx, takeFxEvents, resetFx, textWidth, pixelText, outletDir, outlets } from '../src/render/fx.js';
import { LEVELS } from '../src/levels.js';
import { resolveLevel } from '../src/sim/mapgen.js';
import { placeLevel } from '../src/sim/game.js';
import { KIND } from '../src/sim/world.js';

const stubCtx = () => ({ n: 0, fillStyle: '', globalAlpha: 1, fillRect() { this.n++; }, drawImage() {}, save() {}, restore() {}, translate() {}, scale() {} });
function fakeGame() {
  const n = 4;
  return { tick: 0, jobs: [], level: null, world: { n, w: 2, h: 2, seed: 1, kind: new Uint8Array(n).fill(KIND.PEAT), wt: new Float32Array(n).fill(1), fire: new Uint8Array(n), cover: new Float32Array(n) } };
}
const pos = new Int16Array(8), shown = new Uint8Array(4).fill(1);

test('fx: a tile that turns wet gives one wet event for the tick', () => {
  resetFx(); const g = fakeGame(), ctx = stubCtx();
  drawFx(ctx, g, pos, shown, null, true, 100, 100, 0, true); // first frame: only records the state
  g.world.wt[1] = 0.2; g.world.wt[2] = 0.3; g.tick = 1;
  drawFx(ctx, g, pos, shown, null, true, 100, 100, 16, true);
  assert.deepEqual(takeFxEvents(), [{ type: 'wet', n: 2 }]);
  g.tick = 2; drawFx(ctx, g, pos, shown, null, true, 100, 100, 32, true); // still wet: no new event
  assert.deepEqual(takeFxEvents(), []);
});

test('fx: a finished job and a fire that went out give events; a job cut short does not', () => {
  resetFx(); const g = fakeGame(), ctx = stubCtx();
  g.jobs = [{ id: 'tempBlock', i: 0, doneAt: 4 }, { id: 'well', i: 3, doneAt: 9 }]; g.world.fire[2] = 1;
  drawFx(ctx, g, pos, shown, null, true, 100, 100, 0, true);
  g.tick = 4; g.jobs = []; g.world.fire[2] = 0;
  drawFx(ctx, g, pos, shown, null, true, 100, 100, 16, true);
  assert.deepEqual(takeFxEvents().map(e => e.type).sort(), ['done', 'fireOut']);
});

test('fx: the intro story (live false) gives no events', () => {
  resetFx(); const g = fakeGame(), ctx = stubCtx();
  drawFx(ctx, g, pos, shown, null, true, 100, 100, 0, false);
  g.world.wt[0] = 0; g.tick = 1;
  drawFx(ctx, g, pos, shown, null, true, 100, 100, 16, false);
  assert.deepEqual(takeFxEvents(), []);
});

test('pixel text: 4 px per glyph, and it draws pixels', () => {
  assert.equal(textWidth('-80'), 11);
  const ctx = stubCtx(); pixelText(ctx, '-80', 0, 0, '#fff');
  assert.ok(ctx.n > 20);
});

test('cascade counts blocked canal tiles within 6 tiles, and a finished block near another gives a cascade event', async () => {
  const { cascade } = await import('../src/render/fx.js');
  const { BLOCK } = await import('../src/sim/world.js');
  const n = 100, wd = { n, w: 10, h: 10, seed: 1, kind: new Uint8Array(n).fill(KIND.PEAT), block: new Uint8Array(n), wt: new Float32Array(n).fill(1), fire: new Uint8Array(n), cover: new Float32Array(n) };
  for (const i of [0, 3, 9]) { wd.kind[i] = KIND.CANAL; wd.block[i] = BLOCK.TEMP; }
  assert.equal(cascade(wd, 0), 2); // tile 9 is 9 tiles away
  resetFx(); const g = { tick: 0, jobs: [{ id: 'tempBlock', i: 3, doneAt: 4 }], level: null, world: wd }, ctx = stubCtx(), p = new Int16Array(2 * n), sh = new Uint8Array(n);
  drawFx(ctx, g, p, sh, null, true, 100, 100, 0, true);
  g.tick = 4; g.jobs = [];
  drawFx(ctx, g, p, sh, null, true, 100, 100, 16, true);
  assert.deepEqual(takeFxEvents().map(e => e.type), ['done', 'cascade']);
});

test('fx: a season change gives one season event, and the start of a level gives none', async () => {
  const { isWetSeason } = await import('../src/sim/season.js');
  resetFx(); const g = { ...fakeGame(), level: { elNinoYear: -1 } }, ctx = stubCtx();
  const wet0 = isWetSeason(g); let t = 1; while (t < 208 && isWetSeason({ ...g, tick: t }) === wet0) t++;
  assert.ok(t < 208);
  drawFx(ctx, g, pos, shown, null, true, 100, 100, 0, true);
  g.tick = t - 1; drawFx(ctx, g, pos, shown, null, true, 100, 100, 16, true);
  assert.deepEqual(takeFxEvents().filter(e => e.type === 'season'), []);
  g.tick = t; drawFx(ctx, g, pos, shown, null, true, 100, 100, 32, true);
  assert.deepEqual(takeFxEvents().filter(e => e.type === 'season').length, 1);
});

test('fx: the flow arrow points to the outlet edge, the lowest edge of the map', () => {
  assert.equal(outletDir(null), null);
  assert.equal(outletDir({ terrain: { tilt: 0, outlet: 'S' } }), null); // no tilt: no outlet edge
  for (const L of LEVELS) {
    const lv = resolveLevel(L), [dx, dy] = outletDir(lv), n = lv.size;
    // the canals end at the outlet edge: the edge on the arrow side holds canal or river tiles
    const edge = ([x, y]) => (dx > 0 && x === n - 1) || (dx < 0 && x === 0) || (dy > 0 && y === n - 1) || (dy < 0 && y === 0) || (lv.rivers.length && ((dx > 0 && x === n - 2) || (dx < 0 && x === 1) || (dy > 0 && y === n - 2) || (dy < 0 && y === 1)));
    assert.ok(lv.canals.some(edge), `level ${L.id}: no canal at the ${lv.terrain.outlet} edge`);
  }
});

test('fx: each level has a mouth arrow at each canal end on the outlet edge, and only there', () => {
  for (const L of LEVELS) {
    const lv = resolveLevel(L), wd = placeLevel(lv), d = outletDir(lv), list = outlets(wd, d);
    assert.ok(list.length >= 1, `level ${L.id}: no mouth`);
    for (const { i } of list) {
      const x = i % wd.w + d[0], y = (i / wd.w | 0) + d[1];
      assert.ok(x < 0 || y < 0 || x >= wd.w || y >= wd.h, `level ${L.id}: mouth ${i} is not at the outlet edge`);
      assert.ok([KIND.CANAL, KIND.RIVER].includes(wd.kind[i]), `level ${L.id}: mouth ${i} is not on water`);
    }
  }
});
