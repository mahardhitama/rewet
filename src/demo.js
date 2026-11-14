// How-to slides: each one runs the real sim on a fresh copy of the level map, with a short script of actions.
// Pure: no DOM, so node --test runs it. The start tick, the length and the script are game values for the slides, NOT real-world values.
import { createGame, applyAction, step } from './sim/game.js';
import { buildLevelWorld } from './levels.js';
import { KIND, WET_WT } from './sim/world.js';
import { walkUp } from './sim/drainage.js';
import { ignite, FIRE } from './sim/fire.js';

const TICKS = 100, MS = 60; // a demo: 25 weeks, 60 ms a tick (6 s)
const WARM = 16; // 4 weeks run before the demo shows: the level opens with dry-season water, so the first frame would jump
const LATE_WET = 116, MID_WET = 60, DRY = 150; // start ticks: week 29 (the dry season comes next), week 15, week 37

// Sites on the map, found once per demo. -1 when the map has none.
const center = (wd, i) => Math.hypot(i % wd.w - wd.w / 2, ((i / wd.w) | 0) - wd.h / 2);
// The canal tile with the longest run upstream (up to 12 tiles), nearest the map centre: room for a cascade.
function canalSite(wd) {
  let best = -1, bs = -Infinity;
  for (let i = 0; i < wd.n; i++) if (wd.kind[i] === KIND.CANAL) {
    let up = 0; walkUp(wd, i, 12, () => up++);
    const s = Math.min(up, 12) * 10 - center(wd, i);
    if (s > bs) { bs = s; best = i; }
  }
  return best;
}
const upstream = (wd, i, k) => walkUp(wd, i, k, () => {})[0] ?? i;
// The nearest tile to i (square rings, up to r) that passes test.
function nearest(wd, i, test, r = 6) {
  const { w, h } = wd, x = i % w, y = (i / w) | 0;
  for (let d = 0; d <= r; d++) for (let yy = y - d; yy <= y + d; yy++) for (let xx = x - d; xx <= x + d; xx++) {
    if (Math.max(Math.abs(xx - x), Math.abs(yy - y)) !== d || xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
    if (test(yy * w + xx)) return yy * w + xx;
  }
  return -1;
}
const villageSite = wd => { let best = -1; for (let i = 0; i < wd.n; i++) if (wd.kind[i] === KIND.VILLAGE && (best < 0 || center(wd, i) < center(wd, best))) best = i; return best; };
const peat = wd => i => wd.kind[i] === KIND.PEAT;
const nextToVillage = (wd, i) => [-1, 0, 1].some(dy => [-1, 0, 1].some(dx => { const x = i % wd.w + dx, y = ((i / wd.w) | 0) + dy; return x >= 0 && y >= 0 && x < wd.w && y < wd.h && wd.kind[y * wd.w + x] === KIND.VILLAGE; }));

// Each demo: start tick, length (ticks) and speed (ms a tick), view mode, zoom (span: tiles across the view), the focus tile, and the script: [tick, action id or 'fire', tile].
// 'fire' lights the tile (no action does that). fire: true keeps the sim's own fires; the other demos put them out each tick.
export const DEMOS = {
  tempBlock: { site: wd => ({ focus: canalSite(wd) }), plan: s => [[2, 'tempBlock', s.focus]] },
  permBlock: { site: wd => ({ focus: canalSite(wd) }), plan: s => [[2, 'tempBlock', s.focus], [10, 'permBlock', s.focus]] },
  wetLine: { mode: 'data', site: wd => ({ focus: canalSite(wd) }), plan: () => [] },
  distance: { mode: 'data', span: 14, site: wd => ({ focus: canalSite(wd) }), plan: s => [[2, 'tempBlock', s.focus]] },
  fireCrew: {
    start: DRY, fire: true, ticks: 40, ms: 150, // slower, so the fire shows before the crew puts it out
    site: wd => { const c = canalSite(wd); return { focus: nearest(wd, c, i => wd.kind[i] === KIND.PEAT && wd.wt[i] > WET_WT, 4) }; },
    plan: s => [[2, 'fire', s.focus], [8, 'fireCrew', s.focus]],
  },
  plant: { start: MID_WET, site: wd => ({ focus: nearest(wd, canalSite(wd), peat(wd), 4), c: canalSite(wd) }), plan: s => [[2, 'tempBlock', s.c], [4, 'plant', s.focus]] },
  mound: {
    start: MID_WET,
    site: wd => { const c = canalSite(wd); let lo = -1; nearest(wd, c, i => { if (wd.kind[i] === KIND.PEAT && (lo < 0 || wd.z[i] < wd.z[lo])) lo = i; return false; }, 3); return { focus: lo }; },
    plan: s => [[2, 'mound', s.focus]],
  },
  palud: { start: MID_WET, site: wd => ({ focus: nearest(wd, villageSite(wd), i => wd.kind[i] === KIND.PEAT && nextToVillage(wd, i), 3) }), plan: s => [[20, 'palud', s.focus]] },
  pond: { site: wd => { const c = canalSite(wd); return { c, focus: upstream(wd, c, 2) }; }, plan: s => [[2, 'tempBlock', s.c], [10, 'pond', s.focus]] },
  fireGroup: { site: wd => ({ focus: villageSite(wd) }), plan: s => [[2, 'fireGroup', s.focus]] },
  // flow: a block at the low end of a canal, then one 6 tiles upstream. The flow arrows show the way to the outlet.
  flow: {
    span: 14,
    site: wd => { let m = -1; for (let i = 0; i < wd.n; i++) if (wd.kind[i] === KIND.CANAL && (m < 0 || wd.z[i] < wd.z[m])) m = i; return { c: m, focus: upstream(wd, m, 3), u: upstream(wd, m, 6) }; },
    plan: s => [[2, 'tempBlock', s.c], [12, 'tempBlock', s.u]],
  },
  cascade: {
    mode: 'data', span: 14,
    site: wd => { const c = canalSite(wd); return { c, focus: upstream(wd, c, 5), u: upstream(wd, c, 10) }; },
    plan: s => [[2, 'tempBlock', s.c], [3, 'tempBlock', s.focus], [4, 'tempBlock', s.u]],
  },
  backfill: { site: wd => ({ focus: canalSite(wd) }), plan: s => [[2, 'backfill', s.focus]] },
  illegal: {
    illegal: true,
    site: (wd, level) => { const p = level.illegalCanals?.[0]; return p ? { focus: p[2][1] * wd.w + p[2][0], dug: p[3][1] * wd.w + p[3][0] } : { focus: -1 }; },
    plan: s => [[44, 'tempBlock', s.dug]],
  },
  well: {
    start: DRY, fire: true, ticks: 40, ms: 150,
    site: wd => { const c = canalSite(wd), f = nearest(wd, c, i => wd.kind[i] === KIND.PEAT && wd.wt[i] > WET_WT, 4); return { focus: f, well: nearest(wd, f, i => i !== f && wd.kind[i] === KIND.PEAT, 2) }; },
    plan: s => [[2, 'well', s.well], [8, 'fire', s.focus], [14, 'fireCrew', s.focus]],
  },
  smoulder: {
    start: DRY, fire: true,
    site: wd => { const c = canalSite(wd); return { c, focus: nearest(wd, c, i => wd.kind[i] === KIND.PEAT && wd.wt[i] > WET_WT, 3) }; },
    plan: s => [[2, 'smoulder', s.focus], [12, 'tempBlock', s.c]],
  },
};

// A demo on a copy of the level: no arson, no El Niño, no illegal canals (only the illegal demo keeps them).
export function newDemo(level, key) {
  const def = DEMOS[key], L = { ...level, arson: 0, elNinoYear: null, illegalCanals: def.illegal ? level.illegalCanals : [] };
  const g = createGame(L, {}, buildLevelWorld(L));
  g.tick = (def.start ?? LATE_WET) - WARM;
  for (let k = 0; k < WARM; k++) { step(g); g.world.fire.fill(0); g.world.fireT.fill(0); }
  g.events.length = 0;
  const wd = g.world, s = def.site(wd, L), none = s.focus < 0; // none: a map with no site (no village, no illegal canal) shows its centre, with no script
  return { key, g, focus: none ? (wd.h >> 1) * wd.w + (wd.w >> 1) : s.focus, plan: none ? [] : def.plan(s), mode: def.mode ?? 'normal', span: def.span ?? 8, ticks: def.ticks ?? TICKS, ms: def.ms ?? MS, t: 0 };
}

// One tick: first the script for this tick, then the sim. Returns the actions done, as [id, tile, ok].
export function demoStep(d) {
  const wd = d.g.world, done = [];
  for (const [at, id, i] of d.plan) if (at === d.t) {
    if (id === 'fire') done.push([id, i, ignite(wd, i)]);
    else if (id === 'smoulder') { const ok = ignite(wd, i); if (ok) { wd.fire[i] = 2; wd.fireT[i] = FIRE.smoulderTicks; } done.push([id, i, ok]); }
    else done.push([id, i, applyAction(d.g, id, i).ok]);
  }
  step(d.g);
  // Only the scripted fire may burn: on a fire demo, fire stays on the focus tile and its 8 neighbours (the square a crew fights).
  const { w } = wd, fx = d.focus % w, fy = (d.focus / w) | 0, keep = DEMOS[d.key].fire;
  for (let i = 0; i < wd.n; i++) if (wd.fire[i] && !(keep && Math.abs(i % w - fx) <= 1 && Math.abs(((i / w) | 0) - fy) <= 1)) { wd.fire[i] = 0; wd.fireT[i] = 0; }
  d.g.events.length = 0;
  d.t++;
  return done;
}

// The next scripted action, for the cursor and the button on the slide. null when the script has ended.
export const nextAction = d => d.plan.find(([at]) => at >= d.t) ?? null;
