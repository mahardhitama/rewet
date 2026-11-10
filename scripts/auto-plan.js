// Automatic block plan for a level: node scripts/auto-plan.js --level N > plan.json  (plan = [{tick,id,x,y}])
import { pathToFileURL } from 'node:url';
import { LEVELS } from '../src/levels.js';
import { ACTIONS, costOf } from '../src/sim/game.js';
import { resolveLevel } from '../src/sim/mapgen.js';
import { TICKS_PER_YEAR } from '../src/sim/season.js';

const TPW = 4, CREWS = 3, GAP = 4;

// Picks canal tiles from low to high bed, at least GAP + 1 tiles apart (Chebyshev). Each tile gets a tempBlock,
// then (with perm) a permBlock when the tempBlock ends. Free crews take a ready permBlock first,
// so each permBlock starts before its tempBlock can wash out. Orders wait for funds; the grant comes at each year end.
export function blockPlan(level, { perm = true } = {}) {
  const order = level.canals.map((p, k) => ({ p, z: level.canalZ[k] })).sort((a, b) => a.z - b.z);
  const picked = [];
  for (const { p: [x, y] } of order)
    if (picked.every(([px, py]) => Math.max(Math.abs(px - x), Math.abs(py - y)) > GAP)) picked.push([x, y]);
  const temps = [...picked], perms = []; // perms: { x, y, at } with at = tick the tempBlock ends
  const crews = new Array(CREWS).fill(0), plan = [];
  let funds = level.grant;
  const end = level.years * TICKS_PER_YEAR;
  for (let t = 0; t < end && (temps.length || perms.length); t += TPW) {
    if (t > 0 && t % TICKS_PER_YEAR === 0) funds += level.grant;
    for (let c = 0; c < CREWS; c++) {
      if (crews[c] > t) continue;
      const k = perms.findIndex((e) => e.at <= t);
      const id = k >= 0 ? 'permBlock' : temps.length ? 'tempBlock' : null;
      if (!id) break;
      const cost = costOf({ tick: t, level, upgrades: {} }, id);
      // A tempBlock keeps funds for each open permBlock: a tempBlock left waiting for funds can wash out.
      const keep = id === 'tempBlock' && perm ? (perms.length + 1) * ACTIONS.permBlock.cost : 0;
      if (cost + keep > funds) break;
      const [x, y] = k >= 0 ? [perms[k].x, perms[k].y] : temps.shift();
      if (k >= 0) perms.splice(k, 1);
      funds -= cost;
      crews[c] = t + ACTIONS[id].weeks * TPW;
      if (id === 'tempBlock' && perm) perms.push({ x, y, at: crews[c] });
      plan.push({ tick: t, id, x, y });
    }
  }
  return plan;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf('--level'), id = Number(process.argv[i + 1]);
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`no level ${id}`);
  console.log('[\n' + blockPlan(resolveLevel(level)).map((e) => '  ' + JSON.stringify(e)).join(',\n') + '\n]');
}
