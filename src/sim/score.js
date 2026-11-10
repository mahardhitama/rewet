import { KIND, WET_WT } from './world.js';
import { ACTIONS, costOf, freeCrews } from './game.js';
import { TICKS_PER_YEAR } from './season.js';

const HA_PER_TILE = 0.25; // 50 m x 50 m
const CROPLAND_TC_HA_YR = 14; // IPCC 2013 Wetlands Supplement, drained cropland
const FIRE_TC_HA = 353 * 0.464; // t d.m./ha x C fraction

// % of peat tiles whose mean wt over the current/last dry season (dryWtHistory) is wet; current wt before the first dry season.
export function dryWetPct(g) {
  const { wt, kind, n } = g.world;
  const hist = g.dryWtHistory;
  let peat = 0, wet = 0;
  for (let i = 0; i < n; i++) {
    if (kind[i] !== KIND.PEAT) continue;
    peat++;
    let m = wt[i];
    if (hist.length) { m = 0; for (const s of hist) m += s[i]; m /= hist.length; }
    if (m <= WET_WT) wet++;
  }
  return peat ? (wet / peat) * 100 : 0;
}

export function evaluate(g) {
  const { kind, cover, n } = g.world, c0 = g.cover0;
  let cSum = 0, cN = 0;
  // A tile at full start cover has no gain to make, so it does not count.
  for (let i = 0; i < n; i++) if (kind[i] !== KIND.CANAL && kind[i] !== KIND.FARM && c0[i] < 1) {
    cSum += Math.max(0, cover[i] - c0[i]) / Math.max(0.01, 1 - c0[i]); cN++;
  }
  const rewetPct = dryWetPct(g);
  const coverPct = cN ? (cSum / cN) * 100 : 0;
  const { goodwill } = g;
  const p = g.level.pass;
  const loss = checkEarlyLoss(g); // an early loss fails the level whatever the scores
  const passed = !loss && rewetPct >= p.rewet;
  const hints = []; // keys into strings.js HINTS, in goal order
  if (rewetPct < p.rewet) hints.push('rewet');
  if (coverPct < p.reveg) hints.push('reveg');
  if (goodwill < p.revit) hints.push('revit');
  const stars = passed ? 1 + (coverPct >= p.reveg) + (goodwill >= p.revit) : 0;
  return { rewetPct, coverPct, goodwill, passed, stars, hints, loss, speciesSeen: [...(g.seen ?? [])] };
}

const PAID = Object.keys(ACTIONS).filter((id) => ACTIONS[id].cost > 0);
export const cheapestCost = (g) => Math.min(...PAID.map((id) => costOf(g, id))); // season- and upgrade-aware

export function checkEarlyLoss(g) {
  if (g.burnt.size > 0.35 * g.world.n) return 'fire';
  // broke only counts once no grant is left to come (final year), while play goes on, and the crews are idle
  const end = g.level.years * TICKS_PER_YEAR, finalYear = g.tick >= end - TICKS_PER_YEAR && g.tick < end;
  if (finalYear && g.funds < cheapestCost(g) && g.jobs.length === 0 && freeCrews(g) === g.crews.length) return 'funds';
  if (g.goodwill <= 0) return 'goodwill';
  return null;
}

// Tiles seeded since `since` (tick) and how many still carry a seedling or reached full cover.
export function seedlingSurvival(g, since = 0) {
  let planted = 0, alive = 0;
  for (const [i, t] of g.planted) {
    if (t < since) continue;
    planted++;
    if (g.seedlings.has(i) || g.world.cover[i] >= 1) alive++;
  }
  return { alive, planted };
}

export function co2Estimate(g) {
  const { wt, n } = g.world;
  let avoidedTC = 0;
  for (let i = 0; i < n; i++) {
    if (g.wt0[i] > WET_WT && wt[i] <= WET_WT)
      avoidedTC += CROPLAND_TC_HA_YR * HA_PER_TILE * (g.wetTicks[i] / TICKS_PER_YEAR);
  }
  return { avoidedTC, fireTC: g.burnt.size * HA_PER_TILE * FIRE_TC_HA };
}
