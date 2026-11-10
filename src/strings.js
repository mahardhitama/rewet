// All UI copy (English).
export const LINES = [[0, 'This peat swamp was once wet.'], [2.8, 'Canals drained it. Then it burned.'], [5.6, 'Block the canals. Rewet the peat. Replant.']];

export const TOAST = {
  noSave: 'No save.',
  saveDeleted: 'Save deleted.',
};

export const SELECT = {
  title: 'Choose a site', back: 'Back', years: n => `${n} ${n === 1 ? 'year' : 'years'}`,
  locked: n => `Locked: restore site ${n} first`,
  best: n => (n ? '★'.repeat(n) + '☆'.repeat(3 - n) : '☆☆☆'),
  upTitle: 'Upgrades',
  stars: n => `Stars available: ${n}`,
  owned: 'Owned',
  buy: cost => `Buy · ★${cost}`,
  sandbox: 'Sandbox', sandboxNote: 'Random site, no pass mark, data view on',
};

export const UPGRADES = {
  crew: ['Extra crew', 'One more work crew on every site.'],
  cheapBlocks: ['Cheaper blocks', 'Blocks cost 25% less.'],
  fastCrew: ['Fast fire crews', 'Fire crews put fires out faster.'],
};

export const HUD = {
  time: (year, years, wet, week) => `Year ${year}/${years} · ${wet ? 'Wet' : 'Dry'} season · wk ${week}`,
  stats: (funds, crews, total, goodwill, wetNow, wetDry) =>
    `Funds ${funds} · Crews ${crews}/${total} · Goodwill ${goodwill} · Wet now ${wetNow}% · Dry-season wet ${wetDry == null ? '–' : `${wetDry}%`} (scored)`,
  pause: 'Pause', x1: '×1', x2: '×2',
  legend: ['0 m', '40 cm', '1.5 m'], // water table below the surface
  legendTitle: 'Water table depth (data view). Wet = at or above 40 cm.',
  keys: 'P/Space pause · 1/2 speed · D data view · drag/arrows pan · Esc menu',
  dataView: 'Data view',
  mapView: 'Map view',
};

export const R_NAMES = { rewet: 'Rewetting', reveg: 'Revegetation', revit: 'Revitalisation', defense: 'Defense' };

// name, and the hint shown while the action is armed
export const ACTION_TEXT = {
  tempBlock: ['Temp block', 'Temporary block: tap an open canal tile. Can wash out in the wet season.'],
  permBlock: ['Perm block', 'Permanent block: tap a temporary block to make it permanent.'],
  backfill: ['Backfill', 'Backfill: tap a canal tile to fill it with peat. Removes the drainage.'],
  well: ['Deep well', 'Deep well: fire crews within 3 tiles put fires out 2× faster.'],
  plant: ['Plant', 'Plant seedlings on a 3×3 patch around the tapped peat. They survive only at 0–40 cm water depth.'],
  mound: ['Mound', 'Planting mound: raises a peat tile 20 cm, out of floodwater.'],
  palud: ['Paludiculture', 'Paludiculture: tap a wet peat tile next to the village.'],
  pond: ['Fish pond', 'Fish pond: tap an open canal tile upstream of a block.'],
  fireGroup: ['Fire group', 'Fire-care group: tap a village tile. Spots fires, halves arson.'],
  fireCrew: ['Fire crew', 'Fire crew: tap a burning tile. The crew stays until the fire is out.'],
};
export const actionMeta = (cost, weeks) => weeks === Infinity ? 'until out' : `${cost} · ${weeks}w`;
export const SELECT_HINT = 'Pick an action, then tap a tile. Tap the action again to cancel.';

export const REASON = {
  busy: 'Work already under way here.',
  funds: 'Not enough funds.',
  crew: 'No free crew.',
  invalid: 'Not possible on this tile.',
  mounded: 'This tile already has a mound.',
  nothingToPlant: 'Nothing left to plant here.',
};

export const REPORT = {
  title: year => `Year ${year} complete`,
  chart: 'Mean peat water depth, past year',
  chartAria: 'Chart of mean peat water-table depth per week over the past year, with the 40 cm wet line',
  line40: '40 cm',
  burnt: pct => `Burnt so far: ${pct}% of the site`,
  seedlings: (alive, planted) => planted ? `Seedling survival: ${alive}/${planted} planted this year` : 'Seedling survival: none planted this year',
  goodwill: g => `Village goodwill: ${g}`,
  grant: (grant, funds) => `Grant received: +${grant} · Funds now ${funds}`,
  elNino: 'Warning: El Niño next year. The dry season starts 10 weeks early. Get blocks and wells in place.',
  cont: 'Continue',
};

export const DEBRIEF = {
  title: 'Debrief',
  stars: n => '★'.repeat(n) + '☆'.repeat(3 - n),
  before: 'Start', after: 'End',
  thumbs: 'Water depth at start and end (blue wet, brown dry)',
  goals: (r, p) => [
    `${r.rewetPct >= p.rewet ? '✓' : '✗'} Rewetting: ${r.rewetPct.toFixed(0)}% of the peat stayed wet through the last dry season (pass: ${p.rewet}%).`,
    `${r.coverPct >= p.reveg ? '✓' : '✗'} Revegetation: new forest cover is ${r.coverPct.toFixed(0)}% (goal: ${p.reveg}%).`,
    `${r.goodwill >= p.revit ? '✓' : '✗'} Revitalisation: village goodwill is ${r.goodwill.toFixed(0)} (goal: ${p.revit}).`,
  ],
  goalsTitle: 'Goal status',
  dataTitle: 'Data',
  avoided: tc => `Drainage emissions avoided: ${tc.toFixed(1)} (estimate, t C)`,
  fire: tc => `Fire emissions: ${tc.toFixed(1)} (estimate, t C)`,
  seedlings: (alive, planted) => planted ? `Seedling survival: ${alive}/${planted}` : 'Seedling survival: none planted',
  allMet: 'All goals met. Well done.',
  passed: 'Site restored.',
  failed: 'Site not restored.',
  loss: { fire: 'Too much of the site burnt.', funds: 'Out of funds in the final year, with no grant left to come.', goodwill: 'The village lost its trust in you.' },
  lossHint: {
    fire: 'Wet peat does not burn. Block canals early so the water stays high through the dry season.',
    funds: 'Each year brings a new grant, but the last year has none. Spend in the wet season, when work costs less, and block before you backfill.',
    goodwill: 'Keep fire away from the village and build ponds, fire groups and paludiculture.',
  },
  menu: 'Menu',
  sandbox: seed => `Sandbox (seed ${seed}): figures only, no pass mark.`,
  figures: r => [
    `Rewetting: ${r.rewetPct.toFixed(0)}% of the peat stayed wet through the last dry season.`,
    `Revegetation: new forest cover is ${r.coverPct.toFixed(0)}%.`,
    `Revitalisation: village goodwill is ${r.goodwill.toFixed(0)}.`,
  ],
};

// keyed by evaluate().hints
export const HINTS = {
  rewet: 'Rewet more peat: block canals and keep water high through the dry season.',
  reveg: 'Plant more trees on wet peat.',
  revit: 'Earn more goodwill: build ponds, fire groups and paludiculture.',
};

export const QUIT = { title: 'Leave this level?', body: 'Progress on this site will be lost.', yes: 'Leave', no: 'Stay' };
