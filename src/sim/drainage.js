import { KIND, BLOCK } from './world.js';

export const DRAIN = { canal: 1, river: 0.6, temp: 0.35, perm: 0.2, maxHeadTiles: 6, tileM: 50 };

const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

// Upstream = 8-connected canal neighbours with strictly higher z.
export function computeStrength(world) {
  const { w, h, n, kind, block, z } = world;
  const S = new Float32Array(n);
  for (let i = 0; i < n; i++) S[i] = kind[i] === KIND.CANAL ? DRAIN.canal : kind[i] === KIND.RIVER ? DRAIN.river : 0;
  for (let b = 0; b < n; b++) {
    if (kind[b] !== KIND.CANAL || (block[b] !== BLOCK.TEMP && block[b] !== BLOCK.PERM)) continue;
    const s = block[b] === BLOCK.TEMP ? DRAIN.temp : DRAIN.perm;
    S[b] = Math.min(S[b], s);
    const seen = new Set([b]);
    let front = [b];
    for (let d = 0; d < DRAIN.maxHeadTiles; d++) {
      const next = [];
      for (const i of front) {
        const x = i % w, y = (i / w) | 0;
        for (const [dx, dy] of N8) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
          const j = yy * w + xx;
          if (seen.has(j) || kind[j] !== KIND.CANAL || z[j] <= z[i] || block[j] !== BLOCK.NONE) continue;
          seen.add(j);
          S[j] = Math.min(S[j], s);
          next.push(j);
        }
      }
      front = next;
    }
  }
  for (let i = 0; i < n; i++) if (block[i] === BLOCK.FILLED) S[i] = 0;
  return S;
}

// Two-pass 8-connected chamfer; carries src (nearest source index).
export function computeDistance(world, S) {
  const { w, h, n, dist, src } = world;
  const ORTH = DRAIN.tileM, DIAG = DRAIN.tileM * Math.SQRT2;
  for (let i = 0; i < n; i++) { const on = S[i] > 0; dist[i] = on ? 0 : Infinity; src[i] = on ? i : -1; }
  const relax = (x, y, dx, dy, c) => {
    const xx = x + dx, yy = y + dy;
    if (xx < 0 || xx >= w || yy < 0 || yy >= h) return;
    const i = y * w + x, j = yy * w + xx;
    if (dist[j] + c < dist[i]) { dist[i] = dist[j] + c; src[i] = src[j]; }
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    relax(x, y, -1, 0, ORTH); relax(x, y, -1, -1, DIAG); relax(x, y, 0, -1, ORTH); relax(x, y, 1, -1, DIAG);
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    relax(x, y, 1, 0, ORTH); relax(x, y, 1, 1, DIAG); relax(x, y, 0, 1, ORTH); relax(x, y, -1, 1, DIAG);
  }
}
