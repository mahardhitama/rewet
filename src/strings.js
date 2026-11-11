// All UI copy (English).
export const LINES = [[0, 'This peat swamp was once wet.'], [2.8, 'Canals drained it. Then it burned.'], [5.6, 'Block the canals. Rewet the peat. Replant.']];

export const TOAST = {
  noSave: 'No save.',
  saveDeleted: 'Save deleted.',
};

export const SELECT = {
  title: 'Choose a site', back: 'Back', years: n => `${n} ${n === 1 ? 'year' : 'years'}`,
  best: n => `${n} of 3 stars`,
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
  timeShort: (year, years, wet, week) => `${year}/${years} · ${wet ? 'Wet' : 'Dry'} · wk ${week}`, // phone: labels hidden
  // 6 parts, each { id, label, value, full }. full is the text for the screen reader and the tooltip.
  // time is { year, years, wet, week }. short is true when the labels are hidden.
  parts: (time, funds, crews, total, goodwill, wetNow, wetDry, short) => {
    const t = HUD.time(time.year, time.years, time.wet, time.week);
    const dry = wetDry == null ? '–' : `${wetDry}%`;
    const p = (id, label, value, full = `${label} ${value}`) => ({ id, label, value, full });
    return [
      p('time', '', short ? HUD.timeShort(time.year, time.years, time.wet, time.week) : t, t),
      p('funds', 'Funds', `${funds}`),
      p('crew', 'Crews', `${crews}/${total}`),
      p('goodwill', 'Goodwill', `${goodwill}`),
      p('wet', 'Wet now', `${wetNow}%`),
      p('score', 'Dry-season wet', dry, `Dry-season wet ${dry} (scored)`),
    ];
  },
  pause: 'Pause', x1: '×1', x2: '×2',
  legend: ['0 m', '40 cm', '1.5 m'], // water table below the surface
  legendTitle: 'Water table depth (data view). Wet = at or above 40 cm.',
  keys: 'P/Space pause · 1/2 speed · D data view · drag/arrows pan · +/- zoom · 0 full map · Esc menu',
  dataView: 'Data view',
  mapView: 'Map view',
};

// visible text, label for screen readers and the tooltip
export const ZOOM = {
  group: 'Zoom',
  in: ['+', 'Zoom in (+)'],
  out: ['−', 'Zoom out (-)'],
  fit: ['ALL', 'All of the map (0)'], // the name starts with the visible word (WCAG 2.5.3)
};

// the name line above the slots, and the accessible name of a slot
export const BAR = {
  name: (name, meta) => `${name}: ${meta}`,
  slot: (name, group, meta) => `${name}, ${group}, ${meta}`,
};

export const R_NAMES = { rewet: 'Rewetting', reveg: 'Revegetation', revit: 'Revitalisation', defense: 'Defense' };

// name, and the hint shown while the action is armed
// [name, how-to text, short tag shown above the slot icon]
export const ACTION_TEXT = {
  tempBlock: ['Temp block', 'Tap canal. Floods can break it.', 'Dam'],
  permBlock: ['Perm block', 'Makes a temp block permanent.', 'Dam+'],
  backfill: ['Backfill', 'Fills a canal tile with peat.', 'Fill'],
  well: ['Deep well', 'Crews in 3 tiles fight fire 2×.', 'Well'],
  plant: ['Plant', 'Plants 5×5. Lives at 0–40 cm.', 'Plant'],
  mound: ['Mound', 'Raises peat 20 cm over floods.', 'Mound'],
  palud: ['Paludiculture', 'Tap wet peat by the village.', 'Farm'],
  pond: ['Fish pond', 'Tap a canal upstream of a block.', 'Fish'],
  fireGroup: ['Fire group', 'Tap the village. Halves arson.', 'Watch'],
  fireCrew: ['Fire crew', 'Tap a fire. Stays until out.', 'Fire'],
};
export const actionMeta = (cost, weeks, perTile = false) => weeks === Infinity ? 'until out' : perTile ? `${cost}/tile · 1–${weeks}w` : `${cost} · ${weeks}w`; // perTile: weeks is the longest job
export const SELECT_HINT = ['Pick an action, then tap a tile.', 'Tap the action again to cancel.']; // 2 lines, as the name and how-to lines of an action

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
  // each row is [label, value]
  rows: (burntPct, sv, goodwill, grant, funds) => [
    ['Burnt so far', `${burntPct}% of the site`],
    ['Seedling survival', sv.planted ? `${sv.alive}/${sv.planted} planted this year` : 'none planted this year'],
    ['Village goodwill', `${goodwill}`],
    ['Grant received', `+${grant} · Funds now ${funds}`],
  ],
  speciesRow: names => ['Species seen', `${names.length}`, names.join(', ')], // [label, count, namesText]
  elNino: 'Warning: El Niño next year. The dry season starts 10 weeks early. Get blocks and wells in place.',
  cont: 'Continue',
};

export const DEBRIEF = {
  title: 'Debrief',
  stars: n => `${n} of 3 stars`,
  before: 'Start', after: 'End',
  thumbs: 'Water depth at start and end (blue wet, brown dry)',
  goalHead: ['Goal', 'Result', 'Pass mark'],
  // each row is [goal, result, pass mark]
  goalRows: (r, p) => [
    [`${r.rewetPct >= p.rewet ? '✓' : '✗'} Rewetting`, `${r.rewetPct.toFixed(0)}% of the peat stayed wet through the last dry season`, `${p.rewet}%`],
    [`${r.coverPct >= p.reveg ? '✓' : '✗'} Revegetation`, `new forest cover is ${r.coverPct.toFixed(0)}%`, `${p.reveg}%`],
    [`${r.goodwill >= p.revit ? '✓' : '✗'} Revitalisation`, `village goodwill is ${r.goodwill.toFixed(0)}`, `${p.revit}`],
  ],
  goalsTitle: 'Goal status',
  dataTitle: 'Data',
  dataRows: (co2, sv) => [
    ['Drainage emissions avoided', `${co2.avoidedTCO2.toFixed(1)} t CO2`],
    ['Fire emissions', `${co2.fireTCO2.toFixed(1)} t CO2`],
    ['Seedling survival', sv.planted ? `${sv.alive}/${sv.planted}` : 'none planted'],
  ],
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
  figureHead: ['Goal', 'Result'],
  figureRows: r => [
    ['Rewetting', `${r.rewetPct.toFixed(0)}% of the peat stayed wet through the last dry season`],
    ['Revegetation', `new forest cover is ${r.coverPct.toFixed(0)}%`],
    ['Revitalisation', `village goodwill is ${r.goodwill.toFixed(0)}`],
  ],
};

// keyed by evaluate().hints
export const HINTS = {
  rewet: 'Rewet more peat: block canals and keep water high through the dry season.',
  reveg: 'Plant more trees on wet peat.',
  revit: 'Earn more goodwill: build ponds, fire groups and paludiculture.',
};

export const QUIT = { title: 'Leave this level?', body: 'Progress on this site will be lost.', yes: 'Leave', no: 'Stay' };

export const INTRO = { skip: 'Skip' };

export const MENU = {
  label: 'Progress',
  stars: (x, n) => ['Stars', `${x} of ${n}`],
  found: (x, n) => ['Wildlife found', `${x} of ${n}`],
};

export const JOURNAL = {
  title: 'Journal', open: 'Journal', close: 'Close', prev: 'Prev', next: 'Next', home: 'Home',
  pos: (a, b, n) => (a === b ? `Page ${a} of ${n}` : `Pages ${a}-${b} of ${n}`),
  contentsConcepts: 'Contents: ideas', contentsWildlife: (x, n) => `Contents: wildlife (${x}/${n})`,
  found: name => `New in your journal: ${name}`, openEntry: 'Open', notFound: 'Not found yet', unknown: '?',
  hidden: (k, n) => `Unknown species ${k} of ${n}, not found yet`,
  status: { LC: 'Least Concern', NT: 'Near Threatened', VU: 'Vulnerable', EN: 'Endangered', CR: 'Critically Endangered' },
  statusLabel: 'IUCN status', habitatLabel: 'Habitat', protectedNote: 'Protected in Indonesia.', endemicNote: 'Lives only on Borneo.', sources: 'Sources', openSource: 'Open source', hint: 'Left and Right arrows turn pages. Esc closes.',
};
