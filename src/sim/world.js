export const KIND = { PEAT: 0, CANAL: 1, RIVER: 2, VILLAGE: 3, FARM: 4 };
// Wet/healthy: wt <= 0.40 m. Float32-rounded so a stored 0.4 counts as wet.
export const WET_WT = Math.fround(0.4);
export const BLOCK = { NONE: 0, TEMP: 1, PERM: 2, FILLED: 3 };

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const idx = (w, x, y) => y * w + x;

export function createWorld({ w, h, seed }) {
  const n = w * h;
  return {
    w, h, n, seed, rng: mulberry32(seed),
    z: new Float32Array(n),
    wt: new Float32Array(n).fill(0.3),
    cover: new Float32Array(n),
    dist: new Float32Array(n),
    kind: new Uint8Array(n),
    block: new Uint8Array(n),
    fire: new Uint8Array(n),
    fireT: new Uint16Array(n),
    src: new Int32Array(n).fill(-1),
  };
}
