import test from 'node:test';
import assert from 'node:assert/strict';
import { TW, TH, tileToScreen, screenToTile, cameraFor, clientToBuffer, zOffset } from '../src/render/isoMath.js';

// A point strictly inside tile (x, y): the diamond centre, plus nudges toward each corner.
const inner = (x, y, v) => {
  const [sx, sy] = tileToScreen(x, y, 0, v), hx = TW / 2 * v.zoom, hy = TH / 2 * v.zoom;
  return [[sx, sy + hy], [sx - hx * 0.8, sy + hy], [sx + hx * 0.8, sy + hy], [sx, sy + hy * 0.2], [sx, sy + hy * 1.8]];
};
const roundTrip = (v) => {
  for (let y = 0; y < v.h; y++) for (let x = 0; x < v.w; x++)
    for (const [sx, sy] of inner(x, y, v)) assert.deepEqual(screenToTile(sx, sy, v), [x, y], `tile ${x},${y} at ${sx},${sy}`);
};

test('screenToTile inverts tileToScreen for all tiles of 40x40', () => roundTrip({ ox: 160, oy: 20, zoom: 1, w: 40, h: 40 }));

test('Review: inverse still exact after origin/zoom change (resize)', () => {
  roundTrip({ ox: -37, oy: 55, zoom: 2, w: 40, h: 40 });
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

test('camera centres the map in the buffer', () => {
  const cam = cameraFor(1200, 900, 20, 20);
  const [l] = tileToScreen(0, 20, 0, cam), [r] = tileToScreen(20, 0, 0, cam);
  assert.ok(Math.abs((l + r) / 2 - cam.bw / 2) <= 1);
});

test('outside map -> null', () => {
  const v = { ox: 160, oy: 20, zoom: 1, w: 40, h: 40 };
  assert.equal(screenToTile(160, 19, v), null);       // above tile 0,0
  assert.equal(screenToTile(160 - 8 * 40 - 1, 20 + 4 * 40, v), null); // left of x=0 column
  assert.equal(screenToTile(160, 20 + 8 * 40 + 1, v), null); // below last tile
  assert.equal(screenToTile(160 + 8 * 40 + 1, 20 + 4 * 40, v), null);
});

test('z offset: round(z/0.15) px, clamped to +-2, higher ground drawn higher', () => {
  assert.equal(zOffset(0.15), 1); assert.equal(zOffset(-0.3), -2); assert.equal(zOffset(1), 2); assert.equal(zOffset(0.05), 0);
  const v = { ox: 0, oy: 0, zoom: 1, w: 4, h: 4 };
  assert.equal(tileToScreen(1, 1, 0.3, v)[1], tileToScreen(1, 1, 0, v)[1] - 2);
});
