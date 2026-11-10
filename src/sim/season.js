export const TICKS_PER_YEAR = 208;
const TICKS_PER_WEEK = 4, RAMP_WEEKS = 4, L_WET = 45, L_DRY = 100;

// Wet weeks 0-30, dry from week 31 (21 in an El Nino year); dry ramps up over 4 weeks, and back down over weeks 0-4.
export function seasonAt(tick, { elNino = false } = {}) {
  const wf = (tick % TICKS_PER_YEAR) / TICKS_PER_WEEK;
  const start = elNino ? 21 : 31;
  const dry = Math.min(1, Math.max(0, wf >= start ? (wf - start) / RAMP_WEEKS : 1 - wf / RAMP_WEEKS));
  return { week: Math.floor(wf), dry, L: L_WET + (L_DRY - L_WET) * dry };
}

// Season rule for a game state. One definition: game.js and fauna.js both use it.
export const year = (g) => Math.floor(g.tick / TICKS_PER_YEAR);
export const elNino = (g) => g.level.elNinoYear != null && year(g) === g.level.elNinoYear;
export const dryStart = (g) => (elNino(g) ? 21 : 31);
export const isWetSeason = (g) => seasonAt(g.tick).week < dryStart(g);
