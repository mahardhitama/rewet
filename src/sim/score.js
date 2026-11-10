import { KIND, WET_WT } from './world.js';
import { ACTIONS } from './game.js';
import { TICKS_PER_YEAR } from './season.js';

// Hint copy; Task 10 moves this into strings.js.
export const HINTS = {
  rewet: 'Rewet more peat: block canals and keep water high through the dry season.',
  reveg: 'Plant more trees on wet peat.',
  revit: 'Earn more goodwill: build ponds, fire groups and paludiculture.',
};

const HA_PER_TILE = 0.25; // 50 m x 50 m
const CROPLAND_TC_HA_YR = 14; // IPCC 2013 Wetlands Supplement, drained cropland
const FIRE_TC_HA = 353 * 0.464; // t d.m./ha x C fraction

export function evaluate(g) {
  const { wt, kind, cover, n } = g.world;
  const hist = g.dryWtHistory;
  let peat = 0, wet = 0, cSum = 0, cN = 0;
  for (let i = 0; i < n; i++) {
    const k = kind[i];
    if (k === KIND.PEAT) {
      peat++;
      let m = wt[i];
      if (hist.length) { m = 0; for (const s of hist) m += s[i]; m /= hist.length; }
      if (m <= WET_WT) wet++;
    }
    if (k !== KIND.CANAL && k !== KIND.FARM) { cSum += cover[i]; cN++; }
  }
  const rewetPct = peat ? (wet / peat) * 100 : 0;
  const coverPct = cN ? (cSum / cN) * 100 : 0;
  const { goodwill } = g;
  const p = g.level.pass;
  const passed = rewetPct >= p.rewet;
  const hints = [];
  if (rewetPct < p.rewet) hints.push(HINTS.rewet);
  if (coverPct < p.reveg) hints.push(HINTS.reveg);
  if (goodwill < p.revit) hints.push(HINTS.revit);
  const stars = passed ? 1 + (coverPct >= p.reveg) + (goodwill >= p.revit) : 0;
  return { rewetPct, coverPct, goodwill, passed, stars, hints };
}

const MIN_COST = Math.min(...Object.values(ACTIONS).map((a) => a.cost).filter((c) => c > 0));

export function checkEarlyLoss(g) {
  if (g.burnt.size > 0.35 * g.world.n) return 'fire';
  if (g.funds < MIN_COST && g.jobs.length === 0 && g.crews.every((t) => t <= g.tick)) return 'funds';
  if (g.goodwill <= 0) return 'goodwill';
  return null;
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
