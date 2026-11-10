// Pure iso math, shared by the renderer and the tests. view = {ox, oy, w, h}; (ox, oy) = top vertex of tile 0,0.
export const TW = 16, TH = 8;
export const PAD = 24; // buffer px of slack around the map's bounding box (tree tops, map-edge depth)
export const HUD_PAD = 48; // extra top slack so the top tiles can be pulled out from under the HUD panel

// z = micro-relief in metres (z minus local trend). 0.15 m per pixel, clamped to +-2 px.
export const zOffset = z => Math.max(-2, Math.min(2, Math.round(z / 0.15)));

export function tileToScreen(x, y, z, view) {
  return [view.ox + (x - y) * TW / 2, view.oy + (x + y) * TH / 2 - zOffset(z)];
}

// Ignores the z offset (at most 2 px).
export function screenToTile(sx, sy, view) {
  if (!(view.w > 0 && view.h > 0)) throw new Error('screenToTile: view.w and view.h are required');
  const u = (sx - view.ox) / (TW / 2), v = (sy - view.oy) / (TH / 2);
  const x = Math.floor((u + v) / 2), y = Math.floor((v - u) / 2);
  return x >= 0 && y >= 0 && x < view.w && y < view.h ? [x, y] : null;
}

// Pan (buffer px, relative to centred) clamped so the map box never leaves the buffer; centred on an axis where it fits.
export function clampPan(pan, bw, bh, w, h) {
  const lim = (map, buf) => Math.max(0, (map + 2 * PAD - buf) / 2);
  const lx = lim((w + h) * TW / 2, bw), ly = lim((w + h) * TH / 2, bh);
  return { x: Math.max(-lx, Math.min(lx, pan.x)) || 0, y: Math.max(-ly, Math.min(ly && ly + HUD_PAD, pan.y)) || 0 };
}

// Level-screen buffer: ceil(innerWidth/scale) x ceil(innerHeight/scale), map centred plus a clamped pan.
export function cameraFor(innerW, innerH, w, h, pan = { x: 0, y: 0 }) {
  const scale = innerW < 600 ? 2 : 3, bw = Math.ceil(innerW / scale), bh = Math.ceil(innerH / scale);
  const p = clampPan(pan, bw, bh, w, h);
  return { scale, bw, bh, w, h, pan: p,
    ox: Math.round(bw / 2 - (w - h) * TW / 4 + p.x), oy: Math.round((bh - (w + h) * TH / 2) / 2 + p.y) };
}

// Client coords -> buffer coords for a canvas shown with object-fit: cover.
export function clientToBuffer(cx, cy, rect, bw, bh) {
  const k = Math.max(rect.width / bw, rect.height / bh);
  return [(cx - rect.left - (rect.width - bw * k) / 2) / k, (cy - rect.top - (rect.height - bh * k) / 2) / k];
}
