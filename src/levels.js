import { placeLevel } from './sim/game.js';
import { hydroTick } from './sim/hydro.js';
import { seasonAt, TICKS_PER_YEAR } from './sim/season.js';
import { computeStrength } from './sim/drainage.js';

// Tiles from a to b (8-connected, Bresenham). Canals run from the map edge (outlet) uphill toward the dome centre.
function line([x0, y0], [x1, y1]) {
  const out = [], dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
  let err = dx - dy, x = x0, y = y0;
  for (;;) {
    out.push([x, y]);
    if (x === x1 && y === y1) return out;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}
const lines = (...segs) => segs.flatMap(([a, b]) => line(a, b));
const rect = (x0, y0, x1, y1) => { const o = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) o.push([x, y]); return o; };
const pass = (k) => ({ rewet: 60 + 3 * k, reveg: 40 + 3 * k, revit: 60 + 2 * k }); // R17

export const LEVELS = [
  {
    id: 1, name: 'Small drained plot', size: 22, years: 3, seed: 101, grant: 1800, arson: 0, illegalCanals: [], elNinoYear: null,
    pass: pass(0), teaches: 'Blocks, the 40 cm line, distance factor',
    canals: lines([[0, 5], [9, 5]], [[0, 11], [9, 11]], [[0, 17], [9, 17]]),
    rivers: [], villages: [], farms: [],
  },
  {
    id: 2, name: 'Burnt former forest', size: 24, years: 3, seed: 202, grant: 2200, arson: 0, illegalCanals: [], elNinoYear: null,
    pass: pass(1), teaches: 'Planting, drowning in dips, mounds',
    canals: lines([[0, 6], [9, 6]], [[0, 17], [9, 17]], [[23, 12], [15, 12]], [[12, 0], [12, 8]]),
    rivers: [], villages: [], farms: [],
  },
  {
    id: 3, name: 'Village edge', size: 26, years: 4, seed: 303, grant: 2400, arson: 4, illegalCanals: [], elNinoYear: null,
    pass: pass(2), teaches: 'Goodwill, paludiculture, arson',
    canals: lines([[14, 25], [14, 16]], [[0, 8], [10, 8]], [[23, 9], [16, 9]], [[0, 18], [8, 18]]),
    rivers: line([24, 0], [24, 25]), villages: rect(10, 23, 12, 25), farms: rect(6, 22, 9, 25),
  },
  {
    id: 4, name: 'Canal network', size: 30, years: 4, seed: 404, grant: 2800, arson: 3, elNinoYear: null,
    pass: pass(3), teaches: 'Cascades, backfill, illegal canals',
    canals: lines(
      [[8, 0], [8, 13]], [[8, 2], [14, 8]], [[8, 9], [13, 14]], // north trunk with two branches: the cascade lesson
      [[29, 22], [16, 22]], [[0, 20], [7, 20]], [[22, 0], [22, 7]],
    ),
    illegalCanals: [line([29, 12], [21, 14]), line([0, 27], [6, 22])],
    rivers: [], villages: rect(24, 26, 26, 28), farms: rect(20, 26, 23, 28),
  },
  {
    id: 5, name: 'El Nino year', size: 30, years: 4, seed: 505, grant: 2800, arson: 3, elNinoYear: 2,
    pass: pass(4), teaches: 'Wells, fire crews, smouldering fire',
    canals: lines([[0, 8], [12, 11]], [[0, 21], [12, 18]], [[29, 15], [18, 15]], [[15, 0], [15, 10]], [[22, 29], [17, 20]]),
    illegalCanals: [line([29, 27], [21, 21])],
    rivers: [], villages: rect(3, 26, 5, 28), farms: rect(6, 26, 9, 28),
  },
  {
    id: 6, name: 'Full peat dome', size: 40, years: 5, seed: 606, grant: 3600, arson: 5, elNinoYear: 3,
    pass: pass(5), teaches: 'Everything, with higher pass lines',
    canals: lines(
      [[10, 0], [10, 18]], [[10, 3], [18, 11]], [[10, 11], [17, 18]], // north trunk with two branches
      [[39, 10], [23, 10]], [[35, 10], [27, 18]], // east trunk with a branch
      [[28, 38], [28, 23]], [[28, 34], [22, 28]], // south trunk with a branch
      [[0, 30], [14, 30]], [[5, 30], [12, 23]], // west trunk with a branch
    ),
    illegalCanals: [line([0, 3], [7, 8]), line([39, 36], [30, 29])],
    rivers: line([0, 39], [39, 39]), villages: [...rect(2, 35, 4, 37), ...rect(35, 2, 37, 4)], farms: [...rect(5, 35, 8, 37), ...rect(31, 2, 34, 4)],
  },
];

// R1: placeLevel, then 52 weeks of hydrology with no actions, so the level opens already drained.
export function buildLevelWorld(level) {
  const world = placeLevel(level);
  const S = computeStrength(world);
  for (let t = 0; t < TICKS_PER_YEAR; t++) hydroTick(world, S, seasonAt(t));
  return world;
}
