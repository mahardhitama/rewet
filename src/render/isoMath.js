// Pure iso math, shared by the renderer and the tests. view = {ox, oy, zoom, w, h}; (ox, oy) = top vertex of tile 0,0.
export const TW = 16, TH = 8;

// z = micro-relief in metres (z minus local trend). 0.15 m per pixel, clamped to +-2 px.
export const zOffset = z => Math.max(-2, Math.min(2, Math.round(z / 0.15)));

export function tileToScreen(x, y, z, view) {
  return [view.ox + (x - y) * TW / 2 * view.zoom, view.oy + ((x + y) * TH / 2 - zOffset(z)) * view.zoom];
}

// Ignores the z offset (at most 2 px).
export function screenToTile(sx, sy, view) {
  const u = (sx - view.ox) / (TW / 2 * view.zoom), v = (sy - view.oy) / (TH / 2 * view.zoom);
  const x = Math.floor((u + v) / 2), y = Math.floor((v - u) / 2);
  return x >= 0 && y >= 0 && x < view.w && y < view.h ? [x, y] : null;
}

// Level-screen buffer: ceil(innerWidth/scale) x ceil(innerHeight/scale), map centred.
export function cameraFor(innerW, innerH, w, h) {
  const scale = innerW < 600 ? 2 : 3, bw = Math.ceil(innerW / scale), bh = Math.ceil(innerH / scale);
  return { scale, bw, bh, w, h, zoom: 1,
    ox: Math.round(bw / 2 - (w - h) * TW / 4), oy: Math.round((bh - (w + h) * TH / 2) / 2) };
}

// Client coords -> buffer coords for a canvas shown with object-fit: cover.
export function clientToBuffer(cx, cy, rect, bw, bh) {
  const k = Math.max(rect.width / bw, rect.height / bh);
  return [(cx - rect.left - (rect.width - bw * k) / 2) / k, (cy - rect.top - (rect.height - bh * k) / 2) / k];
}
