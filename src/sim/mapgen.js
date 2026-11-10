import { createWorld, mulberry32, idx } from './world.js';
import { generateTerrain } from './terrain.js';

const TRUNK = { w: 8, d: 5 }; // KFCP 2014 p.9
const BRANCH = { w: 4, d: 2.5 }; // NOT SOURCED
const GAP = 4; // tiles between trunks
const TRIES = 20;
const RIVER = 1, VILLAGE = 2, FARM = 3, CANAL0 = 10; // tag values; each canal gets its own tag from CANAL0, each illegal canal a negative tag

// Canonical frame: high edge y = 0, outlet edge y = n - 1. Each function maps a canonical tile to the real outlet.
const ROT = {
  S: (n) => ([x, y]) => [x, y],
  N: (n) => ([x, y]) => [n - 1 - x, n - 1 - y],
  E: (n) => ([x, y]) => [y, n - 1 - x],
  W: (n) => ([x, y]) => [n - 1 - y, x],
};

export function generateMap(level) {
  const n = level.size, m = level.map;
  const rng = mulberry32(level.seed ^ 0x3a9);
  const outlet = 'NESW'[Math.floor(rng() * 4)];
  const surf = createWorld({ w: n, h: n, seed: level.seed });
  generateTerrain(surf, { microAmp: 0, tilt: 1, outlet: 'S' });
  const zAt = ([x, y]) => surf.z[idx(n, x, y)];
  const tag = new Int32Array(n * n);
  const inMap = (x, y) => x >= 0 && y >= 0 && x < n && y < n;
  const tagAt = (x, y) => (inMap(x, y) ? tag[idx(n, x, y)] : 0);
  const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
  // True if no tile in the 3x3 around (x, y) has a tag outside ok.
  const clear = (x, y, ok) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const t = tagAt(x + dx, y + dy);
      if (t && !ok(t)) return false;
    }
    return true;
  };

  if (m.river) for (let x = 0; x < n; x++) tag[idx(n, x, n - 1)] = RIVER;
  const end = m.river ? n - 2 : n - 1;

  // Trunks: xs[y] is the trunk column in row y.
  const trunks = [];
  for (let t = 0; t < (m.trunks || 0); t++) {
    const far = (x, y) => x >= 0 && x < n && trunks.every((o) => Math.abs(o.xs[y] - x) >= GAP);
    for (let k = 0; k < TRIES; k++) {
      const xs = [Math.floor(rng() * n)];
      if (!far(xs[0], 0)) continue;
      for (let y = 1; y <= end && xs.length === y; y++) {
        const x = xs[y - 1], side = x + (rng() < 0.5 ? -1 : 1);
        if (rng() < (m.meander || 0) && far(side, y)) xs.push(side);
        else if (far(x, y)) xs.push(x);
      }
      if (xs.length === end + 1) { trunks.push({ xs }); break; }
    }
  }
  const canals = []; // { tiles, bed, size }
  const sized = (tiles, base) => {
    const out = [];
    while (out.length < tiles.length) {
      const f = 0.75 + 0.5 * rng(), len = ri(3, 6);
      for (let k = 0; k < len && out.length < tiles.length; k++) out.push({ w: base.w * f, d: base.d * f });
    }
    return out;
  };
  for (const tr of trunks) {
    const tiles = tr.xs.map((x, y) => [x, y]), bed = [];
    tiles.forEach((p, k) => bed.push(k ? Math.min(bed[k - 1] - 0.01, zAt(p)) : zAt(p)));
    tr.id = CANAL0 + canals.length;
    for (const [x, y] of tiles) tag[idx(n, x, y)] = tr.id;
    canals.push({ tiles, bed, size: sized(tiles, TRUNK) });
  }

  // Villages: a 3x3 block next to a trunk, then a 4x3 farm on the far side of the village.
  const villages = [], farms = [];
  const free = (x0, y0, w, h, ok) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (!inMap(x, y) || tagAt(x, y) || !ok(x, y)) return false;
    return true;
  };
  const fill = (x0, y0, w, h, v, list) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { tag[idx(n, x, y)] = v; list.push([x, y]); }
  };
  for (let v = 0; v < (m.villages || 0) && trunks.length; v++) {
    for (let k = 0; k < TRIES; k++) {
      const tr = trunks[Math.floor(rng() * trunks.length)], dir = rng() < 0.5 ? -1 : 1, y0 = ri(n - 5, n - 4);
      const rows = tr.xs.slice(y0, y0 + 3);
      const vx = dir > 0 ? Math.max(...rows) + 1 : Math.min(...rows) - 3;
      const fx = dir > 0 ? vx + 3 : vx - 4;
      if (!free(vx, y0, 3, 3, () => true)) continue;
      if (!free(fx, y0, 4, 3, (x, y) => clear(x, y, (t) => t < CANAL0))) continue;
      fill(vx, y0, 3, 3, VILLAGE, villages);
      fill(fx, y0, 4, 3, FARM, farms);
      break;
    }
  }

  // Branches: diagonal uphill from the middle 60% of a trunk. Water flows from the branch into the trunk.
  for (const tr of trunks) for (let b = 0; b < (m.branches || 0); b++) {
    const id = CANAL0 + canals.length;
    for (let k = 0; k < TRIES; k++) {
      const j = ri(Math.floor(0.2 * end), Math.floor(0.8 * end)), dir = rng() < 0.5 ? -1 : 1, len = ri(5, 10);
      const tiles = [];
      for (let s = 1; s <= len; s++) {
        const x = tr.xs[j] + dir * s, y = j - s;
        // The first tile touches its own trunk at the junction.
        if (!inMap(x, y) || tagAt(x, y) || !clear(x, y, (t) => t === id || (s === 1 && t === tr.id))) break;
        tiles.push([x, y]);
        tag[idx(n, x, y)] = id;
      }
      // shortcut: a branch shorter than 3 tiles is dropped and tried again; tune when maps look sparse.
      if (tiles.length < 3) { for (const [x, y] of tiles) tag[idx(n, x, y)] = 0; continue; }
      const bed = [];
      tiles.forEach((p, s) => bed.push(Math.max((s ? bed[s - 1] : canals[tr.id - CANAL0].bed[j]) + 0.01, zAt(p))));
      canals.push({ tiles, bed, size: sized(tiles, BRANCH) });
      break;
    }
  }

  // Illegal canals: from a side edge in the upper half toward the dome centre, ordered from the edge inward.
  const illegalCanals = [], cx = (n - 1) / 2;
  for (let c = 0; c < (m.illegal || 0); c++) {
    for (let k = 0; k < TRIES; k++) {
      const x0 = rng() < 0.5 ? 0 : n - 1, y0 = Math.floor(rng() * Math.floor(n / 2)), len = ri(6, 10);
      const step = Math.max(Math.abs(cx - x0), y0) || 1, ux = (cx - x0) / step, uy = -y0 / step;
      const path = [];
      for (let s = 0; s < len; s++) {
        const x = Math.round(x0 + s * ux), y = Math.round(y0 + s * uy);
        if (!inMap(x, y) || !clear(x, y, (t) => t === -1 - c)) break;
        path.push([x, y]);
        tag[idx(n, x, y)] = -1 - c;
      }
      if (path.length) { illegalCanals.push(path); break; }
    }
  }

  const rot = ROT[outlet](n);
  const rivers = m.river ? Array.from({ length: n }, (_, x) => rot([x, n - 1])) : [];
  return {
    canals: canals.flatMap((c) => c.tiles.map(rot)),
    canalZ: canals.flatMap((c) => c.bed),
    canalW: canals.flatMap((c) => c.size.map((s) => s.w)),
    canalD: canals.flatMap((c) => c.size.map((s) => s.d)),
    rivers, villages: villages.map(rot), farms: farms.map(rot),
    illegalCanals: illegalCanals.map((p) => p.map(rot)),
    terrain: { tilt: 1, outlet },
  };
}

export const resolveLevel = (level) => (level.map ? { ...level, ...generateMap(level) } : level);
