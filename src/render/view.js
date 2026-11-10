// Level-screen view state (camera pan, data mode, hover). Lives outside the game; render-only.
import { cameraFor, clientToBuffer, screenToTile } from './isoMath.js';
import { drawWorld } from './iso.js';

const DRAG_PX = 4, KEY_PAN = 16; // drag starts after 4 client px, so a tap stays a tap

export function createMapView(cv) {
  const ctx = cv.getContext('2d');
  let ptr = null, down = null; // last pointer client pos; drag start
  const toBuffer = (cx, cy) => clientToBuffer(cx, cy, cv.getBoundingClientRect(), cv.width, cv.height);
  const v = {
    mode: 'normal', hover: null, cam: null, pan: { x: 0, y: 0 },
    wasDrag: false, // true from the moment the current/last press became a drag; Task 12 click handler skips it
    // Size the canvas for the level screen; pan is re-clamped on every resize/rotation.
    fit(world) {
      const c = cameraFor(innerWidth, innerHeight, world.w, world.h, v.pan);
      if (cv.width !== c.bw || cv.height !== c.bh) { cv.width = c.bw; cv.height = c.bh; }
      v.cam = c; v.pan = c.pan;
    },
    // Tile index under a pointer/mouse event (or {clientX, clientY}), or null.
    pickTile(evt) {
      if (!v.cam) return null;
      const t = screenToTile(...toBuffer(evt.clientX, evt.clientY), v.cam);
      return t && t[1] * v.cam.w + t[0];
    },
    panBy(dx, dy) { v.pan = { x: v.pan.x + dx, y: v.pan.y + dy }; },
    toggleMode() { v.mode = v.mode === 'data' ? 'normal' : 'data'; },
    draw(game, now) {
      v.fit(game.world);
      v.hover = ptr ? v.pickTile(ptr) : null; // re-picked every frame, so pan/resize keep it accurate
      ctx.fillStyle = '#0e0d0b'; ctx.fillRect(0, 0, cv.width, cv.height);
      drawWorld(ctx, game, v.cam, v.mode, v.hover, now);
    },
    leave() { v.cam = null; v.hover = null; v.pan = { x: 0, y: 0 }; down = null; },
    // Arrow keys pan; returns true when the key was used.
    key(e) {
      const d = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
      if (d) { e.preventDefault(); v.panBy(d[0] * KEY_PAN, d[1] * KEY_PAN); }
      return !!d;
    },
  };
  cv.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, pan: v.pan }; v.wasDrag = false; });
  addEventListener('pointermove', e => {
    ptr = { clientX: e.clientX, clientY: e.clientY };
    if (!down || !v.cam) return;
    if (!v.wasDrag && Math.hypot(e.clientX - down.x, e.clientY - down.y) < DRAG_PX) return;
    v.wasDrag = true;
    const [ax, ay] = toBuffer(down.x, down.y), [bx, by] = toBuffer(e.clientX, e.clientY);
    v.pan = { x: down.pan.x + bx - ax, y: down.pan.y + by - ay };
  });
  addEventListener('pointerup', () => { down = null; });
  addEventListener('pointercancel', () => { down = null; });
  cv.addEventListener('pointerleave', e => { if (e.pointerType !== 'mouse') ptr = null; });
  return v;
}
