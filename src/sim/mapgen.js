import { createWorld, mulberry32, idx, KIND, VEG } from './world.js';
import { generateTerrain, boxBlur } from './terrain.js';

const TRUNK = { w: 8, d: 5 }; // KFCP 2014 p.9
export const BRANCH = { w: 4, d: 2.5 }; // NOT SOURCED
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
  const rot = ROT[outlet](n);
  // The terrain is not symmetric under rotation, so read the real surface at the rotated tile.
  const surf = createWorld({ w: n, h: n, seed: level.seed });
  generateTerrain(surf, { microAmp: 0, tilt: 1, outlet });
  const zAt = (p) => { const [x, y] = rot(p); return surf.z[idx(n, x, y)]; };
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
  const byX = () => [...trunks].sort((a, b) => a.xs[0] - b.xs[0]);
  const canalOf = (tr) => canals[tr.id - CANAL0];

  // Merges: in the lower 40%, the second of 2 neighbouring trunks turns one column per row into the first and joins it at row yj.
  for (let c = 0; c < (m.merges || 0) && trunks.length > 1; c++) {
    for (let k = 0; k < TRIES; k++) {
      const s = byX(), i = Math.floor(rng() * (s.length - 1)), a = s[i], b = s[i + 1];
      const yj = ri(Math.floor(0.6 * end), Math.floor(0.8 * end));
      if (a.xs[yj] === undefined || b.xs[yj] === undefined) continue;
      // Walk up from the join: one column per row toward the old path of b, until it meets that path.
      const arm = [[a.xs[yj] + Math.sign(b.xs[yj] - a.xs[yj]), yj]];
      while (arm[0][1] > 0 && arm[0][0] !== b.xs[arm[0][1]]) {
        const [x, y] = arm[0];
        arm.unshift([x + Math.sign(b.xs[y - 1] - x), y - 1]);
      }
      if (arm[0][0] !== b.xs[arm[0][1]]) continue;
      // The arm touches a only at the join row; it may touch its own old path.
      const ok = arm.every(([x, y]) => [0, b.id].includes(tagAt(x, y)) && clear(x, y, (t) => t === b.id || (y >= yj - 1 && t === a.id)));
      if (!ok) continue;
      const y0 = arm[0][1];
      for (let y = y0; y <= end; y++) tag[idx(n, b.xs[y], y)] = 0;
      for (const [x, y] of arm) tag[idx(n, x, y)] = b.id;
      b.xs = [...b.xs.slice(0, y0), ...arm.map(([x]) => x)];
      // shortcut: a later merge that moves trunk a can raise a's bed above this join; fine while each level has 1 merge, recompute the joins when a level needs 2.
      const cb = canalOf(b), bedJ = canalOf(a).bed[yj];
      cb.tiles = b.xs.map((x, y) => [x, y]);
      cb.size = cb.size.slice(0, cb.tiles.length);
      cb.bed = [];
      // Trunk rule, then at least 0.01 m per step above the join bed of a, so the arm bed falls into the join.
      cb.tiles.forEach((p, y) => cb.bed.push(y ? Math.min(cb.bed[y - 1] - 0.01, zAt(p)) : zAt(p)));
      cb.bed = cb.bed.map((v, y) => Math.max(v, bedJ + 0.01 * (yj - y + 1)));
      break;
    }
  }

  // Forks: an arm leaves a trunk in its middle 60%, runs diagonally away from the nearest trunk, then straight to the outlet edge.
  for (let c = 0; c < (m.forks || 0) && trunks.length; c++) {
    const id = CANAL0 + canals.length;
    for (let k = 0; k < TRIES; k++) {
      const tr = trunks[Math.floor(rng() * trunks.length)], ys = ri(Math.floor(0.2 * end), Math.floor(0.8 * end));
      const x0 = tr.xs[ys];
      if (x0 === undefined) continue;
      const near = trunks.filter((o) => o !== tr && o.xs[ys] !== undefined).sort((p, q) => Math.abs(p.xs[ys] - x0) - Math.abs(q.xs[ys] - x0))[0];
      const dir = near ? Math.sign(x0 - near.xs[ys]) : x0 < n / 2 ? 1 : -1;
      // True if no other canal is within 2 tiles of (x, y), so the arm keeps at least 3 tiles from it.
      const far = (x, y) => {
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (tagAt(x + dx, y + dy) >= CANAL0) return false;
        return true;
      };
      const straight = (x, y) => { for (let yy = y; yy <= end; yy++) if (!far(x, yy)) return false; return true; };
      const tiles = [];
      let d = 1;
      for (; ys + d <= end; d++) {
        const x = x0 + dir * d, y = ys + d;
        if (!inMap(x, y) || tagAt(x, y) || !clear(x, y, (t) => t === tr.id || t < CANAL0)) break;
        tiles.push([x, y]);
        if (d >= 3 && straight(x, y + 1)) break;
      }
      const [lx, ly] = tiles[tiles.length - 1] || [];
      if (tiles.length < 3 || ly >= end || !straight(lx, ly + 1)) continue;
      for (let y = ly + 1; y <= end; y++) tiles.push([lx, y]);
      const bed = [];
      tiles.forEach((p, s) => bed.push(Math.min((s ? bed[s - 1] : canalOf(tr).bed[ys]) - 0.01, zAt(p))));
      for (const [x, y] of tiles) tag[idx(n, x, y)] = id;
      canals.push({ tiles, bed, size: sized(tiles, TRUNK) });
      break;
    }
  }

  // Links: a straight canal on one row between 2 neighbouring trunks, 3 to 8 tiles. Its bed falls toward the lower trunk.
  for (let c = 0; c < (m.links || 0) && trunks.length > 1; c++) {
    const id = CANAL0 + canals.length;
    for (let k = 0; k < TRIES; k++) {
      const s = byX(), i = Math.floor(rng() * (s.length - 1)), a = s[i], b = s[i + 1];
      const y = ri(Math.floor(0.2 * end), Math.floor(0.8 * end));
      const xa = a.xs[y], xb = b.xs[y], len = xb - xa - 1;
      if (!(len >= 3 && len <= 8)) continue;
      const tiles = Array.from({ length: len }, (_, t) => [xa + 1 + t, y]);
      if (!tiles.every(([x, yy]) => !tagAt(x, yy) && clear(x, yy, (t) => t === a.id || t === b.id))) continue;
      const za = canalOf(a).bed[y], zb = canalOf(b).bed[y];
      const hi = Math.max(za, zb) - 0.01, lo = Math.min(za, zb) + 0.01;
      if (hi <= lo) continue;
      // Linear from hi at the higher trunk to lo at the lower trunk.
      const bed = tiles.map((_, t) => (za > zb ? hi + ((lo - hi) * t) / (len - 1) : lo + ((hi - lo) * t) / (len - 1)));
      for (const [x, yy] of tiles) tag[idx(n, x, yy)] = id;
      canals.push({ tiles, bed, size: sized(tiles, BRANCH) });
      break;
    }
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
      if (rows.length < 3) continue; // a merged trunk has no rows below its join
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
      if (tr.xs[j] === undefined) continue; // below the join of a merged trunk
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

  // Illegal canals: from a side edge (upper half) or the high edge toward the dome centre, ordered from the edge inward.
  // When the inward step is blocked, the path bends along the other axis, first away from the high edge.
  const illegalCanals = [], cx = (n - 1) / 2;
  for (let c = 0; c < (m.illegal || 0); c++) {
    const own = (t) => t === -1 - c;
    const free = (x, y) => inMap(x, y) && y < n - 1 && !tagAt(x, y) && clear(x, y, own);
    for (let k = 0; k < 2 * TRIES; k++) {
      const e = Math.floor(rng() * 3), len = ri(6, 10);
      let x = e === 2 ? Math.floor(rng() * n) : e * (n - 1), y = e === 2 ? 0 : 1 + Math.floor(rng() * (Math.floor(n / 2) - 1));
      const sx = Math.sign(cx - x) || 1;
      // Step order: inward first, then the two bends.
      const steps = e === 2 ? [[0, 1], [sx, 0], [-sx, 0]] : [[sx, 0], [0, 1], [0, -1]];
      const path = [];
      while (path.length < len && free(x, y)) {
        path.push([x, y]);
        tag[idx(n, x, y)] = -1 - c;
        const next = steps.map(([dx, dy]) => [x + dx, y + dy]).find(([nx, ny]) => free(nx, ny) && (e === 2 || ny >= 1));
        if (!next) break;
        [x, y] = next;
      }
      if (path.length >= 6) { illegalCanals.push(path); break; }
      for (const [px, py] of path) tag[idx(n, px, py)] = 0;
    }
  }

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

const VEG_SALT = 0x5eed;
// p = noise x wetness; the first row with p >= limit gives the type. Game values, NOT SOURCED.
const VEG_LIMITS = [[0.38, VEG.TREE], [0.28, VEG.SHRUB], [0.18, VEG.SEEDLING], [0.1, VEG.FERN]];
const START_COVER = [0, 0.15, 0.3, 0.6, 1]; // by VEG; game values, NOT SOURCED

// Sets the start cover on peat tiles. Uses its own RNG, so world.rng does not change.
export function seedVegetation(world, { treeShare = 1 } = {}) {
  const { w, h, n, kind, wt, cover } = world;
  const rng = mulberry32(world.seed ^ VEG_SALT);
  let noise = new Float32Array(n);
  for (let i = 0; i < n; i++) noise[i] = rng();
  noise = boxBlur(noise, w, h);
  let lo = Infinity, hi = -Infinity;
  for (const v of noise) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const bad = (k) => k === KIND.CANAL || k === KIND.FARM;
  for (let i = 0; i < n; i++) {
    if (kind[i] !== KIND.PEAT) continue;
    const x = i % w, y = (i / w) | 0;
    let skip = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && bad(kind[idx(w, xx, yy)])) skip = true;
    }
    if (skip) continue;
    const p = ((noise[i] - lo) / (hi - lo || 1)) * Math.min(1, Math.max(0, 1 - wt[i]));
    let v = VEG_LIMITS.find(([lim]) => p >= lim)?.[1] ?? VEG.NONE;
    if (v === VEG.TREE && rng() > treeShare) v = VEG.SHRUB;
    cover[i] = START_COVER[v];
  }
}
