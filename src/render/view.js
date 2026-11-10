// Level-screen view state (camera pan, data mode, hover). Lives outside the game; render-only.
import { cameraFor, clientToBuffer, screenToTile, fitScale, zoomSteps, nearestStep, panForZoom } from './isoMath.js';
import { drawWorld } from './iso.js';

const DRAG_PX = 4, KEY_PAN = 16; // drag starts after 4 client px, so a tap stays a tap
const PINCH = 0.25; // a pinch zooms one step each time the finger distance changes by 25%

export function createMapView(cv) {
  const ctx = cv.getContext('2d');
  let ptr = null, down = null; // last pointer client pos; drag start
  const touches = new Map(); let pinch = 0; // active pointers; pinch distance at the last zoom step
  const gap = () => { const [a, b] = touches.values(); return Math.hypot(a.x - b.x, a.y - b.y); };
  const shown = id => { const el = document.getElementById(id); return el && !el.hidden ? el : null; };
  // CSS px that the HUD and the action bar cover at the top and the bottom of the window.
  const insets = () => { const hud = shown('hud'), bar = shown('bar');
    return { top: hud ? hud.offsetTop + hud.offsetHeight : 0, bottom: bar ? bar.offsetHeight : 0 }; };
  const toBuffer = (cx, cy) => clientToBuffer(cx, cy, cv.getBoundingClientRect(), cv.width, cv.height);
  const v = {
    mode: 'normal', hover: null, cam: null, pan: { x: 0, y: 0 }, scale: null, steps: [], // scale null: open at the fit scale
    wasDrag: false, // true from the moment the current/last press became a drag; Task 12 click handler skips it
    // Size the canvas for the level screen; pan is re-clamped and the zoom step re-checked on every resize/rotation.
    fit(world) {
      const ins = insets();
      v.steps = zoomSteps(fitScale(innerWidth, innerHeight, world.w, world.h, ins));
      if (!v.steps.includes(v.scale)) v.scale = v.scale == null ? v.steps[0] : nearestStep(v.steps, v.scale);
      const c = cameraFor(innerWidth, innerHeight, world.w, world.h, v.pan, v.scale, ins);
      if (cv.width !== c.bw || cv.height !== c.bh) { cv.width = c.bw; cv.height = c.bh; }
      v.cam = c; v.pan = c.pan;
    },
    // Tile index under a pointer/mouse event (or {clientX, clientY}), or null.
    pickTile(evt) {
      if (!v.cam) return null;
      const t = screenToTile(...toBuffer(evt.clientX, evt.clientY), v.cam);
      return t && t[1] * v.cam.w + t[0];
    },
    // dir +1 zooms in, -1 zooms out, 0 goes back to the fit scale. The map point under (clientX, clientY) stays in place.
    zoom(dir, clientX = innerWidth / 2, clientY = innerHeight / 2) {
      if (!v.cam) return;
      const i = v.steps.indexOf(v.scale), s = dir ? v.steps[Math.max(0, Math.min(v.steps.length - 1, i + dir))] : v.steps[0];
      if (s === v.scale) return;
      v.pan = dir ? panForZoom(v.cam, s, clientX, clientY, innerWidth, innerHeight, insets()) : { x: 0, y: 0 };
      v.scale = s; v.fit(v.cam);
    },
    panBy(dx, dy) { v.pan = { x: v.pan.x + dx, y: v.pan.y + dy }; },
    toggleMode() { v.mode = v.mode === 'data' ? 'normal' : 'data'; },
    draw(game, now) {
      v.fit(game.world);
      v.hover = ptr ? v.pickTile(ptr) : null; // re-picked every frame, so pan/resize keep it accurate
      ctx.fillStyle = '#0e0d0b'; ctx.fillRect(0, 0, cv.width, cv.height);
      drawWorld(ctx, game, v.cam, v.mode, v.hover, now);
    },
    leave() { v.cam = null; v.hover = null; v.pan = { x: 0, y: 0 }; v.scale = null; down = null; },
    // Arrow keys pan; returns true when the key was used.
    key(e) {
      const d = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
      if (d) { e.preventDefault(); v.panBy(d[0] * KEY_PAN, d[1] * KEY_PAN); }
      return !!d;
    },
  };
  cv.addEventListener('pointerdown', e => {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) { pinch = gap(); down = null; v.wasDrag = true; return; } // a pinch never picks a tile
    down = { x: e.clientX, y: e.clientY, pan: v.pan }; v.wasDrag = false;
  });
  cv.addEventListener('wheel', e => { e.preventDefault(); if (e.deltaY) v.zoom(e.deltaY < 0 ? 1 : -1, e.clientX, e.clientY); }, { passive: false });
  addEventListener('pointermove', e => {
    ptr = { clientX: e.clientX, clientY: e.clientY };
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2 && pinch) {
      const d = gap(), r = d / pinch, [a, b] = touches.values();
      if (Math.abs(r - 1) >= PINCH) { v.zoom(r > 1 ? 1 : -1, (a.x + b.x) / 2, (a.y + b.y) / 2); pinch = d; }
      return;
    }
    if (!down || !v.cam) return;
    if (!v.wasDrag && Math.hypot(e.clientX - down.x, e.clientY - down.y) < DRAG_PX) return;
    v.wasDrag = true;
    const [ax, ay] = toBuffer(down.x, down.y), [bx, by] = toBuffer(e.clientX, e.clientY);
    v.pan = { x: down.pan.x + bx - ax, y: down.pan.y + by - ay };
  });
  const end = e => { down = null; touches.delete(e.pointerId); if (touches.size < 2) pinch = 0; };
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', e => { if (e.pointerType !== 'mouse') ptr = null; });
  return v;
}
