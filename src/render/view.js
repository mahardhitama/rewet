// Level-screen view state (camera pan, data mode, hover). Lives outside the game; render-only.
import { cameraFor, clientToBuffer, screenToTile, fitScale, zoomSteps, keepStep, panForZoom, openStep } from './isoMath.js';
import { drawWorld, nearestHit, hitRadius } from './iso.js';

const DRAG_PX = 4, KEY_PAN = 16; // drag starts after 4 client px, so a tap stays a tap
const PINCH = 0.25; // a pinch zooms one step each time the finger distance changes by 25%
const WHEEL_MS = 150; // a trackpad sends many wheel events for one gesture: at most one zoom step in this time

export function createMapView(cv) {
  const ctx = cv.getContext('2d');
  let ptr = null, down = null, hits = []; // last pointer client pos; drag start; animal hit list of the last frame
  const touches = new Map(); let pinch = 0, lastWheel = -Infinity, world = null; // active pointers; pinch distance at the last zoom step
  const gap = () => { const [a, b] = touches.values(); return Math.hypot(a.x - b.x, a.y - b.y); };
  // CSS px that the HUD, the action bar and the zoom buttons cover. A hidden element has a 0 px box.
  // Cached: a read each frame forces a layout. The observer also sees show and hide, because [hidden] sets display: none.
  const [hud, bar, zoomEl] = ['hud', 'bar', 'zoom'].map(id => document.getElementById(id));
  let ins = { top: 0, bottom: 0, side: 0 };
  // The zoom buttons cover a side column only when they are fixed at the right edge. On a portrait phone they float just above the action bar and add no side inset.
  const measure = () => { ins = { top: hud.offsetHeight && hud.offsetTop + hud.offsetHeight, bottom: bar.offsetHeight,
    side: zoomEl.offsetWidth && getComputedStyle(zoomEl).position === 'fixed' ? innerWidth - zoomEl.offsetLeft : 0 }; };
  if (hud && bar && zoomEl) { const ro = new ResizeObserver(measure); [hud, bar, zoomEl].forEach(el => ro.observe(el)); addEventListener('resize', measure); }
  const toBuffer = (cx, cy) => clientToBuffer(cx, cy, cv.getBoundingClientRect(), cv.width, cv.height);
  const v = {
    mode: 'normal', whole: false, shot: null, hover: null, cam: null, pan: { x: 0, y: 0 }, scale: null, steps: [], // scale null: open at the step from openStep()
    wasDrag: false, // true from the moment the current/last press became a drag; Task 12 click handler skips it
    // Size the canvas for the level screen; pan is re-clamped and the zoom step re-checked on every resize/rotation.
    fit(wd) {
      world = wd;
      const wasFit = v.scale === v.steps[0];
      v.steps = zoomSteps(fitScale(innerWidth, innerHeight, world.w, world.h, ins));
      const shot = v.whole && v.shot; // the intro camera: zoom is a factor of the fit scale, pan is -1 (left edge) to 1 (right edge)
      v.scale = shot ? v.steps[0] * shot.zoom : v.whole ? v.steps[0] : keepStep(v.steps, v.scale, wasFit, openStep(innerWidth, innerHeight)); // whole: the menu and the intro show the full map
      if (shot) v.pan = { x: shot.pan * cameraFor(innerWidth, innerHeight, world.w, world.h, { x: 1e6, y: 0 }, v.scale, ins).pan.x, y: 0 };
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
    // The animal under a pointer/mouse event, or null. The radius is 22 CSS px, half of a 44 px touch target, and never less than the sprite reach.
    pickAnimal(evt) {
      if (!v.cam) return null;
      const [bx, by] = toBuffer(evt.clientX, evt.clientY);
      return nearestHit(hits, bx, by, hitRadius(v.scale));
    },
    // dir +1 zooms in, -1 zooms out, 0 goes back to the fit scale. The map point under (clientX, clientY) stays in place.
    // With no point, the zoom keeps the centre of the band between the insets in place.
    zoom(dir, clientX = innerWidth / 2, clientY = (innerHeight + ins.top - ins.bottom) / 2) {
      if (!v.cam) return;
      const i = v.steps.indexOf(v.scale), s = dir ? v.steps[Math.max(0, Math.min(v.steps.length - 1, i + dir))] : v.steps[0];
      if (s === v.scale) return;
      v.pan = dir ? panForZoom(v.cam, s, clientX, clientY, innerWidth, innerHeight, ins) : { x: 0, y: 0 };
      v.scale = s; v.fit(world);
      if (down && ptr) down = { x: ptr.clientX, y: ptr.clientY, pan: v.pan }; // a drag continues from the new pan, so the map does not jump
    },
    panBy(dx, dy) { v.pan = { x: v.pan.x + dx, y: v.pan.y + dy }; },
    toggleMode() { v.mode = v.mode === 'data' ? 'normal' : 'data'; },
    draw(game, now) {
      v.fit(game.world);
      v.hover = ptr && !v.whole ? v.pickTile(ptr) : null; // re-picked every frame, so pan/resize keep it accurate
      ctx.fillStyle = '#0e0d0b'; ctx.fillRect(0, 0, cv.width, cv.height);
      hits = drawWorld(ctx, game, v.cam, v.whole ? 'normal' : v.mode, v.hover, now);
    },
    leave() { v.cam = null; v.hover = null; v.pan = { x: 0, y: 0 }; v.scale = null; down = null; hits = []; touches.clear(); pinch = 0; },
    // Arrow keys pan; returns true when the key was used.
    key(e) {
      const d = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
      if (d) { e.preventDefault(); v.panBy(d[0] * KEY_PAN, d[1] * KEY_PAN); }
      return !!d;
    },
  };
  cv.addEventListener('pointerdown', e => {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size >= 2) { pinch = gap(); down = null; v.wasDrag = true; return; } // a pinch never picks a tile
    down = { x: e.clientX, y: e.clientY, pan: v.pan }; v.wasDrag = false;
  });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    if (!e.deltaY || e.timeStamp - lastWheel < WHEEL_MS) return;
    lastWheel = e.timeStamp; v.zoom(e.deltaY < 0 ? 1 : -1, e.clientX, e.clientY);
  }, { passive: false });
  addEventListener('pointermove', e => {
    ptr = { clientX: e.clientX, clientY: e.clientY };
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size >= 2 && pinch) {
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
