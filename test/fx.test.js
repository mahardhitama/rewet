import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawFx, takeFxEvents, resetFx, textWidth, pixelText } from '../src/render/fx.js';
import { KIND } from '../src/sim/world.js';

const stubCtx = () => ({ n: 0, fillStyle: '', globalAlpha: 1, fillRect() { this.n++; }, drawImage() {} });
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
