// All UI copy (English). HINTS still lives in src/sim/score.js: score.test.js imports it from there.
export const LINES = [[0, 'This peat swamp was once wet.'], [2.8, 'Canals drained it. Then it burned.'], [5.6, 'Block the canals. Rewet the peat. Replant.']];

export const TOAST = {
  noSave: 'No save.',
  continueLater: 'Continue arrives with saving. Start a new game for now.',
  saveDeleted: 'Save deleted.',
};

export const SELECT = { title: 'Choose a site', back: 'Back', years: n => `${n} ${n === 1 ? 'year' : 'years'}` };

export const HUD = {
  line: (year, years, week, funds) => `Year ${year}/${years} · Week ${week} · Funds ${funds}`,
  paused: 'paused',
  speed: s => `x${s}`,
  keys: 'P/Space pause · 1/2 speed · D data view · Esc menu',
  dataView: 'Data view',
  mapView: 'Map view',
};

export const REPORT = {
  title: year => `Year ${year} complete`,
  funds: funds => `Funds: ${funds}`,
  cont: 'Continue',
};

export const DEBRIEF = {
  title: 'Debrief',
  stars: n => `Stars: ${n}/3`,
  stats: r => `Rewet ${r.rewetPct.toFixed(0)}% · Cover ${r.coverPct.toFixed(0)}% · Goodwill ${r.goodwill.toFixed(0)}`,
  passed: 'Site restored.',
  failed: 'Site not restored.',
  loss: { fire: 'Too much of the site burnt.', funds: 'Out of funds.', goodwill: 'The village lost its trust in you.' },
  menu: 'Menu',
};
