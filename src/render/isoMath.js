// Pure iso math, shared by the renderer and the tests. view = {ox, oy, w, h}; (ox, oy) = top vertex of tile 0,0.
export const TW = 32, TH = 16;
export const PAD = 48; // buffer px of slack around the map's bounding box (tree tops, map-edge depth)
export const HUD_PAD = 96; // extra top slack so the top tiles can be pulled out from under the HUD panel

// z = micro-relief in metres (z minus local trend). 0.075 m per pixel, clamped to +-4 px.
export const zOffset = z => Math.max(-4, Math.min(4, Math.round(z / 0.075)));

export function tileToScreen(x, y, z, view) {
  return [view.ox + (x - y) * TW / 2, view.oy + (x + y) * TH / 2 - zOffset(z)];
}

// Ignores the z offset (at most 4 px).
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

// Scale = CSS px per buffer px. The largest scale at which the map box plus PAD fits between the insets (CSS px).
export function fitScale(innerW, innerH, w, h, insets = { top: 0, bottom: 0 }) {
  return Math.min(innerW / ((w + h) * TW / 2 + 2 * PAD), (innerH - insets.top - insets.bottom) / ((w + h) * TH / 2 + 2 * PAD));
}

export const zoomSteps = fit => [fit, ...[1, 2, 3].filter(s => s > fit * 1.1)];

export const nearestStep = (steps, scale) => steps.reduce((a, b) => Math.abs(b - scale) < Math.abs(a - scale) ? b : a);

// Level-screen buffer: ceil(innerWidth/scale) x ceil(innerHeight/scale), map centred between the insets plus a clamped pan.
export function cameraFor(innerW, innerH, w, h, pan = { x: 0, y: 0 }, scale, insets = { top: 0, bottom: 0 }) {
  const bw = Math.ceil(innerW / scale), bh = Math.ceil(innerH / scale), top = insets.top / scale, bottom = insets.bottom / scale;
  const p = clampPan(pan, bw, bh - top - bottom, w, h);
  return { scale, bw, bh, w, h, pan: p,
    ox: Math.round(bw / 2 - (w - h) * TW / 4 + p.x), oy: Math.round((bh + top - bottom - (w + h) * TH / 2) / 2 + p.y) };
}

// The pan at scale1 that keeps the map point under the client point in place.
export function panForZoom(cam0, scale1, clientX, clientY, innerW, innerH, insets) {
  const rect = { left: 0, top: 0, width: innerW, height: innerH };
  const [ax, ay] = clientToBuffer(clientX, clientY, rect, cam0.bw, cam0.bh);
  const c1 = cameraFor(innerW, innerH, cam0.w, cam0.h, { x: 0, y: 0 }, scale1, insets);
  const [bx, by] = clientToBuffer(clientX, clientY, rect, c1.bw, c1.bh);
  return { x: bx - (ax - cam0.ox) - c1.ox, y: by - (ay - cam0.oy) - c1.oy };
}

// Client coords -> buffer coords for a canvas shown with object-fit: cover.
export function clientToBuffer(cx, cy, rect, bw, bh) {
  const k = Math.max(rect.width / bw, rect.height / bh);
  return [(cx - rect.left - (rect.width - bw * k) / 2) / k, (cy - rect.top - (rect.height - bh * k) / 2) / k];
}
