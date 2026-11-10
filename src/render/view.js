// Level-screen view state (camera, data mode, hover). Lives outside the game; render-only.
import { cameraFor, clientToBuffer, screenToTile } from './isoMath.js';
import { drawWorld } from './iso.js';

export function createMapView(cv) {
  const ctx = cv.getContext('2d');
  const v = {
    mode: 'normal', hover: null, cam: null,
    // Size the canvas for the level screen; recomputed whenever the window size changes.
    fit(world) {
      const c = cameraFor(innerWidth, innerHeight, world.w, world.h);
      if (cv.width !== c.bw || cv.height !== c.bh) { cv.width = c.bw; cv.height = c.bh; }
      v.cam = c;
    },
    // Tile index under a pointer/mouse event, or null. Task 12 uses this for clicks.
    pickTile(evt) {
      if (!v.cam) return null;
      const [bx, by] = clientToBuffer(evt.clientX, evt.clientY, cv.getBoundingClientRect(), cv.width, cv.height);
      const t = screenToTile(bx, by, v.cam);
      return t && t[1] * v.cam.w + t[0];
    },
    toggleMode() { v.mode = v.mode === 'data' ? 'normal' : 'data'; },
    draw(game, now) {
      v.fit(game.world);
      ctx.fillStyle = '#0e0d0b'; ctx.fillRect(0, 0, cv.width, cv.height);
      drawWorld(ctx, game, v.cam, v.mode, v.hover, now);
    },
    leave() { v.cam = null; v.hover = null; },
  };
  return v;
}
