export const HYDRO = { kDrain: 0.10, kLat: 0.02, eqDry: 0.9, eqWet: 0.5, farDry: 0.33, farWet: 0.06, kVert: 0.05, cutoffM: 400 };

const WT_MIN = -0.3, WT_MAX = 1.5, COVER_ET = 0.03, SUBSID = 0.001 / 208; // m per tick per cm of wt (0.1 x wt cm/yr)
let delta = new Float32Array(0); // reused lateral-flow scratch

export function hydroTick(world, S, env, params = HYDRO) {
  const { w, h, n, z, wt, cover, dist, src } = world;
  const { kDrain, kLat, kVert, cutoffM } = params;
  const far = params.farWet + (params.farDry - params.farWet) * env.dry;
  const eq = params.eqWet + (params.eqDry - params.eqWet) * env.dry;
  for (let i = 0; i < n; i++) {
    let v = wt[i] + kVert * (far - COVER_ET * cover[i] - wt[i]);
    const s = src[i];
    if (s >= 0 && dist[i] <= cutoffM) v += kDrain * S[s] * Math.exp(-dist[i] / env.L) * (eq - v);
    wt[i] = v;
  }
  if (delta.length !== n) delta = new Float32Array(n);
  delta.fill(0);
  // Water moves from higher head h = z - wt to lower; losing water deepens wt.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, hi = z[i] - wt[i];
    if (x + 1 < w) { const f = kLat * (hi - (z[i + 1] - wt[i + 1])); delta[i] += f; delta[i + 1] -= f; }
    if (y + 1 < h) { const f = kLat * (hi - (z[i + w] - wt[i + w])); delta[i] += f; delta[i + w] -= f; }
  }
  for (let i = 0; i < n; i++) {
    const v = Math.min(WT_MAX, Math.max(WT_MIN, wt[i] + delta[i]));
    wt[i] = v;
    if (v > 0) z[i] -= SUBSID * v * 100;
  }
}
