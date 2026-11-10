import test from 'node:test';
import assert from 'node:assert/strict';
import { TW, TH, PAD, HUD_PAD, tileToScreen, screenToTile, cameraFor, clientToBuffer, clampPan, zOffset, fitScale, zoomSteps, panForZoom, nearestStep } from '../src/render/isoMath.js';

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

// Client px -> tile, for a full-window canvas shown with object-fit: cover.
const clientTile = (cx, cy, iw, ih, cam) => screenToTile(...clientToBuffer(cx, cy, { left: 0, top: 0, width: iw, height: ih }, cam.bw, cam.bh), cam);
// Buffer px -> client px (the inverse of clientToBuffer).
const toClient = (bx, by, iw, ih, cam) => {
  const k = Math.max(iw / cam.bw, ih / cam.bh);
  return [bx * k + (iw - cam.bw * k) / 2, by * k + (ih - cam.bh * k) / 2];
};
const INSETS = { top: 56, bottom: 72 };

test('Review: inverse still exact after origin change (resize)', () => {
  roundTrip({ ox: -37, oy: 55, w: 40, h: 40 });
  for (const [iw, ih] of [[1280, 720], [390, 844], [844, 390], [1921, 1081]]) {
    for (const scale of zoomSteps(fitScale(iw, ih, 40, 40))) {
      const cam = cameraFor(iw, ih, 40, 40, { x: 0, y: 0 }, scale);
      assert.equal(cam.scale, scale);
      assert.deepEqual([cam.bw, cam.bh], [Math.ceil(iw / scale), Math.ceil(ih / scale)]);
      roundTrip(cam);
      const [sx, sy] = tileToScreen(7, 31, 0, cam);
      assert.deepEqual(clientTile(...toClient(sx + 0.5, sy + TH / 2, iw, ih, cam), iw, ih, cam), [7, 31], `${iw}x${ih} at scale ${scale}`);
    }
  }
});

test('fit shows the full map', () => {
  for (const [iw, ih] of [[390, 844], [844, 390], [1280, 800]]) {
    const cam = cameraFor(iw, ih, 40, 40, { x: 0, y: 0 }, fitScale(iw, ih, 40, 40, INSETS), INSETS);
    for (const [x, y] of [[0, 0], [39, 0], [0, 39], [39, 39]]) {
      const [sx, sy] = tileToScreen(x, y, 0, cam);
      assert.ok(sx - TW / 2 >= 0 && sx + TW / 2 <= cam.bw && sy >= 0 && sy + TH <= cam.bh, `${iw}x${ih} tile ${x},${y} in buffer`);
      const [, top] = toClient(sx, sy, iw, ih, cam), [, bottom] = toClient(sx, sy + TH, iw, ih, cam);
      assert.ok(top >= INSETS.top && bottom <= ih - INSETS.bottom, `${iw}x${ih} tile ${x},${y} clear of the insets`);
    }
  }
});

test('largest zoom gives tiles at least 48 x 24 CSS px on a 390 px screen', () => {
  const steps = zoomSteps(fitScale(390, 844, 40, 40, INSETS));
  assert.ok(TW * Math.max(...steps) >= 48 && TH * Math.max(...steps) >= 24);
});

test('zoom steps: the fit scale, then each of 1, 2 and 3 more than 10% above it', () => {
  assert.deepEqual(zoomSteps(0.3), [0.3, 1, 2, 3]);
  assert.deepEqual(zoomSteps(0.95), [0.95, 2, 3]);
  assert.deepEqual(zoomSteps(3.5), [3.5]);
});

test('panForZoom keeps the tile under the pointer', () => {
  const iw = 1280, ih = 800, map = cam => [cam.ox, cam.oy];
  for (const [s0, pan0, s1, tile] of [[1, { x: 0, y: 0 }, 2, [20, 22]], [3, { x: 150, y: -90 }, 2, [24, 17]], [2, { x: 0, y: 0 }, 1, [18, 21]]]) {
    const cam0 = cameraFor(iw, ih, 40, 40, pan0, s0, INSETS);
    assert.deepEqual(cam0.pan, pan0);
    const [sx, sy] = tileToScreen(...tile, 0, cam0), [cx, cy] = toClient(sx, sy + TH / 2, iw, ih, cam0);
    assert.deepEqual(clientTile(cx, cy, iw, ih, cam0), tile);
    const pan1 = panForZoom(cam0, s1, cx, cy, iw, ih, INSETS), cam1 = cameraFor(iw, ih, 40, 40, pan1, s1, INSETS);
    assert.deepEqual(cam1.pan, pan1, 'no clamp in this case');
    assert.deepEqual(clientTile(cx, cy, iw, ih, cam1), tile, `zoom ${s0} to ${s1}`);
    // the map point under the pointer moves by less than 1 buffer px
    const [b0x, b0y] = clientToBuffer(cx, cy, { left: 0, top: 0, width: iw, height: ih }, cam0.bw, cam0.bh);
    const [b1x, b1y] = clientToBuffer(cx, cy, { left: 0, top: 0, width: iw, height: ih }, cam1.bw, cam1.bh);
    const [o0x, o0y] = map(cam0), [o1x, o1y] = map(cam1);
    assert.ok(Math.abs(b1x - o1x - (b0x - o0x)) < 1 && Math.abs(b1y - o1y - (b0y - o0y)) < 1);
  }
});

test('a zoom step that no longer exists falls back to the nearest step', () => {
  const old = zoomSteps(fitScale(390, 844, 40, 40, INSETS)), now = zoomSteps(fitScale(1280, 800, 40, 40, INSETS));
  assert.ok(!now.includes(old[0]));
  assert.equal(nearestStep(now, old[0]), now[0]); // the old fit becomes the new fit
  assert.equal(nearestStep([0.95, 2, 3], 1), 0.95); // step 1 is gone at this size
  assert.equal(nearestStep([0.3, 1, 2, 3], 1.6), 2);
  assert.equal(nearestStep([0.3, 1, 2, 3], 2), 2);
});

test('inverse still exact with a pan offset applied', () => {
  const cam = cameraFor(390, 844, 40, 40, { x: 123, y: -77 }, 2);
  assert.notDeepEqual(cam.pan, { x: 0, y: 0 });
  roundTrip(cam);
});

test('camera centres the map in the buffer', () => {
  const cam = cameraFor(1200, 900, 20, 20, { x: 0, y: 0 }, 3);
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
  const cam = cameraFor(bw * 3 - 2, bh * 3 - 2, 40, 40, { x: -1e6, y: -1e6 }, 3);
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
  assert.equal(screenToTile(160 - TW / 2 * 40 - 1, 20 + TH / 2 * 40, v), null); // left of x=0 column
  assert.equal(screenToTile(160, 20 + TH * 40 + 1, v), null); // below last tile
  assert.equal(screenToTile(160 + TW / 2 * 40 + 1, 20 + TH / 2 * 40, v), null);
  assert.throws(() => screenToTile(160, 30, { ox: 160, oy: 20 }), /view.w and view.h/);
});

test('z offset: round(z/0.075) px, clamped to +-4, higher ground drawn higher', () => {
  assert.equal(zOffset(0.075), 1); assert.equal(zOffset(-0.6), -4); assert.equal(zOffset(1), 4); assert.equal(zOffset(0.03), 0);
  const v = { ox: 0, oy: 0, w: 4, h: 4 };
  assert.equal(tileToScreen(1, 1, 0.3, v)[1], tileToScreen(1, 1, 0, v)[1] - 4);
});
