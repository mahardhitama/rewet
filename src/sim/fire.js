import { KIND, WET_WT } from './world.js';

export const FIRE = { base: 0.0004, spreadP: 0.15, smoulderP: 0.2, surfaceTicks: 8, smoulderTicks: 56 };
// fire[i]: 0 none, 1 surface burning, 2 smouldering; fireT[i]: ticks left in that state.

const isFuel = (world, i) => world.kind[i] === KIND.PEAT || world.kind[i] === KIND.FARM;
const ignitable = (world, i) => world.fire[i] === 0 && world.wt[i] > WET_WT && isFuel(world, i);

function light(world, i) {
  world.fire[i] = 1;
  world.fireT[i] = FIRE.surfaceTicks;
  world.cover[i] = 0;
}

export function ignite(world, i) {
  if (!ignitable(world, i)) return false;
  light(world, i);
  return true;
}

export function fireTick(world, env, wind) {
  const { w, h, n, fire, fireT, wt, rng } = world;
  const burnt = [];
  const burning = [];
  for (let i = 0; i < n; i++) if (fire[i]) burning.push(i); // snapshot: tiles lit below don't act this tick
  const lit = (i) => { light(world, i); burnt.push(i); };
  for (const i of burning) {
    if (!isFuel(world, i) || wt[i] <= 0) { fire[i] = 0; fireT[i] = 0; continue; } // dug into a canal, or flooded
    if (fire[i] === 1) {
      const x = i % w, y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { // 8 neighbours
        const nx = x + dx, ny = y + dy;
        if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (!ignitable(world, j)) continue;
        const p = FIRE.spreadP * (dx * wind[0] + dy * wind[1] > 0 ? 2 : 1);
        if (rng() < p) lit(j);
      }
    }
    if (--fireT[i] > 0) continue;
    if (fire[i] === 1) {
      if (rng() < FIRE.smoulderP) { fire[i] = 2; fireT[i] = FIRE.smoulderTicks; } else fire[i] = 0;
    } else if (wt[i] > WET_WT) lit(i); // smoulder re-flares only on dry peat
    else fire[i] = 0;
  }
  for (let i = 0; i < n; i++) {
    if (ignitable(world, i) && rng() < FIRE.base * env.dry * (wt[i] - WET_WT)) lit(i);
  }
  return { burnt };
}
