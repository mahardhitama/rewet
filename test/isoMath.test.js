import test from 'node:test';
import assert from 'node:assert/strict';
import { TW, TH, PAD, HUD_PAD, tileToScreen, screenToTile, cameraFor, clientToBuffer, clampPan, zOffset } from '../src/render/isoMath.js';

// A point strictly inside tile (x, y): the diamond centre, plus nudges toward each corner.
const inner = (x, y, v) => {
  const [sx, sy] = tileToScreen(x, y, 0, v), hx = TW / 2, hy = TH / 2;
  return [[sx, sy + hy], [sx - hx * 0.8, sy + hy], [sx + hx * 0.8, sy + hy], [sx, sy + hy * 0.2], [sx, sy + hy * 1.8]];
};
const roundTrip = (v) => {
  for (let y = 0; y < v.h; y++) for (let x = 0; x < v.w; x++)
    for (const [sx, sy] of inner(x, y, v)) assert.deepEqual(screenToTile(sx, sy, v), [x, y], `tile ${x},${y} at ${sx},${sy}`);
};

test('screenToTile inverts tileToScreen for all tiles of 40x40', () => roundTrip({ ox: 160, oy: 20, w: 40, h: 40 }));

test('Review: inverse still exact after origin change (resize)', () => {
  roundTrip({ ox: -37, oy: 55, w: 40, h: 40 });
  for (const [iw, ih] of [[1280, 720], [390, 844], [844, 390], [1921, 1081]]) {
    const cam = cameraFor(iw, ih, 40, 40);
    assert.equal(cam.scale, iw < 600 ? 2 : 3);
    assert.deepEqual([cam.bw, cam.bh], [Math.ceil(iw / cam.scale), Math.ceil(ih / cam.scale)]);
    roundTrip(cam);
    // client pixel -> buffer (object-fit: cover on a full-window canvas) -> tile
    const [sx, sy] = tileToScreen(7, 31, 0, cam), k = Math.max(iw / cam.bw, ih / cam.bh);
    const cx = (sx + 0.5) * k + (iw - cam.bw * k) / 2, cy = (sy + TH / 2) * k + (ih - cam.bh * k) / 2;
    const [bx, by] = clientToBuffer(cx, cy, { left: 0, top: 0, width: iw, height: ih }, cam.bw, cam.bh);
    assert.deepEqual(screenToTile(bx, by, cam), [7, 31]);
  }
});

test('inverse still exact with a pan offset applied', () => {
  const cam = cameraFor(390, 844, 40, 40, { x: 123, y: -77 });
  assert.notDeepEqual(cam.pan, { x: 0, y: 0 });
  roundTrip(cam);
});

test('camera centres the map in the buffer', () => {
  const cam = cameraFor(1200, 900, 20, 20);
  const [l] = tileToScreen(0, 20, 0, cam), [r] = tileToScreen(20, 0, 0, cam);
  assert.ok(Math.abs((l + r) / 2 - cam.bw / 2) <= 1);
});

test('pan clamp: map larger than buffer -> clamped to both ends, map box covers the buffer', () => {
  const bw = 200, bh = 150, mw = 80 * TW / 2, mh = 80 * TH / 2; // 40x40 map: 640 x 320
  const lx = (mw + 2 * PAD - bw) / 2, ly = (mh + 2 * PAD - bh) / 2;
  assert.deepEqual(clampPan({ x: 1e6, y: 1e6 }, bw, bh, 40, 40), { x: lx, y: ly + HUD_PAD }); // top gets HUD slack
  assert.deepEqual(clampPan({ x: -1e6, y: -1e6 }, bw, bh, 40, 40), { x: -lx, y: -ly });
  assert.deepEqual(clampPan({ x: 10, y: -5 }, bw, bh, 40, 40), { x: 10, y: -5 });
  // at the clamp, the far corner tile is on screen with PAD to spare
  const cam = cameraFor(bw * 3 - 2, bh * 3 - 2, 40, 40, { x: -1e6, y: -1e6 });
  const [rx] = tileToScreen(39, 0, 0, cam), [, by] = tileToScreen(39, 39, 0, cam);
  assert.ok(rx + TW / 2 + PAD <= cam.bw + 1 && by + TH + PAD <= cam.bh + 1);
});

test('pan clamp: map smaller than buffer on an axis -> centred on that axis', () => {
  assert.deepEqual(clampPan({ x: 50, y: 50 }, 2000, 1000, 10, 10), { x: 0, y: 0 });
  assert.deepEqual(clampPan({ x: 50, y: 50 }, 100, 1000, 10, 10).y, 0); // tall buffer: y centred, x pans
  assert.ok(clampPan({ x: 50, y: 50 }, 100, 1000, 10, 10).x > 0);
});

test('outside map -> null; missing map size throws', () => {
  const v = { ox: 160, oy: 20, w: 40, h: 40 };
  assert.equal(screenToTile(160, 19, v), null);       // above tile 0,0
  assert.equal(screenToTile(160 - 8 * 40 - 1, 20 + 4 * 40, v), null); // left of x=0 column
  assert.equal(screenToTile(160, 20 + 8 * 40 + 1, v), null); // below last tile
  assert.equal(screenToTile(160 + 8 * 40 + 1, 20 + 4 * 40, v), null);
  assert.throws(() => screenToTile(160, 30, { ox: 160, oy: 20 }), /view.w and view.h/);
});

test('z offset: round(z/0.15) px, clamped to +-2, higher ground drawn higher', () => {
  assert.equal(zOffset(0.15), 1); assert.equal(zOffset(-0.3), -2); assert.equal(zOffset(1), 2); assert.equal(zOffset(0.05), 0);
  const v = { ox: 0, oy: 0, w: 4, h: 4 };
  assert.equal(tileToScreen(1, 1, 0.3, v)[1], tileToScreen(1, 1, 0, v)[1] - 2);
});
